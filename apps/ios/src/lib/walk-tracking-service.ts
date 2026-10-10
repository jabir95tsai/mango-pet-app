/**
 * Walk tracking service — native counterpart of the web `WalkSession`
 * (apps/web/src/lib/walk-tracking.ts). All path math (Haversine,
 * accuracy/min-distance filtering, distance accumulation, path cap 500) is
 * delegated to `@mango/shared-business` so iOS + web sample identically.
 *
 * Two location sources:
 *
 *  • Background mode (Always permission granted) — the killer iOS-only ability.
 *    `Location.startLocationUpdatesAsync` + a headless TaskManager task, so the
 *    route keeps recording while the phone is locked / the app is backgrounded.
 *    The iOS blue location indicator is expected (only on during a walk).
 *
 *  • Foreground fallback (Always denied) — `watchPositionAsync`; distance is
 *    not recorded while the app is backgrounded (a transient "backgrounded"
 *    hint is shown on return, web errBackground).
 *
 * Duration semantics are web §A/§B in BOTH modes: wall-clock time counts
 * (background / lock-screen included); only the user's own pauses
 * (`pause()` / `resume()`) are subtracted, and a 3h runaway cap auto-stops a
 * forgotten walk (`autoStopped`).
 *
 * Session identity (R16 / TRACK-7) is persisted under
 * `mango.walk.session.v2` — uid, walkId, pet, family, score inputs, start
 * time, pauses and the path accumulator — so an evicted/killed app can offer
 * "continue / end & save" on relaunch (`getActiveWalkSession`) and orphaned
 * background updates are always switched off.
 *
 * ⚠️ SESSION-ONLY (App Store review): background location runs ONLY during an
 * active walk. `start()` turns it on, `stop()` / `reset()` turn it off
 * immediately, and the headless task stops it whenever no live session exists.
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addGpsSample,
  emptyPathAccumulator,
  MIN_ACCEPTABLE_ACCURACY_M,
  type PathAccumulator,
  type ScorablePet,
} from "@mango/shared-business";
import type { Species, WalkPathPoint } from "@mango/shared-types";

// ── Tunables (web walk-tracking.ts parity) ───────────────────────────────
/** Runaway safeguard (web RUNAWAY_CAP_MIN): auto-stop at 3 hours. */
export const RUNAWAY_CAP_MIN = 180;
/** Below this, a background interval is too short to plausibly have dropped
 *  distance — no "backgrounded" hint for a quick app switch. */
const BG_HINT_MIN_MS = 3000;
/** How long the transient background hint stays up after returning. */
const BG_HINT_TTL_MS = 6000;
/** No usable (accurate) fix for this long while walking → "weak signal". */
const WEAK_SIGNAL_MS = 20_000;
/** Fallback mode persists the accumulator at most this often. */
const PERSIST_THROTTLE_MS = 5000;

// ── Persisted session identity ───────────────────────────────────────────
const BG_LOCATION_TASK = "mango-walk-background-location";
const SESSION_STORE_KEY = "mango.walk.session.v2";
/** Pre-R16 accumulator-only record — dropped on sight. */
const LEGACY_BG_STORE_KEY = "mango.walk.bgSession.v1";

/** Serialisable subset of the pet the score formula reads. */
export type ScorableSnapshot = {
  species: Species;
  weightKg: number | null;
  breed: string | null;
  birthdayMs: number | null;
};

/** Who/what a session belongs to — fixed when the session starts. */
export type WalkSessionIdentity = {
  uid: string;
  walkId: string;
  petId: string;
  petName: string;
  familyId: string | null;
  streakDays: number;
  scorable: ScorableSnapshot | null;
};

export type ActiveWalkSession = WalkSessionIdentity & {
  v: 2;
  /** epoch ms */
  startedAt: number;
  /** Total ms spent in user pauses (banked). */
  pausedMs: number;
  /** epoch ms of an in-flight user pause, else null. */
  pausedSince: number | null;
  backgroundMode: boolean;
  acc: PathAccumulator;
  /** Set once stop()/the runaway cap ended the walk (epoch ms). A stopped
   *  record survives until the walk is handed to a local draft. */
  stoppedAt: number | null;
  autoStopped: boolean;
  /** Last time the record was persisted (epoch ms). */
  updatedAt?: number;
};

