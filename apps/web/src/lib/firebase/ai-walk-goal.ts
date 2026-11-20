import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./config";
import type {
  WalkGoalRecommendation,
  WalkGoalRecommendationInput,
} from "@/lib/types";

const FN_REGION = "asia-east1";

export async function recommendPetWalkGoal(
  input: WalkGoalRecommendationInput,
): Promise<WalkGoalRecommendation> {
  const fns = getFunctions(getFirebaseApp(), FN_REGION);
  const fn = httpsCallable<
    WalkGoalRecommendationInput,
    WalkGoalRecommendation
  >(fns, "recommendPetWalkGoal");
  const res = await fn(input);
  return res.data;
}
