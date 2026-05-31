/**
 * Pure walk statistics — today progress, week strip flags, streak. These are
 * VERBATIM ports of the web helpers so iOS and web show identical numbers:
 *   - getTodayProgress / startOfTodayLocal  → apps/web/src/lib/walk-tracking.ts
 *   - getWeekDayDoneFlags / startOfWeekLocal → apps/web/src/app/app/walks/page.tsx
 *   - computeStreak                          → apps/web/src/lib/scoring.ts
 *
 * ⚠️ HANDOFF (iOS Backend): these are framework-free pure functions that web
 * also has. To kill the drift risk they should move into @mango/shared-business
 * (the same way walk-goals/scoring/gps already did). Inlined here for P1a per
 * spec ios-p1-walks §"先用最小正確實作 + 標 handoff".
 *
 * Inputs are kept structural (`{ startedAt?: { toMillis() }, durationMin?,
 * distanceKm? }`) instead of the full `Walk` type so the @react-native-firebase
 * Timestamp (which also has toMillis()) satisfies them without an SDK-specific
 * dependency.
 */

export type WalkStat = {
  startedAt?: { toMillis(): number } | null;
  durationMin?: number;
  distanceKm?: number;
};

export type WalkProgress = { minutes: number; goalMin: number; percent: number };

function startOfTodayLocal(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO-8601 week start — Monday 00:00 device-local. */
function startOfWeekLocal(now: Date = new Date()): Date {
  const d = startOfTodayLocal(now);
  const daysFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

function walkStartMs(w: WalkStat): number {
  const ts = w.startedAt;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}

/** Day index 0..6 (Monday = 0) for "today". */
export function todayIdxLocal(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

/** Sum of durationMin across walks started today → percent of goal. */
export function getTodayProgress(
  walks: WalkStat[],
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

/** Per-day minute totals this week → boolean[7] Mon-first, true if >= goal. */
export function getWeekDayDoneFlags(walks: WalkStat[], goalMin: number): boolean[] {
  const start = startOfWeekLocal().getTime();
  const dayMs = 24 * 3600 * 1000;
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const w of walks) {
    const t = walkStartMs(w);
    if (!t) continue;
    const idx = Math.floor((t - start) / dayMs);
    if (idx >= 0 && idx < 7) totals[idx] += w.durationMin ?? 0;
  }
  return totals.map((m) => m >= goalMin);
}

/** Total km across this week (week-strip header summary). */
export function getWeekKm(walks: WalkStat[]): number {
  const start = startOfWeekLocal().getTime();
  let km = 0;
  for (const w of walks) {
    if (walkStartMs(w) >= start) km += w.distanceKm ?? 0;
  }
  return km;
}

/** This-week walk count. */
export function getWeekWalkCount(walks: WalkStat[]): number {
  const start = startOfWeekLocal().getTime();
  let n = 0;
  for (const w of walks) {
    if (walkStartMs(w) >= start) n += 1;
  }
  return n;
}

/**
 * Streak days from walk dates. A streak breaks on a gap >= 2 days. Verbatim
 * port of web `computeStreak` (apps/web/src/lib/scoring.ts).
 */
export function computeStreak(walkDates: Date[]): number {
  if (walkDates.length === 0) return 0;
  const days = Array.from(
    new Set(walkDates.map((d) => Math.floor(d.getTime() / 86_400_000))),
  ).sort((a, b) => b - a);

  const todayIdx = Math.floor(Date.now() / 86_400_000);
  if (days[0] < todayIdx - 1) return 0; // no walk today or yesterday → broken

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 1) streak++;
    else break;
  }
  return streak;
}
