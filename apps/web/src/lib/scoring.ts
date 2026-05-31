// The walk SCORE formula (dog factors + computeWalkScore) moved to
// @mango/shared-business so iOS and web compute identical scores. Re-exported
// here so existing `@/lib/scoring` imports keep working unchanged.
export {
  typeFactorFor,
  weightFactorFor,
  ageFactorFor,
  breedFactorFor,
  dogFactorFor,
  DOG_FACTOR_COEFFICIENT,
  computeWalkScore,
} from "@mango/shared-business";

// ── Leaderboard period / streak helpers (web callers only — not part of the
//    walk-score formula, so they stay here rather than in shared-business). ──

/**
 * Compute streak days from sorted walks (descending by date).
 * A streak is broken if there's a gap >= 2 days between consecutive walks.
 */
export function computeStreak(walkDates: Date[]): number {
  if (walkDates.length === 0) return 0;
  const days = Array.from(
    new Set(walkDates.map((d) => Math.floor(d.getTime() / 86_400_000))),
  ).sort((a, b) => b - a);

  const todayIdx = Math.floor(Date.now() / 86_400_000);
  if (days[0] < todayIdx - 1) return 0; // no walk today or yesterday → streak broken

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 1) streak++;
    else break;
  }
  return streak;
}

/**
 * ISO week label: `weekly_2026-W19`
 */
export function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `weekly_${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function monthLabel(date: Date): string {
  return `monthly_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
