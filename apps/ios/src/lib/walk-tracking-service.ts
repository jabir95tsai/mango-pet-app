/**
 * Walk tracking service — native counterpart of the web `WalkSession`
 * (apps/web/src/lib/walk-tracking.ts). All path math (Haversine,
 * accuracy/min-distance filtering, complete segmented route accumulation) is
 * delegated to `@mango/shared-business` so iOS + web sample identically.
 *
 * Two location sources:
 *
 *  • Background mode (any location permission — "While Using" suffices because
 *    the walk is always started from the foreground) — the killer iOS ability.
 *    `Location.startLocationUpdatesAsync` + a headless TaskManager task, so the
 *    route keeps recording while the phone is locked / the app is backgrounded.
 *    The iOS blue location indicator is expected (only on during a walk).
 *
 *  • Foreground fallback (timing-only / legacy) — `watchPositionAsync`; distance is
 *    not recorded while the app is backgrounded (a transient "backgrounded"
 *    hint is shown on return, web errBackground).
 *
 * Duration semantics are web §A/§B in BOTH modes: wall-clock time counts
 * (background / lock-screen included); only the user's own pauses
 * (`pause()` / `resume()`) are subtracted, and a 6h runaway cap auto-stops a
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
  addRouteSample,
  interruptRoute,
  emptyRouteAccumulator,
  WALK_ROUTE_LIMIT_MS,

  MIN_ACCEPTABLE_ACCURACY_M,
  type RouteAccumulator,
  type ScorablePet,
} from "@mango/shared-business";
import type { Species, WalkPathPoint, WalkRoutePoint } from "@mango/shared-types";

import auth from "@react-native-firebase/auth";
import { queueRouteSnapshot, syncRoute, stopRoutePublishing, resumeRoutePublishing, type RouteSnapshot } from "./walk-route-api";
import { showWalkReturnReminder, clearWalkReturnReminder, requestWalkReminderPermission } from "./walk-route-notifications";

// ── Tunables (web walk-tracking.ts parity) ───────────────────────────────
/** Runaway safeguard (web RUNAWAY_CAP_MIN): auto-stop at 6 hours. */
export const RUNAWAY_CAP_MIN = 360;
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
  shareLive?: boolean;
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
  acc: RouteAccumulator;
  routeVersion?: 1;
  timingOnly?: boolean;
  notificationClaimed?: boolean;
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

/** Wall-clock ms of a session at `now`, minus user pauses (not capped). */
function sessionElapsedMs(session: ActiveWalkSession, now: number): number {
  const end = Math.min(session.stoppedAt ?? now, session.startedAt + WALK_ROUTE_LIMIT_MS);
  const pausedTotal =
    session.pausedMs + (session.pausedSince !== null ? Math.max(0, end - session.pausedSince) : 0);
  return Math.max(0, end - session.startedAt - pausedTotal);
}

/** Duration (min, 2dp, capped at RUNAWAY_CAP_MIN) of a session at `now`. */
export function sessionDurationMin(session: ActiveWalkSession, now = Date.now()): number {
  const min = Math.floor((sessionElapsedMs(session, now) / 60_000) * 100) / 100;
  return Math.min(RUNAWAY_CAP_MIN, min);
}

