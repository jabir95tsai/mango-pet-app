/**
 * WEB PREVIEW ONLY — Metro picks this over ai-walk-goal.ts when bundling for
 * the browser (docs/features/ios-web-preview.md). AI walk-goal recommendation
 * calls the billed `recommendPetWalkGoal` Cloud Function (Gemini), so the
 * browser preview throws `functions/failed-precondition` instead and displays
 * the unavailable fallback state cleanly.
 */
import type {
  WalkGoalRecommendation,
  WalkGoalRecommendationInput,
} from "@mango/shared-types";

export {
  buildWalkGoalRecommendInput,
  mapWalkGoalAiError,
  resolveWalkGoalSource,
  type WalkGoalAiErrorKind,
} from "./ai-walk-goal-core";

export async function recommendPetWalkGoal(
  _input: WalkGoalRecommendationInput,
): Promise<WalkGoalRecommendation> {
  const err = new Error(
    "AI walk goal recommendation is disabled in the browser preview",
  ) as Error & { code: string };
  err.code = "functions/failed-precondition";
  throw err;
}