/** A persisted session found on launch (see getActiveWalkSession). */
export type RecoveredWalkSession = ActiveWalkSession & {
  /** Background location updates are still running for it right now. */
  locationRunning: boolean;
};

/**
 * Best known end time for a recovered walk that nobody stopped: if the
 * background source is still running the walk is genuinely live (now);
 * otherwise the app was killed and the last persisted moment / GPS point is
 * the last time we know the walk was being recorded.
 */
export function recoveredEndAt(session: RecoveredWalkSession, now = Date.now()): number {
  if (session.stoppedAt !== null) return session.stoppedAt;
  if (session.locationRunning) return now;
  const lastPointT = session.acc.path.length
    ? session.acc.path[session.acc.path.length - 1].t
    : 0;
  const last = Math.max(session.updatedAt ?? 0, lastPointT, session.startedAt);
  return Math.min(now, last);
}

export function scorableSnapshotOf(
  pet:
    | {
        species: Species;
        weightKg?: number | null;
        breed?: string | null;
        birthday?: { toMillis(): number } | null;
      }
    | null
    | undefined,
): ScorableSnapshot | null {
  if (!pet) return null;
  let birthdayMs: number | null = null;
  try {
    birthdayMs = pet.birthday ? pet.birthday.toMillis() : null;
  } catch {
    birthdayMs = null;
  }
  return {
    species: pet.species,
    weightKg: pet.weightKg ?? null,
    breed: pet.breed ?? null,
    birthdayMs: Number.isFinite(birthdayMs) ? birthdayMs : null,
  };
}

/** Rehydrate a snapshot into the structural pet the score formula reads. */
export function scorablePetOf(snapshot: ScorableSnapshot | null): ScorablePet | null {
  if (!snapshot) return null;
  const birthdayMs = snapshot.birthdayMs;
  return {
    species: snapshot.species,
    weightKg: snapshot.weightKg,
    breed: snapshot.breed,
    birthday: birthdayMs !== null ? { toMillis: () => birthdayMs } : null,
  };
}

/** Duration (min, 2dp, capped at RUNAWAY_CAP_MIN) of a session at `now`. */
export function sessionDurationMin(session: ActiveWalkSession, now = Date.now()): number {
  const end = session.stoppedAt ?? now;
  const pausedTotal =
    session.pausedMs + (session.pausedSince !== null ? Math.max(0, end - session.pausedSince) : 0);
  const elapsedMs = Math.max(0, end - session.startedAt - pausedTotal);
  const min = Math.round((elapsedMs / 60_000) * 100) / 100;
  return Math.min(RUNAWAY_CAP_MIN, min);
}

/** Final numbers for a recovered (or just stopped) session. */
export function sessionFinalState(
  session: ActiveWalkSession,
  now = Date.now(),
): WalkTrackingState {
  const durationMin = sessionDurationMin(session, now);
  const capped = durationMin >= RUNAWAY_CAP_MIN;
  return {
    status: "idle",
    isTracking: false,
    isPaused: false,
    backgroundEnabled: session.backgroundMode,
    startedAt: new Date(session.startedAt),
    totalDistanceKm: session.acc.totalDistanceKm,
    durationMin,
    path: session.acc.path,
    errorKind: null,
    pausedMs: session.pausedMs,
    autoStopped: session.autoStopped || capped,
  };
}

/** Plain persisted record of a (possibly recovered) session. */
function recordOf(session: ActiveWalkSession): ActiveWalkSession {
  const { locationRunning: _running, ...rest } = session as RecoveredWalkSession;
  return { ...rest, acc: { ...rest.acc } };
}

// Module-level live record — shared by the service AND the headless task
// (same JS context while the app is alive; re-hydrated from AsyncStorage when
// iOS relaunches the app headlessly for a location batch).
let active: ActiveWalkSession | null = null;
/** Last fix with usable accuracy (weak-signal hint). Not persisted. */
let lastGoodFixAt = 0;

async function persistSession(): Promise<void> {
  try {
    if (active) {
      active.updatedAt = Date.now();
      await AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(active));
    }
    else await AsyncStorage.removeItem(SESSION_STORE_KEY);
  } catch {
    /* best-effort */
  }
}

