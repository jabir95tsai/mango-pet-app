/**
 * Pure helpers for the iOS AI walk-goal recommendation flow. Held outside
 * `ai-walk-goal.ts` with zero React Native / Firebase runtime dependencies so
 * `node --test` can exercise error mapping, goal source transitions, and
 * request payload construction directly.
 */
import type {
  Gender,
  Species,
  WalkGoalRecommendationInput,
} from "@mango/shared-types";

export type WalkGoalAiErrorKind = "rateLimit" | "unavailable" | "generic";

/**
 * Map a Cloud Functions / native SDK error into a stable error category for
 * the form UI. Accepts both `"functions/<code>"` (Web & standard RNFB) and
 * bare `"<code>"` strings.
 */
export function mapWalkGoalAiError(err: unknown): WalkGoalAiErrorKind {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  if (code === "functions/resource-exhausted" || code === "resource-exhausted") {
    return "rateLimit";
  }
  if (code === "functions/failed-precondition" || code === "failed-precondition") {
    return "unavailable";
  }
  return "generic";
}

/**
 * Keep `walkGoal.source` as `"computed"` only while the numeric value matches the
 * AI-suggested minutes; any user override switches to `"manual"` (and stepping
 * back to `computedMinutes` restores `"computed"`).
 */
export function resolveWalkGoalSource(
  nextMinutes: number,
  computedMinutes: number | null,
): "computed" | "manual" {
  return computedMinutes !== null && nextMinutes === computedMinutes
    ? "computed"
    : "manual";
}

/**
 * Build the `recommendPetWalkGoal` callable input from raw form fields,
 * mirroring Web `PetFormDialog.handleRequestRecommend`.
 */
export function buildWalkGoalRecommendInput(fields: {
  species: Species;
  speciesOther: string;
  breed: string;
  birthdayIso?: string;
  gender: Gender;
  weightText: string;
  petId?: string;
  bio: string;
  locale: string;
}): WalkGoalRecommendationInput {
  const trimmedWeight = fields.weightText.trim();
  const parsedWeight = trimmedWeight
    ? parseFloat(trimmedWeight.replace(/,/g, "."))
    : undefined;
  const validWeight =
    parsedWeight !== undefined &&
    Number.isFinite(parsedWeight) &&
    parsedWeight > 0
      ? parsedWeight
      : undefined;

  return {
    species: fields.species,
    speciesOther:
      fields.species === "other"
        ? fields.speciesOther.trim() || undefined
        : undefined,
    breed: fields.breed.trim() || undefined,
    birthday: fields.birthdayIso || undefined,
    gender: fields.gender,
    weightKg: validWeight,
    petId: fields.petId,
    bio: fields.bio.trim() || undefined,
    locale: fields.locale === "en" ? "en" : "zh-TW",
  };
}
