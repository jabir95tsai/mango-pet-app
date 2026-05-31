import type { Pet } from "./types";

/**
 * Weight factor — smaller dogs get a higher multiplier (fairness: 1 km is
 * more effort for a chihuahua than a husky). Non-dogs / no weight → 1.0.
 * This is the original `typeFactor`; kept under the old name for back-compat
 * and now consumed as the *weight* component of `dogFactor` below.
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

/** Alias — reads as the "weight" component of dogFactor. */
export const weightFactorFor = typeFactorFor;

/**
 * Age factor — fairness handicap for puppies / senior dogs (not built for
 * long distance, so the same effort weighs more). Computed from `birthday`
 * at scoring time and frozen into the walk's stored score, so a dog ageing
 * never forces a recompute of historical walks. No birthday → 1.0 (neutral).
 *
 * | age (yrs) | factor |
 * |  < 1      |  1.2   |  puppy
 * |  1–7      |  1.0   |  prime (baseline)
 * |  7–10     |  1.2   |  mature
 * |  ≥ 10     |  1.4   |  senior
 */
export function ageFactorFor(
  pet: Pet | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!pet || pet.species !== "dog" || !pet.birthday) return 1.0;
  const birthMs = pet.birthday.toMillis();
  if (!Number.isFinite(birthMs) || birthMs <= 0) return 1.0;
  const years = (nowMs - birthMs) / (365.25 * 86_400_000);
  if (years < 0) return 1.0; // future birthday → bad data, stay neutral
  if (years < 1) return 1.2;
  if (years < 7) return 1.0;
  if (years < 10) return 1.2;
  return 1.4;
}

/**
 * Low-stamina (brachycephalic / short-legged) breeds that physically can't
 * sustain long walks — given a small handicap. Free-text `breed` is matched
 * case-insensitively against EN + zh-TW aliases. Everything else (incl.
 * high-activity breeds like huskies, and unknown/blank) stays 1.0 — we
 * deliberately do NOT penalise high-activity dogs (that would punish the
 * core "walk more" motivation). Extensible list.
 */
const LOW_STAMINA_BREEDS = [
  "french bulldog",
  "frenchie",
  "法國鬥牛犬",
  "法鬥",
  "pug",
  "巴哥",
  "八哥",
  "bulldog",
  "english bulldog",
  "鬥牛犬",
  "shih tzu",
  "shih-tzu",
  "shihtzu",
  "西施",
  "pekingese",
  "北京犬",
  "京巴",
  "boston terrier",
  "波士頓㹴",
  "boxer",
  "拳師犬",
];

export function breedFactorFor(pet: Pet | null | undefined): number {
  if (!pet || pet.species !== "dog" || !pet.breed) return 1.0;
  const b = pet.breed.trim().toLowerCase();
  if (!b) return 1.0;
  return LOW_STAMINA_BREEDS.some((name) => b.includes(name)) ? 1.2 : 1.0;
}

/**
 * Per-factor strength knob. Each factor's deviation from 1.0 is scaled by
 * this before being summed, so factors add rather than multiply (multiplying
 * stacks toward the clamp and flattens differences between dogs). Bumping it
 * (0.5/0.6) makes the body-type handicap stronger; lowering dilutes it.
 * (user-tunable, 2026-05-30 signed off on 0.4 via the example table.)
 */
export const DOG_FACTOR_COEFFICIENT = 0.4;

/**
 * Distance multiplier for a dog, combining weight + age + breed via a
 * WEIGHTED-ADDITIVE blend:
 *
 *   dogFactor = clamp(
 *     1 + (weightFactor-1)*K + (ageFactor-1)*K + (breedFactor-1)*K,
 *     0.5, 3.0
 *   )   where K = DOG_FACTOR_COEFFICIENT (0.4)
 *
 * Back-compat: a dog with no birthday/breed contributes 0 from those terms
 * (factor 1.0 → (1-1)*K = 0), so dogFactor = 1 + (weightFactor-1)*K. Note the
 * weight term is itself scaled by K — this is the intentional, signed-off
 * dilution (small-dog 2.0 → 1.40; see spec example table + accepted
 * side-effect). The clamp only ever fires as a guard against dirty data
 * (e.g. absurd weightKg); normal inputs land well inside 0.5–3.0.
 * Non-dogs → 1.0.
 */
export function dogFactorFor(
  pet: Pet | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!pet || pet.species !== "dog") return 1.0;
  const K = DOG_FACTOR_COEFFICIENT;
  const raw =
    1 +
    (weightFactorFor(pet) - 1) * K +
    (ageFactorFor(pet, nowMs) - 1) * K +
    (breedFactorFor(pet) - 1) * K;
  return Math.max(0.5, Math.min(3.0, raw));
}

/**
 * Weighted walk score:
 *   distance_km × dog_factor   ← rewards effort, calibrated by dog body type
 * + duration_min × 0.5         ← rewards time spent (human effort, body-neutral)
 * + streak_days × 5            ← rewards consistency (caller passes current streak)
 *
 * Only the distance multiplier carries the dog handicap; duration + streak
 * are "human effort / consistency" dimensions, independent of the dog.
 */
export function computeWalkScore(args: {
  distanceKm: number;
  durationMin: number;
  pet: Pet | null | undefined;
  streakDays: number;
}): number {
  const factor = dogFactorFor(args.pet);
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