async function hydrateSession(): Promise<void> {
  if (active) return;
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ActiveWalkSession;
    if (
      parsed &&
      parsed.v === 2 &&
      typeof parsed.uid === "string" &&
      typeof parsed.walkId === "string" &&
      typeof parsed.startedAt === "number" &&
      parsed.acc &&
      Array.isArray(parsed.acc.path)
    ) {
      // Another hydrate may have won the race while we awaited storage.
      if (!active) active = parsed;
    } else {
      await AsyncStorage.removeItem(SESSION_STORE_KEY);
    }
  } catch {
    /* best-effort */
  }
}

function stopBackgroundUpdates(): Promise<void> {
  return Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => {
    /* task not started / already stopped — fine */
  });
}

/** Feed raw fixes into the live session. Returns true when the path changed. */
function ingestLocations(locs: Location.LocationObject[]): boolean {
  const session = active;
  if (!session || session.stoppedAt !== null || session.pausedSince !== null) return false;
  let changed = false;
  for (const loc of locs) {
    const accuracy = loc.coords.accuracy ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(accuracy) && accuracy <= MIN_ACCEPTABLE_ACCURACY_M) {
      lastGoodFixAt = Date.now();
    }
    const next = addGpsSample(session.acc, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      t: loc.timestamp,
      accuracy,
    });
    if (next !== session.acc) {
      session.acc = next;
      changed = true;
    }
  }
  return changed;
}

// ── Headless background-location task ────────────────────────────────────
// Defined at module load (required by expo-task-manager). It runs even when
// the app is backgrounded/suspended-then-relaunched.
TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (!active) await hydrateSession();
  const session = active;
  if (!session || session.stoppedAt !== null) {
    // Orphaned updates (no live walk) — never leave background GPS running.
    await stopBackgroundUpdates();
    return;
  }
  // Runaway cap — enforced here too, because the foreground ticker does not
  // run while the app is suspended.
  if (session.pausedSince === null && sessionDurationMin(session) >= RUNAWAY_CAP_MIN) {
    session.stoppedAt = session.startedAt + session.pausedMs + RUNAWAY_CAP_MIN * 60_000;
    session.autoStopped = true;
    await persistSession();
    await stopBackgroundUpdates();
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
  if (ingestLocations(locations)) await persistSession();
});

/**
 * The persisted in-progress (or stopped-but-not-yet-drafted) walk, if any.
 * Also switches off background updates that have no session record (orphans
 * from a crash or an older build).
 */
export async function getActiveWalkSession(): Promise<RecoveredWalkSession | null> {
  await hydrateSession();
  void AsyncStorage.removeItem(LEGACY_BG_STORE_KEY).catch(() => {});
  let running = false;
  try {
    running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  } catch {
    running = false;
  }
  if (!active) {
    if (running) await stopBackgroundUpdates();
    return null;
  }
  return { ...active, acc: { ...active.acc }, locationRunning: running };
}

/** Drop the persisted session (another account's, or handed to a draft). */
export async function clearActiveWalkSession(walkId?: string): Promise<void> {
  await hydrateSession();
  if (active && walkId && active.walkId !== walkId) return;
  active = null;
  await stopBackgroundUpdates();
  await persistSession();
}

// ── Public service ───────────────────────────────────────────────────────
export type WalkTrackingStatus = "idle" | "starting" | "tracking" | "failed";

export type WalkTrackingErrorKind =
  | "permission_denied"
  /** Start failure (status "failed") or, while tracking, no usable fix for
   *  WEAK_SIGNAL_MS (web errWeak). */
  | "position_unavailable"
  /** Fallback mode only: the app was backgrounded, so distance was not
   *  recorded for that stretch (web errBackground; transient). */
  | "backgrounded"
  | null;

export type WalkTrackingState = {
  /** idle → starting (permission prompts / source spin-up) → tracking;
   *  failed = the location source could not start (or permission denied). */
  status: WalkTrackingStatus;
  isTracking: boolean;
  /** True while the USER has paused (web §A). Time + distance freeze. */
  isPaused: boolean;
  /** True when Always permission was granted → background recording is on. */
  backgroundEnabled?: boolean;
  startedAt: Date | null;
  totalDistanceKm: number;
  durationMin: number;
  path: WalkPathPoint[];
  errorKind: WalkTrackingErrorKind;
  /** Banked user-pause time (ms). */
  pausedMs: number;
  /** The 3h runaway cap ended the walk (web autoStopped). */
  autoStopped: boolean;
};

