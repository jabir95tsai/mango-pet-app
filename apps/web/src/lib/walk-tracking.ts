"use client";

import type { Timestamp } from "firebase/firestore";
import type { Walk, WalkPathPoint } from "./types";
// Haversine distance + GPS sample filtering moved to @mango/shared-business
// so web (watchPosition) and iOS (expo-location) sample identically.
import { addGpsSample } from "@mango/shared-business";

/** Geolocation API error codes (W3C). */
const GEO_PERMISSION_DENIED = 1;
const GEO_POSITION_UNAVAILABLE = 2;
const GEO_TIMEOUT = 3;

/** Runaway safeguard (spec §B / B-1): with background no longer auto-pausing
 *  the timer, a user who forgets to stop could rack up hours of phantom
 *  duration. At this cap the session auto-stops and flags `autoStopped` so the
 *  view can surface a "還在散步嗎?" notice. */
const RUNAWAY_CAP_MIN = 180; // 3 hours

/** Below this, a background interval is too short to plausibly have dropped
 *  GPS distance — don't nag the user with the "no distance in background"
 *  hint for a quick tab-switch. */
const BG_HINT_MIN_MS = 3000;
/** How long the transient background hint stays up after returning. */
const BG_HINT_TTL_MS = 6000;

export type WalkErrorKind =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "backgrounded"
  | "unknown";

export type WalkSessionState = {
  isTracking: boolean;
  /** True while the USER has manually paused (spec §A). Time + GPS distance
   *  both freeze. (Previously this meant "tab backgrounded" — §B removed the
   *  auto-background-pause; the timer now runs wall-clock in the background.) */
  isPaused: boolean;
  startedAt: Date | null;
  totalDistanceKm: number;
  durationMin: number;
  path: WalkPathPoint[];
  lastError: string | null;
  errorKind: WalkErrorKind | null;
  /** Total ms spent in user-initiated pauses — subtracted from wall-clock
   *  duration. (Replaces the old `hiddenMs`, which subtracted background
   *  time; §B no longer does that.) */
  pausedMs: number;
  /** Set true once the runaway-cap (3h) auto-stop fired. The view shows a
   *  "還在散步嗎?" notice and moves to the done screen. */
  autoStopped: boolean;
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
    pausedMs: 0,
    autoStopped: false,
  };
}

export class WalkSession {
  private watchId: number | null = null;
  private state: WalkSessionState = emptyState();
  private listeners = new Set<WalkSessionListener>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** ms when the user last hit pause, or null when not paused. Drives the
   *  pausedMs accumulation on resume + freezes the duration tick meanwhile. */
  private pausedSince: number | null = null;
  /** ms when the tab was last hidden, or null if visible. §B: used ONLY to
   *  decide whether to show the "no distance in background" hint on return —
   *  it no longer affects duration. */
  private hiddenSince: number | null = null;
  /** Auto-clear timer for the transient background hint. */
  private bgHintTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null;
  private resumeHandler: (() => void) | null = null;
  /** Screen Wake Lock — keeps the device from auto-locking during a walk.
   *  Without this, phones sleep after their idle timeout (~30s default on
   *  iOS), the browser suspends the tab, and `watchPosition` stops firing
   *  → walks silently lose path / distance for the duration of the lock.
   *  The OS-level lock auto-releases when the tab is hidden, so we
   *  re-acquire on visibilitychange. Falls back to the existing
   *  "請保持畫面開啟" warning on browsers without the Wake Lock API. */
  private wakeLock: WakeLockSentinel | null = null;
  private wakeLockRequestSeq = 0;
  private wakeLockRetryTimers = new Set<ReturnType<typeof setTimeout>>();

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
      // §B: wall-clock duration — background/lock-screen time COUNTS. Only the
      // user's own manual pauses are subtracted (pausedMs + the in-flight pause
      // interval, which keeps the readout frozen while paused).
      const pausedTotal =
        this.state.pausedMs +
        (this.pausedSince ? Date.now() - this.pausedSince : 0);
      const elapsedMs =
        Date.now() - this.state.startedAt.getTime() - pausedTotal;
      const durationMin = Math.max(0, Math.round((elapsedMs / 60_000) * 100) / 100);

