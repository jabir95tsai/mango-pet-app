/**
 * Per-pet daily walk-goal helpers — PURE, cross-platform (web + ios).
 *
 * Spec docs/features/per-pet-walk-goal.md. The goal field is optional on
 * `Pet` (legacy pets don't have it), so every read site goes through
 * `getPetWalkGoalMinutes()` which falls back to `DEFAULT_WALK_GOAL_MINUTES`.
 * Don't read `pet.walkGoal?.minutes` directly elsewhere — keep the fallback
 * policy in one place.
 *
 * ⚠️ functions/src/index.ts keeps an INLINED copy of the same fallback
 * (DEFAULT 30 / clamp [5,180]) because Cloud Functions can't share this
 * module graph. Verified identical 2026-05-31 (ios-p1a). If the default or
 * clamp ever changes, update functions too (Open Q1: unify later).
 */
import type { Pet } from "@mango/shared-types";

export const DEFAULT_WALK_GOAL_MINUTES = 30;
export const WALK_GOAL_MIN_MINUTES = 5;
export const WALK_GOAL_MAX_MINUTES = 180;
export const WALK_GOAL_STEP_MINUTES = 5;

/** Single source of truth for "what's this pet's daily walk goal in
 *  minutes?". Returns the explicit value when set (clamped on read), the
 *  default otherwise. Safe with null/undefined. */
export function getPetWalkGoalMinutes(pet: Pet | null | undefined): number {
  const m = pet?.walkGoal?.minutes;
  if (typeof m === "number" && Number.isFinite(m) && m > 0) {
    return Math.min(WALK_GOAL_MAX_MINUTES, Math.max(WALK_GOAL_MIN_MINUTES, m));
  }
  return DEFAULT_WALK_GOAL_MINUTES;
}

/** Format helper for chip / settings labels. Caller passes the i18n `t`
 *  for the `WalksPage.petPicker.goalChip` namespace. Framework-free. */
export function formatWalkGoal(
  minutes: number,
  t: (key: string, vars: Record<string, string | number>) => string,
): string {
  return t("goalChip", { n: minutes });
}

/** Future placeholder — once a breed/age/weight heuristic ships, this
 *  returns `{ minutes, source: 'computed' }`. Stub returns null. */
export function computeWalkGoalFromBreed(_pet: Pet): {
  minutes: number;
  source: "computed";
} | null {
  return null;
}
