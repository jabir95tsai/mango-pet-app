"use client";

import type { Timestamp } from "firebase/firestore";
import type { Walk, WalkPathPoint } from "./types";

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

  /** Live preview of how the current session's minutes-so-far would shift
   *  today's progress — useful for the Hero "你今天差 N 分鐘" copy without
   *  refetching walks. Caller passes the stored today total + this session's
   *  durationMin. Capped percent at 100%; minutes are NOT capped (so the
   *  Hero can show "45 / 30 ✓" when goal exceeded). */
  static blendTodayProgress(
    storedTodayMin: number,
    sessionMin: number,
    goalMin = 30,
  ): WalkProgress {
    const total = Math.round((storedTodayMin + sessionMin) * 10) / 10;
    return {
      minutes: total,
      goalMin,
      percent: Math.min(100, Math.round((total / goalMin) * 100)),
    };
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

// ─────────────────────────────────────────────────────────────────────────
// Progress helpers
//
// Pure functions that turn a list of walks into the headline numbers shown
// on the /app/walks Hero. The component layer should *not* re-implement
// these — that's how week-start drifts (Mon vs Sun) and timezone bugs creep
// in. Spec: docs/features/walk-core-redesign.md.
// ─────────────────────────────────────────────────────────────────────────

export type WalkProgress = {
  /** Minutes walked so far today (device-local midnight to now). Not capped
   *  at the goal — over-achievers still see "45 / 30 ✓". */
  minutes: number;
  goalMin: number;
  /** 0-100, capped — drives the progress-bar fill width. */
  percent: number;
};

export type WeekProgress = {
  /** Distinct walks recorded between this week's Monday 00:00 (device-local)
   *  and now. */
  count: number;
  goalCount: number;
  /** 0-100, capped — drives the progress-bar fill width. */
  percent: number;
};

/** Local-day midnight (00:00) for the device's current date. */
function startOfTodayLocal(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO 8601 week start — Monday 00:00 in device-local time. PM default; if
 *  the user later prefers Sunday-start, swap `daysFromMonday` here only. */
function startOfWeekLocal(now: Date = new Date()): Date {
  const d = startOfTodayLocal(now);
  // JS getDay(): 0=Sun, 1=Mon, ... 6=Sat. Normalize so Monday = 0.
  const daysFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

function walkStartMs(walk: Walk): number {
  const ts = walk.startedAt as Timestamp | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}

/**
 * Sum of `durationMin` across walks whose startedAt falls in **today**
 * (device-local midnight onwards). Drives the Hero "今天還差 N 分鐘"
 * copy and the today progress bar. Spec decision: 30 min default goal.
 */
export function getTodayProgress(
  walks: Walk[],
  goalMin = 30,
  now: Date = new Date(),
): WalkProgress {
  const startMs = startOfTodayLocal(now).getTime();
  const raw = walks.reduce(
    (sum, w) => (walkStartMs(w) >= startMs ? sum + (w.durationMin ?? 0) : sum),
    0,
  );
  const minutes = Math.round(raw * 10) / 10;
  return {
    minutes,
    goalMin,
    percent: Math.min(100, Math.round((minutes / goalMin) * 100)),
  };
}

/**
 * Count of walks whose startedAt falls in **this week** (Monday 00:00
 * device-local onwards). Drives the "本週 N/5 次" card. Spec decision:
 * count-based goal (not km / not min) because it's most intuitive.
 */
export function getWeekProgress(
  walks: Walk[],
  goalCount = 5,
  now: Date = new Date(),
): WeekProgress {
  const startMs = startOfWeekLocal(now).getTime();
  const count = walks.reduce(
    (c, w) => (walkStartMs(w) >= startMs ? c + 1 : c),
    0,
  );
  return {
    count,
    goalCount,
    percent: Math.min(100, Math.round((count / goalCount) * 100)),
  };
}

/** Average per-walk minutes over the trailing 7 days. Used by the v2
 *  completion recap "比平均長/短 N 分鐘". Returns 0 when there are no
 *  past walks in the window — the recap line collapses cleanly. */
export function getWeeklyAvgMinutes(
  walks: Walk[],
  now: Date = new Date(),
): number {
  const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
  let total = 0;
  let count = 0;
  for (const w of walks) {
    if (walkStartMs(w) >= sevenDaysAgo) {
      total += w.durationMin ?? 0;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

/** Pet-calorie estimate for the completion recap.
 *  Heuristic: 1 kcal per kg of body weight per km. Wide error bars but
 *  the spec frames this as fun trivia rather than coaching data. Returns
 *  0 when weight is missing — the recap tile then suppresses itself. */
export function estimatePetCalories(
  distanceKm: number,
  petWeightKg: number | null | undefined,
): number {
  if (!petWeightKg || petWeightKg <= 0) return 0;
  return Math.round(distanceKm * petWeightKg * 1.2);
}

/** Picks the most-relevant Hero encouragement message key. Returns a
 *  message key under the `Walks.encouragement` i18n namespace plus the
 *  template variables it needs. The caller does the i18n lookup so the
 *  helper stays framework-free (and the same logic can be tested
 *  without next-intl). */
export type EncouragementHint = {
  key:
    | "noWalksToday"
    | "streakKeep"
    | "petWaiting"
    | "lastWalkYesterday";
  vars: Record<string, string | number>;
};

export function getEncouragementHint(args: {
  todayMinutes: number;
  streakDays: number;
  /** Most recent walk start across all walks, in ms; null when none. */
  lastWalkMs: number | null;
  petName: string | null;
  now?: Date;
}): EncouragementHint {
  const now = (args.now ?? new Date()).getTime();
  const name = args.petName ?? "🐾";
  // 1. Streak ≥3 — protect-the-streak framing trumps everything else.
  if (args.streakDays >= 3) {
    return { key: "streakKeep", vars: { days: args.streakDays } };
  }
  // 2. No walks today AND we know about a previous walk — show "pet is
  //    waiting" with hours since last walk.
  if (args.todayMinutes === 0 && args.lastWalkMs) {
    const hours = Math.max(1, Math.floor((now - args.lastWalkMs) / 3_600_000));
    // < 36h ago ≈ "yesterday" framing reads more natural than 24h hours
    if (hours <= 36) {
      return { key: "lastWalkYesterday", vars: { name } };
    }
    return { key: "petWaiting", vars: { name, hours } };
  }
  // 3. Default — no walks today, no streak.
  return { key: "noWalksToday", vars: { name } };
}

