/**
 * Per-pet daily walk-goal helpers.
 *
 * Spec docs/features/per-pet-walk-goal.md. The goal field is optional
 * on `Pet` (legacy pets don't have it), so every read site goes
 * through `getPetWalkGoalMinutes()` which falls back to
 * `DEFAULT_WALK_GOAL_MINUTES`. Don't read `pet.walkGoal?.minutes`
 * directly elsewhere — keep the fallback policy in one place.
 *
 * The cloud functions (A1 evening reminder, B2 family milestone) can't
 * import this file (Next.js + Cloud Functions don't share a module
 * graph), so an inlined copy of the same fallback logic lives in
 * `functions/src/index.ts`. Keep the two in sync if the default
 * changes — there's a comment on the constant pointing at this file.
 */

import type { Pet } from "./types";

/** Hardcoded default that matches the legacy app-wide constant — every
 *  surface used to read this directly (walks page dial, week strip, A1
 *  cron, B2 trigger). Per spec D1, dimension is minutes only; future
 *  spec may add km / count / per-pet-multi-goal. */
export const DEFAULT_WALK_GOAL_MINUTES = 30;

/** UI input clamp. Users entering a goal stay inside [MIN, MAX]; values
 *  loaded from Firestore outside this range (e.g., direct-edit / future
 *  computed-goal heuristic) are clamped at render time so the dial
 *  doesn't render with absurd numbers. */
export const WALK_GOAL_MIN_MINUTES = 5;
export const WALK_GOAL_MAX_MINUTES = 180;
export const WALK_GOAL_STEP_MINUTES = 5;

/** Single source of truth for "what's this pet's daily walk goal in
 *  minutes?". Returns the explicit value when set, the default
 *  otherwise. Safe to call with `null` / `undefined` so caller sites
 *  with an optional active pet stay readable. */
export function getPetWalkGoalMinutes(pet: Pet | null | undefined): number {
  const m = pet?.walkGoal?.minutes;
  if (typeof m === "number" && Number.isFinite(m) && m > 0) {
    // Clamp on read so out-of-range values (legacy data, direct
    // Firestore edits) don't break the UI.
    return Math.min(WALK_GOAL_MAX_MINUTES, Math.max(WALK_GOAL_MIN_MINUTES, m));
  }
  return DEFAULT_WALK_GOAL_MINUTES;
}

/** Format helper for chip / settings labels. Caller passes the
 *  next-intl `t` for the `WalksPage.petPicker.goalChip` namespace
 *  (zh-TW: "{n} 分/天", en: "{n} min/day"). Centralised so the
 *  format stays consistent across the picker dropdown chip, the pet
 *  edit form preview, and any future surface. */
export function formatWalkGoal(
  minutes: number,
  t: (key: string, vars: Record<string, string | number>) => string,
): string {
  return t("goalChip", { n: minutes });
}

/** Future placeholder — once a breed/age/weight heuristic ships,
 *  this returns `{ minutes, source: 'computed' }` and the pet form
 *  shows "建議值（可覆蓋）" until the user manually overrides.
 *
 *  TODO: replace stub when spec "breed-based computed goal" opens.
 *  See docs/features/per-pet-walk-goal.md 不在範圍 section. Stub
 *  returns null so call sites can short-circuit to the manual default
 *  in the meantime. */
export function computeWalkGoalFromBreed(_pet: Pet): {
  minutes: number;
  source: "computed";
} | null {
  return null;
}