      // Runaway safeguard (§B / B-1): cap at 3h and auto-stop so a forgotten
      // session can't inflate duration (and thus leaderboard score).
      if (durationMin >= RUNAWAY_CAP_MIN && !this.state.autoStopped) {
        this.update({ durationMin: RUNAWAY_CAP_MIN });
        this.autoStop();
        return;
      }
      this.update({ durationMin });
    }, 1000);

    // §B: hidden/background no longer pauses the timer. These handlers now only
    // manage the wake lock + the transient "no distance in background" hint.
    if (typeof document !== "undefined") {
      this.visibilityHandler = () => this.handleVisibilityChange();
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
    if (typeof window !== "undefined") {
      this.pageHideHandler = () => this.handlePageHidden();
      this.resumeHandler = () => this.handlePageVisible();
      window.addEventListener("pagehide", this.pageHideHandler);
      window.addEventListener("pageshow", this.resumeHandler);
      window.addEventListener("focus", this.resumeHandler);
      window.addEventListener("pointerdown", this.resumeHandler);
      window.addEventListener("touchstart", this.resumeHandler);
    }

    // Request screen wake lock so the phone stays awake for the whole walk.
    // Best-effort: unsupported browsers (iOS < 16.4, older Android) fall
    // through to the existing background-pause warning. Fire-and-forget
    // — we don't want to delay start() if this races.
    void this.requestWakeLock();
  }

  /** User taps "暫停" (spec §A). Freezes the duration tick (via pausedSince)
   *  and stops distance accumulation (handlePosition early-returns while
   *  paused). Releases the wake lock so the phone can sleep during the break. */
  pause(): void {
    if (!this.state.isTracking || this.state.isPaused) return;
    this.pausedSince = Date.now();
    this.clearWakeLockRetryTimers();
    this.clearBgHint();
    void this.releaseWakeLock();
    this.update({ isPaused: true, lastError: null, errorKind: null });
  }

  /** User taps "繼續". Banks the elapsed pause into pausedMs and re-acquires
   *  the wake lock so the screen stays awake again. */
  resume(): void {
    if (!this.state.isTracking || !this.state.isPaused) return;
    if (this.pausedSince !== null) {
      this.update({
        pausedMs: this.state.pausedMs + (Date.now() - this.pausedSince),
      });
      this.pausedSince = null;
    }
    this.update({ isPaused: false, lastError: null, errorKind: null });
    this.scheduleWakeLockReacquire();
  }

  private clearBgHint(): void {
    if (this.bgHintTimer) {
      clearTimeout(this.bgHintTimer);
      this.bgHintTimer = null;
    }
  }

  private clearWakeLockRetryTimers(): void {
    for (const timer of this.wakeLockRetryTimers) {
      clearTimeout(timer);
    }
    this.wakeLockRetryTimers.clear();
  }

  private scheduleWakeLockReacquire(): void {
    this.clearWakeLockRetryTimers();
    const delays = [0, 750, 2500];
    delays.forEach((delay, idx) => {
      const timer = setTimeout(() => {
        this.wakeLockRetryTimers.delete(timer);
        if (!this.state.isTracking) return;
        if (typeof document !== "undefined" && document.hidden) return;
        if (this.wakeLock && idx > 0) return;
        void this.requestWakeLock({ force: idx === 0 });
      }, delay);
      this.wakeLockRetryTimers.add(timer);
    });
  }

  private async requestWakeLock(options?: { force?: boolean }): Promise<void> {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    if (typeof document !== "undefined" && document.hidden) return;
    // Don't fight the user's pause — a paused walk should let the screen sleep.
    if (this.state.isPaused) return;
    const staleLock = this.wakeLock;
    if (staleLock && !options?.force) return;
    this.wakeLock = null;
    if (staleLock) {
      try {
        await staleLock.release();
      } catch {
        /* stale lock may already be released by the OS — ignore */
      }
    }
    const requestSeq = ++this.wakeLockRequestSeq;
    try {
      const lock = await navigator.wakeLock.request("screen");
      const hidden = typeof document !== "undefined" && document.hidden;
      if (!this.state.isTracking || hidden || requestSeq !== this.wakeLockRequestSeq) {
        await lock.release();
        return;
      }
      this.wakeLock = lock;
      // The OS releases the lock automatically when the tab is hidden,
      // when the page is unloaded, or when the user dismisses it via
      // system UI. Clearing the field so the next visibilitychange
      // re-acquire path runs cleanly.
      lock.addEventListener("release", () => {
        if (this.wakeLock === lock) this.wakeLock = null;
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
    this.wakeLockRequestSeq += 1;
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
      this.handlePageHidden();
    } else {
      this.handlePageVisible();
    }
  }

  private handlePageHidden() {
    if (!this.state.isTracking) return;
    // §B: do NOT pause the timer — wall-clock keeps running in the background.
    // We only release the wake lock (the OS does this anyway) and note when we
    // went hidden so we can hint about the GPS gap on return.
    this.clearWakeLockRetryTimers();
    if (this.hiddenSince === null) this.hiddenSince = Date.now();
    void this.releaseWakeLock();
  }

  private handlePageVisible() {
    if (!this.state.isTracking) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const wasHiddenFor =
      this.hiddenSince !== null ? Date.now() - this.hiddenSince : 0;
    this.hiddenSince = null;

    // §B: distance can't accumulate while watchPosition is suspended in the
    // background (existing web GPS limit), but time DID keep counting. Surface
    // a transient hint so the user understands the km didn't move. Skipped
    // while manually paused (that state owns the messaging).
    if (wasHiddenFor > BG_HINT_MIN_MS && !this.state.isPaused) {
      this.update({ lastError: null, errorKind: "backgrounded" });
      this.clearBgHint();
      this.bgHintTimer = setTimeout(() => {
        this.bgHintTimer = null;
        if (this.state.errorKind === "backgrounded") {
          this.update({ errorKind: null, lastError: null });
        }
      }, BG_HINT_TTL_MS);
    }

    // Wake Lock auto-releases on hide; re-acquire (unless the user paused).
    // iOS/PWA restore can run before Wake Lock is requestable, so retry a few.
    if (!this.state.isPaused) this.scheduleWakeLockReacquire();
  }

  /** Tear down watch / ticker / listeners / wake lock + timers. Shared by the
   *  user-initiated `stop()` and the runaway `autoStop()`. */
  private teardown(): void {
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
    if (typeof window !== "undefined") {
      if (this.pageHideHandler) {
        window.removeEventListener("pagehide", this.pageHideHandler);
        this.pageHideHandler = null;
      }
      if (this.resumeHandler) {
        window.removeEventListener("pageshow", this.resumeHandler);
        window.removeEventListener("focus", this.resumeHandler);
        window.removeEventListener("pointerdown", this.resumeHandler);
        window.removeEventListener("touchstart", this.resumeHandler);
        this.resumeHandler = null;
      }
    }
    this.clearBgHint();
    this.clearWakeLockRetryTimers();
    // Release the wake lock so the phone can sleep normally again after the
    // walk ends. Fire-and-forget — callers don't await teardown.
    void this.releaseWakeLock();
    // Bank any in-flight pause so the final duration is exact.
    if (this.pausedSince !== null) {
      this.state = {
        ...this.state,
        pausedMs: this.state.pausedMs + (Date.now() - this.pausedSince),
      };
      this.pausedSince = null;
    }
    this.hiddenSince = null;
  }

  stop(): WalkSessionState {
    this.teardown();
    this.update({ isTracking: false, isPaused: false });
    return this.state;
  }

  /** Runaway safeguard: same teardown as stop() but flags `autoStopped` so the
   *  view can surface the "還在散步嗎?" notice and move to the done screen. */
  private autoStop(): void {
    this.teardown();
    this.update({ isTracking: false, isPaused: false, autoStopped: true });
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
    // §A: while manually paused, ignore samples so distance freezes with the
    // timer. (The watch stays active so the first post-resume sample has a
    // fresh fix; addGpsSample's own min-distance gate handles the jump.)
    if (this.state.isPaused) return;

    // A real foreground sample means we're tracking again — clear any stale
    // "no distance in background" hint early.
    if (this.state.errorKind === "backgrounded") {
      this.clearBgHint();
      this.update({ errorKind: null, lastError: null });
    }

    // Delegate accuracy/min-distance filtering, distance accumulation and
    // path-capping to the shared pure helper (identical to iOS). Returns the
    // SAME accumulator object when the sample is rejected → no state emit.
    const acc = {
      path: this.state.path,
      totalDistanceKm: this.state.totalDistanceKm,
    };
    const next = addGpsSample(acc, {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      t: pos.timestamp,
      accuracy: pos.coords.accuracy ?? Infinity,
    });
    if (next === acc) return; // rejected (poor accuracy or < 5m from last)
    this.update({ path: next.path, totalDistanceKm: next.totalDistanceKm });
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