export type WalkTrackingListener = (state: WalkTrackingState) => void;

export function emptyTrackingState(): WalkTrackingState {
  return {
    status: "idle",
    isTracking: false,
    isPaused: false,
    backgroundEnabled: false,
    startedAt: null,
    totalDistanceKm: 0,
    durationMin: 0,
    path: [],
    errorKind: null,
    pausedMs: 0,
    autoStopped: false,
  };
}

export class WalkTrackingService {
  private state: WalkTrackingState = emptyTrackingState();
  private listeners = new Set<WalkTrackingListener>();
  private sub: Location.LocationSubscription | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundMode = false;
  private hiddenSince: number | null = null;
  private lastPersistAt = 0;
  /** Bumped by reset(); an in-flight start() whose generation changed
   *  releases whatever it started instead of tracking with no owner. */
  private generation = 0;
  /** The walk this service instance owns (only it may clear the record). */
  private walkId: string | null = null;

  on(listener: WalkTrackingListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): WalkTrackingState {
    return this.state;
  }

  private update(patch: Partial<WalkTrackingState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  /** Permission (foreground required, Always optional). null = foreground denied. */
  private async requestPermissions(): Promise<boolean | null> {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) return null;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      return bg.status === Location.PermissionStatus.GRANTED;
    } catch {
      return false;
    }
  }

  private async startSource(background: boolean): Promise<void> {
    if (background) {
      if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false)) {
        return; // a relaunched session's updates are still running
      }
      await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true, // expected blue bar during a walk
        pausesUpdatesAutomatically: false,
        // batch lightly; shared-business does the ≥5m / accuracy filtering
        deferredUpdatesInterval: 1000,
      });
    } else {
      // A resumed session whose Always permission was revoked must not keep a
      // background source feeding the same accumulator twice.
      await stopBackgroundUpdates();
      this.sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (loc) => this.handleFix(loc),
      );
    }
  }

  /**
   * Request permissions and begin a NEW walk for `identity`. Resolves `false`
   * when foreground permission is denied (errorKind permission_denied), the
   * source fails to start (status failed / position_unavailable) or the
   * service was reset meanwhile. Always-denied still tracks (fallback).
   */
  async start(identity: WalkSessionIdentity): Promise<boolean> {
    if (this.state.status === "tracking" || this.state.status === "starting") {
      return this.state.status === "tracking";
    }
    const gen = ++this.generation;
    this.walkId = identity.walkId;
    this.update({ ...emptyTrackingState(), status: "starting" });

    let always: boolean | null;
    try {
      always = await this.requestPermissions();
    } catch {
      always = null;
    }
    if (gen !== this.generation) return false;
    if (always === null) {
      this.update({ ...emptyTrackingState(), status: "failed", errorKind: "permission_denied" });
      return false;
    }

    const startedAt = Date.now();
    active = {
      v: 2,
      ...identity,
      startedAt,
      pausedMs: 0,
      pausedSince: null,
      backgroundMode: always,
      acc: emptyPathAccumulator(),
      stoppedAt: null,
      autoStopped: false,
    };
    await persistSession();
    if (gen !== this.generation) return false;
    return this.attach(gen, always);
  }

  /**
   * Re-attach to a persisted session after an app relaunch ("continue
   * walk"). Keeps startedAt, pauses and the accumulated path.
   */
  async resumeSession(session: ActiveWalkSession): Promise<boolean> {
    if (this.state.status === "tracking" || this.state.status === "starting") {
      return this.state.status === "tracking";
    }
    const gen = ++this.generation;
    this.walkId = session.walkId;
    this.update({ ...emptyTrackingState(), status: "starting" });

    let always: boolean | null;
    try {
      always = await this.requestPermissions();
    } catch {
      always = null;
    }
    if (gen !== this.generation) return false;
    if (always === null) {
      this.update({ ...emptyTrackingState(), status: "failed", errorKind: "permission_denied" });
      return false;
    }
    await hydrateSession();
    if (gen !== this.generation) return false;
    if (!active || active.walkId !== session.walkId) active = recordOf(session);
    active.stoppedAt = null;
    active.autoStopped = false;
    // Always may have been revoked meanwhile → fall back to the foreground source.
    active.backgroundMode = always;
    await persistSession();
    if (gen !== this.generation) return false;
    // A resumed walk keeps its record on failure so the caller can still
    // end & save what was recorded.
    return this.attach(gen, always, true);
  }

  private async attach(
    gen: number,
    background: boolean,
    keepRecordOnFailure = false,
  ): Promise<boolean> {
    const session = active;
    if (!session) return false;
    this.backgroundMode = background;
    try {
      await this.startSource(background);
    } catch {
      if (gen === this.generation) {
        this.teardown();
        if (!keepRecordOnFailure) {
          active = null;
          await persistSession();
        }
        this.update({ ...emptyTrackingState(), status: "failed", errorKind: "position_unavailable" });
      }
      return false;
    }
    if (gen !== this.generation) {
      // reset() ran while the source was starting — release it, no owner.
      this.teardown();
      return false;
    }

    lastGoodFixAt = Date.now();
    this.ticker = setInterval(() => this.tick(), 1000);
    this.appStateSub = AppState.addEventListener("change", (next) => this.handleAppState(next));
    this.update({
      status: "tracking",
      isTracking: true,
      isPaused: session.pausedSince !== null,
      backgroundEnabled: background,
      startedAt: new Date(session.startedAt),
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      durationMin: sessionDurationMin(session),
      pausedMs: session.pausedMs,
      errorKind: null,
      autoStopped: false,
    });
    return true;
  }

  /** User taps 暫停 (web §A) — freezes time and distance. */
  pause(): void {
    const session = active;
    if (this.state.status !== "tracking" || this.state.isPaused || !session) return;
    session.pausedSince = Date.now();
    this.clearHint();
    void persistSession();
    this.update({ isPaused: true, errorKind: null });
  }

  /** User taps 繼續 — banks the pause into pausedMs. */
  resume(): void {
    const session = active;
    if (this.state.status !== "tracking" || !this.state.isPaused || !session) return;
    if (session.pausedSince !== null) {
      session.pausedMs += Date.now() - session.pausedSince;
      session.pausedSince = null;
    }
    lastGoodFixAt = Date.now();
    void persistSession();
    this.update({ isPaused: false, errorKind: null, pausedMs: session.pausedMs });
  }

  /** Fallback-mode fix handler (foreground watchPositionAsync). */
  private handleFix(loc: Location.LocationObject) {
    const session = active;
    if (!session || this.state.isPaused) return;
    const changed = ingestLocations([loc]);
    if (this.state.errorKind === "backgrounded") {
      // A real foreground sample means we're recording again.
      this.clearHint();
      this.update({ errorKind: null });
    }
    if (!changed) return;
    this.update({ path: session.acc.path, totalDistanceKm: session.acc.totalDistanceKm });
    const now = Date.now();
    if (now - this.lastPersistAt >= PERSIST_THROTTLE_MS) {
      this.lastPersistAt = now;
      void persistSession();
    }
  }

  /** 1s tick — wall-clock duration minus user pauses, path/distance from the
   *  live accumulator, runaway cap and the weak-signal hint. */
  private tick() {
    const session = active;
    if (!session || this.state.status !== "tracking") return;
    if (session.stoppedAt !== null && session.autoStopped) {
      // The headless task hit the cap while we were suspended.
      this.finishAutoStop();
      return;
    }
    const now = Date.now();
    const durationMin = sessionDurationMin(session, now);
    if (durationMin >= RUNAWAY_CAP_MIN && !this.state.autoStopped) {
      session.stoppedAt = session.startedAt + session.pausedMs + RUNAWAY_CAP_MIN * 60_000;
      session.autoStopped = true;
      this.finishAutoStop();
      return;
    }
    let errorKind = this.state.errorKind;
    if (!this.state.isPaused && errorKind !== "backgrounded") {
      const weak = now - lastGoodFixAt > WEAK_SIGNAL_MS;
      if (weak && errorKind === null) errorKind = "position_unavailable";
      else if (!weak && errorKind === "position_unavailable") errorKind = null;
    }
    this.update({
      durationMin,
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      errorKind,
    });
  }

  private handleAppState(next: AppStateStatus) {
    if (this.state.status !== "tracking") return;
    if (next !== "active") {
      if (this.hiddenSince === null) this.hiddenSince = Date.now();
      // Flush the latest path so an eviction while hidden loses nothing.
      void persistSession();
      return;
    }
    const hiddenFor = this.hiddenSince !== null ? Date.now() - this.hiddenSince : 0;
    this.hiddenSince = null;
    // The ticker is suspended in the background — catch up immediately.
    this.tick();
    if (this.state.status !== "tracking") return;
    if (!this.backgroundMode && !this.state.isPaused && hiddenFor >= BG_HINT_MIN_MS) {
      this.clearHint();
      this.update({ errorKind: "backgrounded" });
      this.hintTimer = setTimeout(() => {
        this.hintTimer = null;
        if (this.state.errorKind === "backgrounded") this.update({ errorKind: null });
      }, BG_HINT_TTL_MS);
    }
  }

  private clearHint() {
    if (this.hintTimer) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
  }

  /** Stop ticker, AppState listener and the location source (fire-and-forget
   *  for the async native stop so `stop()` stays synchronous). */
  private teardown(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    this.clearHint();
    this.hiddenSince = null;
    if (this.sub) {
      this.sub.remove();
      this.sub = null;
    }
    void stopBackgroundUpdates();
  }

  private finishAutoStop(): void {
    const session = active;
    this.teardown();
    if (!session) return;
    if (session.pausedSince !== null) {
      session.pausedMs += Math.max(0, (session.stoppedAt ?? Date.now()) - session.pausedSince);
      session.pausedSince = null;
    }
    void persistSession();
    this.update({
      status: "idle",
      isTracking: false,
      isPaused: false,
      durationMin: RUNAWAY_CAP_MIN,
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      pausedMs: session.pausedMs,
      errorKind: null,
      autoStopped: true,
    });
  }

  /**
   * Stop tracking (session-only: background location turns OFF here) and
   * return the final state for the screen to persist as a walk doc. Stays
   * SYNCHRONOUS. The persisted record is kept, marked stopped, until the view
   * hands the walk to a local draft (`clearPersistedSession`).
   */
  stop(): WalkTrackingState {
    const session = active;
    this.teardown();
    if (!session || (this.walkId && session.walkId !== this.walkId)) {
      this.update({ status: "idle", isTracking: false, isPaused: false });
      return this.state;
    }
    const now = Date.now();
    if (session.stoppedAt === null) session.stoppedAt = now;
    if (session.pausedSince !== null) {
      session.pausedMs += Math.max(0, session.stoppedAt - session.pausedSince);
      session.pausedSince = null;
    }
    const durationMin = sessionDurationMin(session, now);
    if (durationMin >= RUNAWAY_CAP_MIN) session.autoStopped = true;
    void persistSession();
    this.update({
      status: "idle",
      isTracking: false,
      isPaused: false,
      durationMin,
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      pausedMs: session.pausedMs,
      errorKind: null,
      autoStopped: session.autoStopped,
    });
    return this.state;
  }

  /**
   * Take ownership of a recovered session WITHOUT starting a location source
   * ("end & save" after a relaunch). `endAt` freezes the end time when nobody
   * stopped it; a following `stop()` returns its final numbers.
   */
  adopt(session: ActiveWalkSession, endAt?: number): void {
    this.generation += 1;
    this.teardown();
    this.walkId = session.walkId;
    if (!active || active.walkId !== session.walkId) active = recordOf(session);
    if (active.stoppedAt === null && typeof endAt === "number") {
      active.stoppedAt = Math.max(active.startedAt, endAt);
    }
    const final = sessionFinalState(active);
    this.update({ ...final, status: "idle" });
  }

  /** The walk is safely in a local draft — drop the session record. */
  clearPersistedSession(): void {
    if (active && this.walkId && active.walkId === this.walkId) {
      active = null;
      void persistSession();
    }
  }

  /** Abandon/close: stop everything, drop this service's session record. */
  reset(): void {
    this.generation += 1;
    this.teardown();
    if (active && this.walkId && active.walkId === this.walkId) {
      active = null;
      void persistSession();
    }
    this.walkId = null;
    this.backgroundMode = false;
    this.state = emptyTrackingState();
    for (const l of this.listeners) l(this.state);
  }
}
