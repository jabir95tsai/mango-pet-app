"use client";

import type { WalkPathPoint } from "./types";

/**
 * Haversine distance in km.
 */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

const MIN_ACCEPTABLE_ACCURACY_M = 50;
const MIN_DISTANCE_M_BETWEEN_SAMPLES = 5;
const MAX_PATH_POINTS = 500;

/** Geolocation API error codes (W3C). */
const GEO_PERMISSION_DENIED = 1;
const GEO_POSITION_UNAVAILABLE = 2;
const GEO_TIMEOUT = 3;

export type WalkErrorKind =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "backgrounded"
  | "unknown";

export type WalkSessionState = {
  isTracking: boolean;
  /** True when the tab is backgrounded — duration ticker pauses. */
  isPaused: boolean;
  startedAt: Date | null;
  totalDistanceKm: number;
  durationMin: number;
  path: WalkPathPoint[];
  lastError: string | null;
  errorKind: WalkErrorKind | null;
  /** Wall-clock ms accumulated while tab was hidden — subtracted from duration. */
  hiddenMs: number;
};

export type WalkSessionListener = (state: WalkSessionState) => void;

function emptyState(): WalkSessionState {
  return {
    isTracking: false,
    isPaused: false,
    startedAt: null,
    totalDistanceKm: 0,
    durationMin: 0,
    path: [],
    lastError: null,
    errorKind: null,
    hiddenMs: 0,
  };
}

export class WalkSession {
  private watchId: number | null = null;
  private state: WalkSessionState = emptyState();
  private listeners = new Set<WalkSessionListener>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Timestamp (ms) when tab was last hidden, or null if visible. */
  private hiddenSince: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  /** Screen Wake Lock — keeps the device from auto-locking during a walk.
   *  Without this, phones sleep after their idle timeout (~30s default on
   *  iOS), the browser suspends the tab, and `watchPosition` stops firing
   *  → walks silently lose path / distance for the duration of the lock.
   *  The OS-level lock auto-releases when the tab is hidden, so we
   *  re-acquire on visibilitychange. Falls back to the existing
   *  "請保持畫面開啟" warning on browsers without the Wake Lock API. */
  private wakeLock: WakeLockSentinel | null = null;

