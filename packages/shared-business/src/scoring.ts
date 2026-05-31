/**
 * Walk score formula — PURE, cross-platform (web + ios). Single source of
 * truth for `walks/{walkId}.score`. iOS and web MUST use this exact formula
 * or the leaderboard (which sums stored scores) diverges. Spec
 * docs/features/ios-p1-walks.md §Data contract + leaderboard-v2-dog-centric.md.
 *
 * NOTE: Cloud Functions do NOT recompute score — the leaderboard aggregators
 * read the stored `walk.score`. So this formula lives only client-side
 * (web + ios), no functions duplicate to keep in sync.
 */
import type { Species } from "@mango/shared-types";

/**
 * Structural shape the score formula reads from a pet. Deliberately NOT the
 * full `Pet` type: `birthday` is just "something with toMillis()", so BOTH
 * the firebase-JS `Timestamp` (web) and the `@react-native-firebase`
 * Timestamp (ios) satisfy it without an SDK-specific dependency. Web's full
 * `Pet` is assignable to this.
 */
export type ScorablePet = {
  species: Species;
  weightKg?: number | null;
  breed?: string | null;
  birthday?: { toMillis(): number } | null;
};

/**
 * Weight factor — smaller dogs get a higher multiplier (fairness: 1 km is
 * more effort for a chihuahua than a husky). Non-dogs / no weight → 1.0.
 * Kept under the legacy name `typeFactorFor` and consumed as the *weight*
 * component of `dogFactor` below.
 */
export function typeFactorFor(pet: ScorablePet | null | undefined): number {
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
 * Age factor — fairness handicap for puppies / senior dogs. Computed from
 * `birthday` at scoring time and frozen into the walk's stored score. No
 * birthday → 1.0.
 */
export function ageFactorFor(
  pet: ScorablePet | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!pet || pet.species !== "dog" || !pet.birthday) return 1.0;
  const birthMs = pet.birthday.toMillis();
  if (!Number.isFinite(birthMs) || birthMs <= 0) return 1.0;
  const years = (nowMs - birthMs) / (365.25 * 86_400_000);
  if (years < 0) return 1.0;
  if (years < 1) return 1.2;
  if (years < 7) return 1.0;
  if (years < 10) return 1.2;
  return 1.4;
}

/**
 * Low-stamina (brachycephalic / short-legged) breeds that physically can't
 * sustain long walks — small handicap. Free-text `breed` matched
 * case-insensitively against EN + zh-TW aliases. High-activity / unknown /
 * blank breeds stay 1.0 (we deliberately do NOT penalise high-activity dogs).
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

export function breedFactorFor(pet: ScorablePet | null | undefined): number {
  if (!pet || pet.species !== "dog" || !pet.breed) return 1.0;
  const b = pet.breed.trim().toLowerCase();
  if (!b) return 1.0;
  return LOW_STAMINA_BREEDS.some((name) => b.includes(name)) ? 1.2 : 1.0;
}

/** Per-factor strength knob (user-signed-off 0.4, 2026-05-30). */
export const DOG_FACTOR_COEFFICIENT = 0.4;

/**
 * Distance multiplier combining weight + age + breed via a WEIGHTED-ADDITIVE
 * blend: clamp(1 + Σ(factorᵢ-1)*K, 0.5, 3.0), K = DOG_FACTOR_COEFFICIENT.
 * Missing age/breed contribute 0; weight term is itself scaled by K (the
 * signed-off small-dog 2.0→1.40 dilution). Non-dogs → 1.0.
 */
export function dogFactorFor(
  pet: ScorablePet | null | undefined,
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
 *   distance_km × dog_factor   ← effort, calibrated by dog body type
 * + duration_min × 0.5         ← time spent (human effort, body-neutral)
 * + streak_days × 5            ← consistency (caller passes current streak)
 */
export function computeWalkScore(args: {
  distanceKm: number;
  durationMin: number;
  pet: ScorablePet | null | undefined;
  streakDays: number;
}): number {
  const factor = dogFactorFor(args.pet);
  const raw =
    args.distanceKm * factor + args.durationMin * 0.5 + args.streakDays * 5;
  return Math.round(raw * 10) / 10;
}
