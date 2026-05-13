import type { Pet } from "./types";

/**
 * Returns a "type factor" multiplier for a pet based on weight/species.
 *
 * Smaller dogs get a higher factor (fairness — 1 km is more effort for a chihuahua than a husky).
 * Non-dogs get 1.0 baseline.
 */
export function typeFactorFor(pet: Pet | null | undefined): number {
  if (!pet || pet.species !== "dog") return 1.0;
  const kg = pet.weightKg ?? 0;
  if (kg <= 0) return 1.0;
  if (kg < 5) return 2.0;
  if (kg < 15) return 1.5;
  if (kg < 30) return 1.0;
  return 0.8;
}

/**
 * Weighted walk score:
 *   distance_km × type_factor   ← rewards effort, calibrated by pet size
 * + duration_min × 0.5          ← rewards time spent
 * + streak_days × 5             ← rewards consistency (caller passes current streak)
 */
export function computeWalkScore(args: {
  distanceKm: number;
  durationMin: number;
  pet: Pet | null | undefined;
  streakDays: number;
}): number {
  const factor = typeFactorFor(args.pet);
  const raw =
    args.distanceKm * factor + args.durationMin * 0.5 + args.streakDays * 5;
  return Math.round(raw * 10) / 10;
}

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
