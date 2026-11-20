/**
 * iOS smart daily walk goal client — invokes the shared `recommendPetWalkGoal`
 * Cloud Function (region asia-east1), matching
 * apps/web/src/lib/firebase/ai-walk-goal.ts.
 */
import { firebase } from "@react-native-firebase/functions";
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

const FN_REGION = "asia-east1";

/**
 * Request an AI-suggested daily walk goal for a pet based on species, breed,
 * birthday, weight, bio, and optional recent walks (when editing an existing
 * pet).
 */
export async function recommendPetWalkGoal(
  input: WalkGoalRecommendationInput,
): Promise<WalkGoalRecommendation> {
  const res = await firebase
    .app()
    .functions(FN_REGION)
    .httpsCallable("recommendPetWalkGoal")(input);
  return res.data as WalkGoalRecommendation;
}