  on(listener: WalkSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  private update(patch: Partial<WalkSessionState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  start() {
    if (this.state.isTracking) return;
    if (!("geolocation" in navigator)) {
      this.update({
        lastError: "瀏覽器不支援定位",
        errorKind: "unsupported",
      });
      return;
    }

    this.update({
      ...emptyState(),
      isTracking: true,
      startedAt: new Date(),
    });

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.handleGeoError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );

    this.ticker = setInterval(() => {
      if (!this.state.startedAt) return;
      // Subtract time spent backgrounded so duration reflects only foreground tracking.
      const accumulatedHidden =
        this.state.hiddenMs + (this.hiddenSince ? Date.now() - this.hiddenSince : 0);
      const elapsedMs =
        Date.now() - this.state.startedAt.getTime() - accumulatedHidden;
      const mins = Math.max(0, elapsedMs / 60_000);
      this.update({ durationMin: Math.round(mins * 100) / 100 });
    }, 1000);

    // Pause when tab hidden — mobile browsers stop firing watchPosition while
    // backgrounded, so without this the duration would inflate and create
    // "phantom walks" with 0 km but non-zero duration.
    if (typeof document !== "undefined") {
      this.visibilityHandler = () => this.handleVisibilityChange();
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    // Request screen wake lock so the phone stays awake for the whole walk.
    // Best-effort: unsupported browsers (iOS < 16.4, older Android) fall
    // through to the existing background-pause warning. Fire-and-forget
    // — we don't want to delay start() if this races.
    void this.requestWakeLock();
  }

  private async requestWakeLock(): Promise<void> {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    if (this.wakeLock) return;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      // The OS releases the lock automatically when the tab is hidden,
      // when the page is unloaded, or when the user dismisses it via
      // system UI. Clearing the field so the next visibilitychange
      // re-acquire path runs cleanly.
      this.wakeLock.addEventListener("release", () => {
        this.wakeLock = null;
      });
    } catch (err) {
      // Most likely: user agent disallowed (e.g. fullscreen-only policy)
      // or document not visible at request time. Not fatal — the walk
      // tracking still runs while screen is on; user just won't be
      // protected from auto-lock.
      console.warn("[walk] wake lock request failed:", err);
    }
  }

  private async releaseWakeLock(): Promise<void> {
    const lock = this.wakeLock;
    if (!lock) return;
    this.wakeLock = null;
    try {
      await lock.release();
    } catch {
      /* lock may already be released by the OS — ignore */
    }
  }

  private handleGeoError(err: GeolocationPositionError) {
    let errorKind: WalkErrorKind = "unknown";
    let lastError = err.message;
    switch (err.code) {
      case GEO_PERMISSION_DENIED:
        errorKind = "permission_denied";
        lastError = "未授權定位 — 請在瀏覽器設定中允許定位後重試";
        // Stop tracking entirely on denial; no point continuing.
        if (this.watchId !== null) {
          navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
        }
        if (this.ticker) {
          clearInterval(this.ticker);
          this.ticker = null;
        }
        this.update({
          isTracking: false,
          isPaused: false,
          lastError,
          errorKind,
        });
        return;
      case GEO_POSITION_UNAVAILABLE:
        errorKind = "position_unavailable";
        lastError = "目前無法取得位置（訊號弱）";
        break;
      case GEO_TIMEOUT:
        errorKind = "timeout";
        lastError = "定位逾時 — 將持續重試";
        break;
    }
    this.update({ lastError, errorKind });
  }

  private handleVisibilityChange() {
    if (!this.state.isTracking) return;
    if (document.hidden) {
      this.hiddenSince = Date.now();
      this.update({
        isPaused: true,
        lastError: "App 在背景時 GPS 會暫停，請保持畫面開啟",
        errorKind: "backgrounded",
      });
    } else if (this.hiddenSince !== null) {
      const delta = Date.now() - this.hiddenSince;
      this.hiddenSince = null;
      this.update({
        isPaused: false,
        hiddenMs: this.state.hiddenMs + delta,
        lastError: null,
        errorKind: null,
      });
      // Wake Lock auto-releases on hide; re-acquire so a second auto-lock
      // attempt during the same walk is also blocked.
      void this.requestWakeLock();
    }
  }

  stop(): WalkSessionState {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    // Release the wake lock so the phone can sleep normally again
    // after the walk ends. Fire-and-forget — caller doesn't await stop().
    void this.releaseWakeLock();
    // Flush any in-progress hidden interval into hiddenMs so duration is final.
    if (this.hiddenSince !== null) {
      const delta = Date.now() - this.hiddenSince;
      this.hiddenSince = null;
      this.update({ hiddenMs: this.state.hiddenMs + delta });
    }
    this.update({ isTracking: false, isPaused: false });
    return this.state;
  }

  reset() {
    this.stop();
    this.state = emptyState();
    this.emit();
  }

  private handlePosition(pos: GeolocationPosition) {
    const accuracy = pos.coords.accuracy ?? Infinity;
    if (accuracy > MIN_ACCEPTABLE_ACCURACY_M) return;

    const point: WalkPathPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      t: pos.timestamp,
    };

    const last = this.state.path[this.state.path.length - 1];
    if (last) {
      const distM = distanceKm(last, point) * 1000;
      if (distM < MIN_DISTANCE_M_BETWEEN_SAMPLES) return;

      const nextDistance = this.state.totalDistanceKm + distM / 1000;
      const nextPath =
        this.state.path.length >= MAX_PATH_POINTS
          ? [...this.state.path.slice(-MAX_PATH_POINTS + 1), point]
          : [...this.state.path, point];
      this.update({
        totalDistanceKm: Math.round(nextDistance * 1000) / 1000,
        path: nextPath,
      });
    } else {
      this.update({ path: [point] });
    }
  }
}
