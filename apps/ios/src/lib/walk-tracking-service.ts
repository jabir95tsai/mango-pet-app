/**
 * Walk tracking service — P1d BACKGROUND GPS (session-only). Native
 * counterpart of the web `WalkSession`. All path math (Haversine,
 * accuracy/min-distance filtering, distance accumulation, path cap 500) is
 * delegated to `@mango/shared-business` so iOS + web sample identically.
 *
 * Public interface is UNCHANGED from P1a (`start()` / `stop()` / `on()`), so
 * the screens don't change. Two modes:
 *
 *  • Background mode (Always permission granted) — the killer iOS-only ability.
 *    Uses `Location.startLocationUpdatesAsync` + a headless TaskManager task,
 *    so the route + duration keep recording while the phone is locked / the
 *    app is backgrounded / in a pocket. Duration is wall-clock (background
 *    time COUNTS — that's the whole point of P1d). The iOS blue location
 *    indicator is expected (only on during an active walk).
 *
 *  • Foreground fallback (Always denied) — identical to P1a: watchPositionAsync
 *    + duration pauses while backgrounded (`isPaused` true). Does NOT block the
 *    main flow.
 *
 * ⚠️ SESSION-ONLY (App Store review): background location runs ONLY during an
 * active walk. `start()` turns it on, `stop()` turns it off immediately
 * (`stopLocationUpdatesAsync`). Never persistent background tracking.
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addGpsSample,
  emptyPathAccumulator,
  type PathAccumulator,
} from "@mango/shared-business";
import type { WalkPathPoint } from "@mango/shared-types";

// ── Headless background-location task ────────────────────────────────────
// Defined at module load (required by expo-task-manager). It runs even when
// the app is backgrounded/suspended-then-relaunched, so it must own a
// module-level accumulator AND persist to AsyncStorage (module memory can be
// evicted + the task relaunched headlessly — we re-hydrate before appending).
const BG_LOCATION_TASK = "mango-walk-background-location";
const BG_STORE_KEY = "mango.walk.bgSession.v1";

type BgSession = { acc: PathAccumulator; startedAt: number | null };
let bgSession: BgSession = { acc: emptyPathAccumulator(), startedAt: null };

async function persistBgSession(): Promise<void> {
  try {
    await AsyncStorage.setItem(BG_STORE_KEY, JSON.stringify(bgSession));
  } catch {
    /* best-effort */
  }
}

async function hydrateBgSession(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BG_STORE_KEY);
    if (raw) bgSession = JSON.parse(raw) as BgSession;
  } catch {
    /* best-effort */
  }
}

function ingestLocations(locs: Location.LocationObject[]): boolean {
  let changed = false;
  for (const loc of locs) {
    const next = addGpsSample(bgSession.acc, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      t: loc.timestamp,
      accuracy: loc.coords.accuracy ?? Number.POSITIVE_INFINITY,
    });
    if (next !== bgSession.acc) {
      bgSession.acc = next;
      changed = true;
    }
  }
  return changed;
}

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  // If the JS context was evicted and this task was relaunched headlessly,
  // module memory is fresh — restore the in-progress accumulator first so we
  // append rather than lose the earlier route.
  if (bgSession.startedAt === null) await hydrateBgSession();
  const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
  if (ingestLocations(locations)) await persistBgSession();
});

// ── Public service ───────────────────────────────────────────────────────
export type WalkTrackingErrorKind =
  | "permission_denied"
  | "position_unavailable"
  | null;

export type WalkTrackingState = {
  isTracking: boolean;
  /** True only in FOREGROUND-FALLBACK mode while backgrounded (Always denied).
   *  Always false in background mode (we keep recording). */
  isPaused: boolean;
  /** True when Always permission was granted → background recording is on.
   *  Optional/additive so existing screen state literals stay valid. */
  backgroundEnabled?: boolean;
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
    backgroundEnabled: false,
    startedAt: null,
    totalDistanceKm: 0,
    durationMin: 0,
    path: [],
    errorKind: null,
  };
}

export class WalkTrackingService {
  private state: WalkTrackingState = emptyState();
  /** Foreground-fallback accumulator (background mode uses module `bgSession`). */
  private acc: PathAccumulator = emptyPathAccumulator();
  private listeners = new Set<WalkTrackingListener>();
  private sub: Location.LocationSubscription | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private backgroundMode = false;
  /** Fallback-only: ms spent backgrounded, subtracted from duration. */
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

  /**
   * Request foreground (required) then background/Always (optional) permission
   * and begin tracking. Returns `false` only when FOREGROUND permission is
   * denied. Always-denied still returns `true` (foreground fallback).
   */
  async start(): Promise<boolean> {
    if (this.state.isTracking) return true;

    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      this.update({ ...emptyState(), errorKind: "permission_denied" });
      return false;
    }

