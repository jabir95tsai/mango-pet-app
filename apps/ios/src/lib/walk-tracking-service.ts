/**
 * Walk tracking service — FOREGROUND GPS (P1a). Native counterpart of the
 * web `WalkSession` (apps/web/src/lib/walk-tracking.ts). All path math
 * (Haversine, accuracy/min-distance filtering, distance accumulation, path
 * cap 500) is delegated to `@mango/shared-business` so iOS and web sample
 * identically and produce the same `distanceKm` / `path`.
 *
 * This is the SERVICE / hook layer (no UI). A screen subscribes via `on()`,
 * calls `start()` / `stop()`, then builds the walk doc from the final state
 * using `computeWalkScore` (shared-business) for `score`.
 *
 * ⚠️ FOREGROUND ONLY. Background GPS (Always permission + UIBackgroundModes)
 * is P1d and intentionally NOT enabled here. While foreground-only, we pause
 * the duration timer when the app is backgrounded (expo-location stops
 * delivering fixes without background mode) so duration doesn't inflate into
 * a phantom walk — mirroring the web `hiddenMs` semantics.
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import {
  addGpsSample,
  emptyPathAccumulator,
  type PathAccumulator,
} from "@mango/shared-business";
import type { WalkPathPoint } from "@mango/shared-types";

export type WalkTrackingErrorKind =
  | "permission_denied"
  | "position_unavailable"
  | null;

export type WalkTrackingState = {
  isTracking: boolean;
  /** True while the app is backgrounded — duration ticker is paused. */
  isPaused: boolean;
  startedAt: Date | null;
  totalDistanceKm: number;
  durationMin: number;
  path: WalkPathPoint[];
  errorKind: WalkTrackingErrorKind;
};

export type WalkTrackingListener = (state: WalkTrackingState) => void;

function emptyState(): WalkTrackingState {
  return {
    isTracking: false,
    isPaused: false,
    startedAt: null,
    totalDistanceKm: 0,
    durationMin: 0,
    path: [],
    errorKind: null,
  };
}

export class WalkTrackingService {
  private state: WalkTrackingState = emptyState();
  private acc: PathAccumulator = emptyPathAccumulator();
  private listeners = new Set<WalkTrackingListener>();
  private sub: Location.LocationSubscription | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  /** Wall-clock ms accumulated while backgrounded — subtracted from duration. */
  private hiddenMs = 0;
  private hiddenSince: number | null = null;

  on(listener: WalkTrackingListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<WalkTrackingState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  /** Request foreground permission + begin watching. Resolves to `true` when
   *  tracking started, `false` when permission was denied (errorKind set). */
  async start(): Promise<boolean> {
    if (this.state.isTracking) return true;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      this.update({ ...emptyState(), errorKind: "permission_denied" });
      return false;
    }

    this.acc = emptyPathAccumulator();
    this.hiddenMs = 0;
    this.hiddenSince = null;
    this.update({
      ...emptyState(),
      isTracking: true,
      startedAt: new Date(),
    });

    try {
      this.sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0, // shared-business does the ≥5m filtering
        },
        (loc) => this.handleFix(loc),
      );
    } catch {
      this.update({ isTracking: false, errorKind: "position_unavailable" });
      return false;
    }

    this.ticker = setInterval(() => this.tickDuration(), 1000);
    const handler = (next: AppStateStatus) => this.handleAppState(next);
    const sub = AppState.addEventListener("change", handler);
    this.appStateSub = sub;
    return true;
  }

  private handleFix(loc: Location.LocationObject) {
    const next = addGpsSample(this.acc, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      t: loc.timestamp,
      accuracy: loc.coords.accuracy ?? Number.POSITIVE_INFINITY,
    });
    if (next === this.acc) return; // rejected (poor accuracy or < 5m)
    this.acc = next;
    this.update({ path: next.path, totalDistanceKm: next.totalDistanceKm });
  }

  private tickDuration() {
    if (!this.state.startedAt) return;
    const accumulatedHidden =
      this.hiddenMs + (this.hiddenSince ? Date.now() - this.hiddenSince : 0);
    const elapsedMs =
      Date.now() - this.state.startedAt.getTime() - accumulatedHidden;
    this.update({ durationMin: Math.max(0, Math.round((elapsedMs / 60_000) * 100) / 100) });
  }

  private handleAppState(next: AppStateStatus) {
    if (!this.state.isTracking) return;
    if (next === "active") {
      if (this.hiddenSince !== null) {
        this.hiddenMs += Date.now() - this.hiddenSince;
        this.hiddenSince = null;
      }
      this.update({ isPaused: false });
    } else {
      // background / inactive — foreground-only, so pause duration.
      if (this.hiddenSince === null) this.hiddenSince = Date.now();
      this.update({ isPaused: true });
    }
  }

  /** Stop tracking and return the final state (path + distance + duration)
   *  for the screen to persist as a walk doc. */
  stop(): WalkTrackingState {
    if (this.sub) {
      this.sub.remove();
      this.sub = null;
    }
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    if (this.hiddenSince !== null) {
      this.hiddenMs += Date.now() - this.hiddenSince;
      this.hiddenSince = null;
    }
    this.tickDuration();
    this.update({ isTracking: false, isPaused: false });
    return this.state;
  }

  reset() {
    this.stop();
    this.acc = emptyPathAccumulator();
    this.hiddenMs = 0;
    this.state = emptyState();
    for (const l of this.listeners) l(this.state);
  }
}