/** Whole seconds for the live mm:ss timer — durationMin's 0.01-min (0.6 s) steps make it skip/stall. */
export function sessionDurationSec(session: ActiveWalkSession, now = Date.now()): number {
  return Math.min(RUNAWAY_CAP_MIN * 60, Math.floor(sessionElapsedMs(session, now) / 1000));
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
    durationSec: sessionDurationSec(session, now),
    path: session.acc.path,
    errorKind: null,
    pausedMs: session.pausedMs,
    autoStopped: session.autoStopped || capped,
    route: routeSnapshot(session),
    reminderShown: session.acc.reminderShown,
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

let sessionWrites: Promise<unknown> = Promise.resolve();
function sessionKey(uid:string) { return `${SESSION_STORE_KEY}.${uid}`; }
export function routeSnapshot(session:ActiveWalkSession):RouteSnapshot | undefined {
  if(session.routeVersion!==1)return undefined;
  return {uid:session.uid,walkId:session.walkId,petId:session.petId,familyId:session.familyId,startedAt:session.startedAt,shareLive:session.shareLive,stoppedAt:session.stoppedAt,path:session.acc.path};
}
async function persistSession(): Promise<void> {
  const session=active; if(!session)return;
  session.updatedAt=Date.now();
  const raw=JSON.stringify(session);
  const write=sessionWrites.catch(()=>{}).then(()=>AsyncStorage.setItem(sessionKey(session.uid),raw));
  sessionWrites=write;await write;
  const snapshot=routeSnapshot(session);
  if(snapshot)await queueRouteSnapshot(snapshot);
}
async function syncActive(session:ActiveWalkSession):Promise<void>{
 if(session.routeVersion!==1)return;
 await persistSession();
 const point=session.acc.latestPoint;
 if(session.acc.reminderShown && !session.notificationClaimed && session.stoppedAt===null){
  session.notificationClaimed=true;
  await persistSession(); // claim BEFORE delivery: never duplicate after a crash
  await showWalkReturnReminder(session.uid,session.walkId,()=>active===session && session.stoppedAt===null && Date.now()<session.startedAt+WALK_ROUTE_LIMIT_MS).catch(()=>{});
 }
 await syncRoute(session.uid,session.walkId,session.stoppedAt===null?point:undefined).catch(()=>{});
}

async function hydrateSession(): Promise<void> {
  const uid=auth().currentUser?.uid;
  if(active && active.uid===uid)return;
  if(active && active.uid!==uid){await stopBackgroundUpdates();active=null;}
  if(!uid)return;
  try {
    const raw = await AsyncStorage.getItem(sessionKey(uid)) ?? await AsyncStorage.getItem(SESSION_STORE_KEY);
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
      if(parsed.uid!==uid)return;
      // Older v2 sessions remain legacy; do not claim truncated paths complete.
      parsed.acc={...emptyRouteAccumulator(),...parsed.acc,path:parsed.acc.path.map(p=>({...p,segment:p.segment??0}))};
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
  if (!session || session.stoppedAt !== null || session.pausedSince !== null || auth().currentUser?.uid!==session.uid) return false;
  let changed = false;
  for (const loc of locs) {
    if(loc.timestamp>Date.now())continue;
    const accuracy = loc.coords.accuracy ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(accuracy) && accuracy <= MIN_ACCEPTABLE_ACCURACY_M) {
      lastGoodFixAt = Date.now();
    }
    const next = addRouteSample(session.acc, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      t: loc.timestamp,
      accuracy,
    }, session.startedAt);
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
  if (!session || session.stoppedAt !== null || auth().currentUser?.uid!==session.uid) {
    // Orphaned updates (no live walk) — never leave background GPS running.
    await stopBackgroundUpdates();
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
  // Runaway cap — enforced here too, because the foreground ticker does not
  // run while the app is suspended.
  if (Date.now() >= session.startedAt + WALK_ROUTE_LIMIT_MS) {
    ingestLocations(locations);
    session.stoppedAt = session.startedAt + WALK_ROUTE_LIMIT_MS;
    session.autoStopped = true;
    stopRoutePublishing(session.uid,session.walkId,session.stoppedAt??undefined);
    await persistSession();
    await stopBackgroundUpdates();
    void clearWalkReturnReminder(session.walkId);
    await syncActive(session);
    return;
  }
  if (ingestLocations(locations)) await syncActive(session);
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
  const previous=active; active = null;
  await stopBackgroundUpdates();
  await sessionWrites.catch(()=>{});
  if(previous)await AsyncStorage.removeItem(sessionKey(previous.uid));
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
  /** True when the background source is on (any location permission). */
  backgroundEnabled?: boolean;
  startedAt: Date | null;
  totalDistanceKm: number;
  durationMin: number;
  /** Exact whole seconds for the live timer display. */
  durationSec: number;
  path: WalkPathPoint[];
  errorKind: WalkTrackingErrorKind;
  /** Banked user-pause time (ms). */
  pausedMs: number;
  /** The 6h runaway cap ended the walk (web autoStopped). */
  autoStopped: boolean;
  route?: RouteSnapshot;
  reminderShown?: boolean;
  timingOnly?: boolean;
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
    durationSec: 0,
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

  /**
   * Foreground permission is enough for background recording: iOS keeps
   * `startLocationUpdatesAsync` (UIBackgroundModes=location) running after the
   * app leaves the foreground when it was started in the foreground, even
   * under "While Using". Always is still requested (optional). null = denied.
   */
  private async requestPermissions(): Promise<boolean | null> {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) return null;
    await Location.requestBackgroundPermissionsAsync().catch(() => {});
    return true;
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
   * service was reset meanwhile. "While Using" still records in the background.
   */
  async start(identity: WalkSessionIdentity, timingOnly = false): Promise<boolean> {
    if (this.state.status === "tracking" || this.state.status === "starting") {
      return this.state.status === "tracking";
    }
    const gen = ++this.generation;
    this.walkId = identity.walkId;
    this.update({ ...emptyTrackingState(), status: "starting" });

    let always: boolean | null;
    try {
      always = timingOnly ? false : await this.requestPermissions();
    } catch {
      always = null;
    }
    if (gen !== this.generation) return false;
    if (always === null) {
      this.update({ ...emptyTrackingState(), status: "failed", errorKind: "permission_denied" });
      return false;
    }

    void requestWalkReminderPermission();
    const startedAt = Date.now();
    active = {
      v: 2,
      ...identity,
      shareLive: timingOnly ? false : identity.shareLive,
      timingOnly,
      startedAt,
      pausedMs: 0,
      pausedSince: null,
      backgroundMode: always,
      acc: emptyRouteAccumulator(),
      routeVersion: 1,
      stoppedAt: null,
      autoStopped: false,
    };
    await persistSession();
    if (gen !== this.generation) return false;
    void syncActive(active).catch(()=>{});
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
    if(session.stoppedAt!==null || Date.now()>=session.startedAt+WALK_ROUTE_LIMIT_MS)return false;
    const gen = ++this.generation;
    this.walkId = session.walkId;
    this.update({ ...emptyTrackingState(), status: "starting" });

    let always: boolean | null;
    try {
      always = session.timingOnly ? false : await this.requestPermissions();
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
    resumeRoutePublishing(active.uid,active.walkId);
    active.acc=interruptRoute(active.acc);
    active.stoppedAt = null;
    active.autoStopped = false;
    // Any location permission keeps the background source (see requestPermissions).
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
      if(!session.timingOnly)await this.startSource(background);
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
    // 500ms: a 1s interval drifts against the second boundary and can skip a second.
    this.ticker = setInterval(() => this.tick(), 500);
    this.appStateSub = AppState.addEventListener("change", (next) => this.handleAppState(next));
    this.update({
      status: "tracking",
      isTracking: true,
      isPaused: session.pausedSince !== null,
      backgroundEnabled: background,
      timingOnly: session.timingOnly,
      startedAt: new Date(session.startedAt),
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      durationMin: sessionDurationMin(session),
      durationSec: sessionDurationSec(session),
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
    session.acc=interruptRoute(session.acc);
    session.pausedSince = Date.now();
    this.clearHint();
    void persistSession().catch(()=>{});
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
    void persistSession().catch(()=>{});
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
    if (now - this.lastPersistAt >= PERSIST_THROTTLE_MS || session.acc.reminderShown) {
      this.lastPersistAt = now;
      void syncActive(session).catch(()=>{});
    }
  }

  /** 1s tick — wall-clock duration minus user pauses, path/distance from the
   *  live accumulator, runaway cap and the weak-signal hint. */
  private tick() {
    const session = active;
    if (!session || this.state.status !== "tracking") return;
    if(auth().currentUser?.uid!==session.uid){this.reset();return;}
    if (session.stoppedAt !== null && session.autoStopped) {
      // The headless task hit the cap while we were suspended.
      this.finishAutoStop();
      return;
    }
    const now = Date.now();
    const durationMin = sessionDurationMin(session, now);
    if (now >= session.startedAt + WALK_ROUTE_LIMIT_MS && !this.state.autoStopped) {
      session.stoppedAt = session.startedAt + WALK_ROUTE_LIMIT_MS;
      session.autoStopped = true;
      this.finishAutoStop();
      return;
    }
    let errorKind = this.state.errorKind;
    if (!session.timingOnly && !this.state.isPaused && errorKind !== "backgrounded") {
      const weak = now - lastGoodFixAt > WEAK_SIGNAL_MS;
      if (weak && errorKind === null) errorKind = "position_unavailable";
      else if (!weak && errorKind === "position_unavailable") errorKind = null;
    }
    this.update({
      durationMin,
      durationSec: sessionDurationSec(session, now),
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      errorKind,
      reminderShown: session.acc.reminderShown,
    });
  }

  private handleAppState(next: AppStateStatus) {
    if (this.state.status !== "tracking") return;
    if (next !== "active") {
      if (this.hiddenSince === null) this.hiddenSince = Date.now();
      // Flush the latest path so an eviction while hidden loses nothing.
      void persistSession().catch(()=>{});
      return;
    }
    const hiddenFor = this.hiddenSince !== null ? Date.now() - this.hiddenSince : 0;
    this.hiddenSince = null;
    // The ticker is suspended in the background — catch up immediately.
    this.tick();
    if (this.state.status !== "tracking") return;
    if (!this.backgroundMode && !this.state.isPaused && hiddenFor >= BG_HINT_MIN_MS) {
      if(active)active.acc=interruptRoute(active.acc);
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
    stopRoutePublishing(session.uid,session.walkId,session.stoppedAt??undefined);
    void clearWalkReturnReminder(session.walkId);
    void syncActive(session).catch(()=>{});
    if (session.pausedSince !== null) {
      session.pausedMs += Math.max(0, (session.stoppedAt ?? Date.now()) - session.pausedSince);
      session.pausedSince = null;
    }
    void persistSession().catch(()=>{});
    this.update({
      status: "idle",
      isTracking: false,
      isPaused: false,
      durationMin: sessionDurationMin(session),
      path: session.acc.path,
      totalDistanceKm: session.acc.totalDistanceKm,
      pausedMs: session.pausedMs,
      errorKind: null,
      autoStopped: true,
      route: routeSnapshot(session),
      reminderShown: session.acc.reminderShown,
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
    if (session.stoppedAt === null) session.stoppedAt = Math.min(now,session.startedAt+WALK_ROUTE_LIMIT_MS);
    stopRoutePublishing(session.uid,session.walkId,session.stoppedAt??undefined);
    void clearWalkReturnReminder(session.walkId);
    if (session.pausedSince !== null) {
      session.pausedMs += Math.max(0, session.stoppedAt - session.pausedSince);
      session.pausedSince = null;
    }
    void syncActive(session).catch(()=>{});
    const durationMin = sessionDurationMin(session, now);
    if (now>=session.startedAt+WALK_ROUTE_LIMIT_MS) session.autoStopped = true;
    void persistSession().catch(()=>{});
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
      route: routeSnapshot(session),
      reminderShown: session.acc.reminderShown,
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
      active.stoppedAt = Math.min(active.startedAt+WALK_ROUTE_LIMIT_MS,Math.max(active.startedAt, endAt));
    }
    const final = sessionFinalState(active);
    this.update({ ...final, status: "idle" });
  }

  /** The walk is safely in a local draft — drop the session record. */
  clearPersistedSession(): void {
    if (active && this.walkId && active.walkId === this.walkId) {
      const previous=active;
      active = null;
      void sessionWrites.catch(()=>{}).then(()=>AsyncStorage.removeItem(sessionKey(previous.uid)));
    }
  }

  /** Abandon/close: stop everything, drop this service's session record. */
  reset(): void {
    this.generation += 1;
    this.teardown();
    if (active && this.walkId && active.walkId === this.walkId) {
      const previous=active;
      if(previous.stoppedAt===null)previous.acc=interruptRoute(previous.acc);
      void persistSession().catch(()=>{});
      stopRoutePublishing(previous.uid,previous.walkId);
      active = null;
    }
    this.walkId = null;
    this.backgroundMode = false;
    this.state = emptyTrackingState();
    for (const l of this.listeners) l(this.state);
  }
}