    // Escalate to Always for background recording. Denied → fallback.
    let alwaysGranted = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      alwaysGranted = bg.status === Location.PermissionStatus.GRANTED;
    } catch {
      alwaysGranted = false;
    }
    this.backgroundMode = alwaysGranted;

    this.acc = emptyPathAccumulator();
    this.hiddenMs = 0;
    this.hiddenSince = null;
    const startedAt = new Date();
    this.update({
      ...emptyState(),
      isTracking: true,
      backgroundEnabled: alwaysGranted,
      startedAt,
    });

    try {
      if (alwaysGranted) {
        // Background mode — single source: startLocationUpdatesAsync feeds the
        // headless task → module bgSession; the foreground ticker reads it.
        bgSession = { acc: emptyPathAccumulator(), startedAt: startedAt.getTime() };
        await persistBgSession();
        await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          activityType: Location.ActivityType.Fitness,
          showsBackgroundLocationIndicator: true, // expected blue bar during a walk
          pausesUpdatesAutomatically: false,
          // batch lightly; shared-business does the ≥5m / accuracy filtering
          deferredUpdatesInterval: 1000,
        });
      } else {
        // Foreground fallback (P1a behaviour).
        this.sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (loc) => this.handleFix(loc),
        );
      }
    } catch {
      this.update({ isTracking: false, errorKind: "position_unavailable" });
      await this.stopLocationSource();
      return false;
    }

    this.ticker = setInterval(() => this.tick(), 1000);
    if (!this.backgroundMode) {
      const handler = (next: AppStateStatus) => this.handleAppState(next);
      this.appStateSub = AppState.addEventListener("change", handler);
    }
    return true;
  }

  /** Fallback-mode fix handler (foreground watchPositionAsync). */
  private handleFix(loc: Location.LocationObject) {
    const next = addGpsSample(this.acc, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      t: loc.timestamp,
      accuracy: loc.coords.accuracy ?? Number.POSITIVE_INFINITY,
    });
    if (next === this.acc) return;
    this.acc = next;
    this.update({ path: next.path, totalDistanceKm: next.totalDistanceKm });
  }

  /** 1s tick — emits path/distance (bg mode reads the module accumulator the
   *  headless task fills) and the wall-clock duration. The ticker itself is
   *  suspended while the app is backgrounded; on resume it catches up. */
  private tick() {
    if (!this.state.startedAt) return;
    if (this.backgroundMode) {
      // Background time COUNTS — wall-clock, no deduction.
      const elapsedMs = Date.now() - this.state.startedAt.getTime();
      this.update({
        path: bgSession.acc.path,
        totalDistanceKm: bgSession.acc.totalDistanceKm,
        durationMin: Math.max(0, Math.round((elapsedMs / 60_000) * 100) / 100),
      });
    } else {
      const accumulatedHidden =
        this.hiddenMs + (this.hiddenSince ? Date.now() - this.hiddenSince : 0);
      const elapsedMs = Date.now() - this.state.startedAt.getTime() - accumulatedHidden;
      this.update({
        durationMin: Math.max(0, Math.round((elapsedMs / 60_000) * 100) / 100),
      });
    }
  }

  /** Fallback-only: pause duration while backgrounded. */
  private handleAppState(next: AppStateStatus) {
    if (!this.state.isTracking || this.backgroundMode) return;
    if (next === "active") {
      if (this.hiddenSince !== null) {
        this.hiddenMs += Date.now() - this.hiddenSince;
        this.hiddenSince = null;
      }
      this.update({ isPaused: false });
    } else {
      if (this.hiddenSince === null) this.hiddenSince = Date.now();
      this.update({ isPaused: true });
    }
  }

  /** Tear down the active location source. Fire-and-forget for the async
   *  native calls so `stop()` stays synchronous (P1a interface) — the stop is
   *  *initiated* immediately (session-only), we just don't await confirmation. */
  private stopLocationSource(): void {
    if (this.sub) {
      this.sub.remove();
      this.sub = null;
    }
    void Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => {
      /* task not started / already stopped — fine */
    });
  }

  /**
   * Stop tracking (session-only: background location turns OFF here) and
   * return the final state for the screen to persist as a walk doc. Stays
   * SYNCHRONOUS (unchanged P1a interface). In background mode the final
   * path/distance are read from the live module `bgSession` (kept current by
   * the headless task; the app is foregrounded when the user taps stop, so
   * memory is intact). The native stop + AsyncStorage cleanup are
   * fire-and-forget.
   */
  stop(): WalkTrackingState {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    this.stopLocationSource();

    if (this.backgroundMode) {
      const elapsedMs = this.state.startedAt
        ? Date.now() - this.state.startedAt.getTime()
        : 0;
      this.update({
        isTracking: false,
        isPaused: false,
        path: bgSession.acc.path,
        totalDistanceKm: bgSession.acc.totalDistanceKm,
        durationMin: Math.max(0, Math.round((elapsedMs / 60_000) * 100) / 100),
      });
      bgSession = { acc: emptyPathAccumulator(), startedAt: null };
      void AsyncStorage.removeItem(BG_STORE_KEY).catch(() => {});
    } else {
      if (this.hiddenSince !== null) {
        this.hiddenMs += Date.now() - this.hiddenSince;
        this.hiddenSince = null;
      }
      const elapsedMs = this.state.startedAt
        ? Date.now() - this.state.startedAt.getTime() - this.hiddenMs
        : 0;
      this.update({
        isTracking: false,
        isPaused: false,
        durationMin: Math.max(0, Math.round((elapsedMs / 60_000) * 100) / 100),
      });
    }
    return this.state;
  }

  reset(): void {
    this.stop();
    this.acc = emptyPathAccumulator();
    this.hiddenMs = 0;
    this.backgroundMode = false;
    this.state = emptyState();
    for (const l of this.listeners) l(this.state);
  }
}
