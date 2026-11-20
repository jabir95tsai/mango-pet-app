/**
 * AI daily walk-goal recommendation powered by the Gemini Interactions API
 * (`gemini-4-hydrogen`) with structured JSON output.
 */
import { GoogleGenAI } from "@google/genai";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { isFirestoreDocumentId } from "./document-id";

export const WALK_GOAL_MIN_MINUTES = 5;
export const WALK_GOAL_MAX_MINUTES = 180;
export const WALK_GOAL_STEP_MINUTES = 5;
export const DEFAULT_WALK_GOAL_MINUTES = 30;
export const WALK_GOAL_AI_MODEL = "gemini-4-hydrogen";
export const WALK_GOAL_RATE_LIMIT_MAX = 20;
export const WALK_GOAL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RECENT_WALK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type WalkGoalSpecies = "dog" | "cat" | "other";
export type WalkGoalGender = "male" | "female" | "unknown";
export type WalkGoalLocale = "zh-TW" | "en";

export type NormalizedWalkGoalRequest = {
  species: WalkGoalSpecies;
  speciesOther?: string;
  breed?: string;
  birthday?: string;
  gender: WalkGoalGender;
  weightKg?: number;
  petId?: string;
  bio?: string;
  locale: WalkGoalLocale;
};

export type RecentWalkSummary = {
  walkCount: number;
  avgDurationMin: number;
  avgDistanceKm: number;
};

export type WalkGoalRecommendationResult = {
  minutes: number;
  sessionsPerDay: number;
  rationale: string;
  tips: string[];
  model: string;
};

export type CreateWalkGoalInteractionParams = {
  model: string;
  system_instruction: string;
  input: string;
  response_format: {
    type: "text";
    mime_type: "application/json";
    schema: typeof WALK_GOAL_RESPONSE_SCHEMA;
  };
  generation_config: {
    thinking_level: "low";
  };
  store: false;
};

export const WALK_GOAL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    minutes: {
      type: "integer",
      description:
        "Recommended daily walk or activity target in minutes (between 5 and 180, multiple of 5).",
    },
    sessionsPerDay: {
      type: "integer",
      description: "Recommended number of sessions per day (1 to 4).",
    },
    rationale: {
      type: "string",
      description:
        "Concise 1-2 sentence explanation referencing the pet's species, breed, age, weight, or recent walks.",
    },
    tips: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
      description: "1 to 3 practical, non-diagnostic pacing or safety tips.",
    },
  },
  required: ["minutes", "sessionsPerDay", "rationale", "tips"],
} as const;

const VALID_SPECIES = new Set<WalkGoalSpecies>(["dog", "cat", "other"]);
const VALID_GENDERS = new Set<WalkGoalGender>(["male", "female", "unknown"]);

/**
 * Clamp minutes to [5, 180] and snap to the nearest 5-minute increment.
 */
export function snapAndClampWalkGoalMinutes(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_WALK_GOAL_MINUTES;
  }
  const clamped = Math.min(
    WALK_GOAL_MAX_MINUTES,
    Math.max(WALK_GOAL_MIN_MINUTES, raw),
  );
  const snapped =
    Math.round(clamped / WALK_GOAL_STEP_MINUTES) * WALK_GOAL_STEP_MINUTES;
  return Math.min(
    WALK_GOAL_MAX_MINUTES,
    Math.max(WALK_GOAL_MIN_MINUTES, snapped),
  );
}

function parseIsoDateUtc(birthdayIso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdayIso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

/**
 * Convert a validated YYYY-MM-DD birthday into a human-readable age string.
 */
export function computeAgeSummary(
  birthdayIso?: string,
  now = new Date(),
): string | undefined {
  if (!birthdayIso) return undefined;
  const birth = parseIsoDateUtc(birthdayIso);
  if (!birth) return undefined;

  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const diffDays = (todayUtc - birth.getTime()) / 86_400_000;
  if (diffDays < 0 || diffDays > 40 * 365.25) {
    return undefined;
  }

  const months = diffDays / 30.4375;
  if (months < 1) {
    return "under 1 month";
  }
  if (months < 18) {
    const roundedMonths = Math.max(1, Math.round(months));
    return `${roundedMonths} ${roundedMonths === 1 ? "month" : "months"}`;
  }
  const years = Math.round((diffDays / 365.25) * 10) / 10;
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function cleanOptionalText(
  raw: unknown,
  field: string,
  maxLen: number,
): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", `Invalid ${field}`);
  }
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLen) {
    throw new HttpsError(
      "invalid-argument",
      `${field} exceeds maximum length of ${maxLen}`,
    );
  }
  return trimmed;
}

/**
 * Validate and normalize untrusted callable input for walk-goal recommendations.
 */
export function normalizeWalkGoalRequest(
  raw: unknown,
  now = new Date(),
): NormalizedWalkGoalRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "Request payload must be an object");
  }
  const data = raw as Record<string, unknown>;

  if (
    typeof data.species !== "string" ||
    !VALID_SPECIES.has(data.species as WalkGoalSpecies)
  ) {
    throw new HttpsError("invalid-argument", "Invalid pet species");
  }
  const species = data.species as WalkGoalSpecies;

  let gender: WalkGoalGender = "unknown";
  if (data.gender !== undefined && data.gender !== null) {
    if (
      typeof data.gender !== "string" ||
      !VALID_GENDERS.has(data.gender as WalkGoalGender)
    ) {
      throw new HttpsError("invalid-argument", "Invalid pet gender");
    }
    gender = data.gender as WalkGoalGender;
  }

  let weightKg: number | undefined;
  if (data.weightKg !== undefined && data.weightKg !== null) {
    if (
      typeof data.weightKg !== "number" ||
      !Number.isFinite(data.weightKg) ||
      data.weightKg <= 0 ||
      data.weightKg > 150
    ) {
      throw new HttpsError(
        "invalid-argument",
        "weightKg must be a number between 0 and 150",
      );
    }
    weightKg = Math.round(data.weightKg * 10) / 10;
  }

  let birthday: string | undefined;
  if (data.birthday !== undefined && data.birthday !== null && data.birthday !== "") {
    if (typeof data.birthday !== "string") {
      throw new HttpsError("invalid-argument", "Invalid birthday");
    }
    const trimmed = data.birthday.trim();
    const parsed = parseIsoDateUtc(trimmed);
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    if (!parsed || parsed.getTime() > todayUtc) {
      throw new HttpsError(
        "invalid-argument",
        "birthday must be a valid past or current YYYY-MM-DD date",
      );
    }
    const minUtc = Date.UTC(
      now.getUTCFullYear() - 40,
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    if (parsed.getTime() < minUtc) {
      throw new HttpsError(
        "invalid-argument",
        "birthday is outside a valid pet age range",
      );
    }
    birthday = trimmed;
  }

  let petId: string | undefined;
  if (data.petId !== undefined && data.petId !== null && data.petId !== "") {
    if (!isFirestoreDocumentId(data.petId)) {
      throw new HttpsError("invalid-argument", "Invalid petId");
    }
    petId = data.petId;
  }

  const locale: WalkGoalLocale = data.locale === "en" ? "en" : "zh-TW";

  return {
    species,
    speciesOther:
      species === "other"
        ? cleanOptionalText(data.speciesOther, "speciesOther", 60)
        : undefined,
    breed: cleanOptionalText(data.breed, "breed", 80),
    birthday,
    gender,
    weightKg,
    petId,
    bio: cleanOptionalText(data.bio, "bio", 300),
    locale,
  };
}

/**
 * Build the system instruction guiding Gemini on veterinary-informed pacing and tone.
 */
export function buildWalkGoalSystemInstruction(locale: WalkGoalLocale): string {
  const languageRule =
    locale === "en"
      ? "Write rationale and tips in concise, warm, natural English."
      : "Write rationale and tips in Traditional Chinese using natural Taiwan pet-care terminology (繁體中文、台灣寵物照護用語).";

  return [
    "You are a pet exercise and daily activity specialist for Mango Pet.",
    "Recommend a safe, realistic daily walk/activity goal in minutes (between 5 and 180, in 5-minute increments) plus 1-4 daily sessions.",
    "Consider species (for cats or small non-dog pets, suggest a conservative 10-20 minute harness-walk or supervised active-enrichment target), breed energy and brachycephalic/joint sensitivities, life stage (protect puppy growth plates; pace senior pets gently), weight, bio notes, and any recent 14-day walk baseline (avoid sudden sharp increases).",
    "Keep guidance practical and non-diagnostic; advise consulting a veterinarian if the pet has health concerns.",
    languageRule,
    "Return ONLY JSON matching the provided schema. Keep rationale to 1-2 concise sentences and provide 2-3 brief actionable tips.",
  ].join(" ");
}

/**
 * Format normalized pet details and optional recent walk baseline into a prompt.
 */
export function buildWalkGoalPrompt(
  input: NormalizedWalkGoalRequest,
  recentWalks?: RecentWalkSummary,
  now = new Date(),
): string {
  const lines = [`Species: ${input.species}`];
  if (input.speciesOther) lines.push(`Animal type: ${input.speciesOther}`);
  if (input.breed) lines.push(`Breed: ${input.breed}`);
  const age = computeAgeSummary(input.birthday, now);
  if (age) lines.push(`Age: ${age}`);
  if (input.weightKg !== undefined) lines.push(`Weight: ${input.weightKg} kg`);
  if (input.gender !== "unknown") lines.push(`Gender: ${input.gender}`);
  if (input.bio) lines.push(`Notes/Bio: ${input.bio}`);
  if (recentWalks && recentWalks.walkCount > 0) {
    lines.push(
      `Recent 14-day baseline: ${recentWalks.walkCount} walks, avg ${recentWalks.avgDurationMin} min/walk, avg ${recentWalks.avgDistanceKm} km/walk`,
    );
  } else {
    lines.push("Recent 14-day baseline: none recorded");
  }
  return lines.join("\n");
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/**
 * Parse and bound the structured JSON returned by Gemini.
 */
export function parseWalkGoalResponse(
  outputText: string | undefined,
): Omit<WalkGoalRecommendationResult, "model"> {
  if (!outputText || !outputText.trim()) {
    throw new HttpsError("internal", "Empty AI walk goal response");
  }
  let parsed: Record<string, unknown>;
  try {
    const raw = JSON.parse(stripCodeFences(outputText));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Expected JSON object");
    }
    parsed = raw as Record<string, unknown>;
  } catch {
    throw new HttpsError("internal", "Failed to parse AI walk goal recommendation");
  }

  const rationale =
    typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 320) : "";
  if (!rationale) {
    throw new HttpsError("internal", "AI walk goal response missing rationale");
  }

  const tips = Array.isArray(parsed.tips)
    ? parsed.tips
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, 180))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (tips.length === 0) {
    throw new HttpsError("internal", "AI walk goal response missing tips");
  }

  const rawSessions = Number(parsed.sessionsPerDay);
  const sessionsPerDay = Number.isFinite(rawSessions)
    ? Math.min(4, Math.max(1, Math.round(rawSessions)))
    : 2;

  return {
    minutes: snapAndClampWalkGoalMinutes(parsed.minutes),
    sessionsPerDay,
    rationale,
    tips,
  };
}

function extractMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object") {
    const maybe = value as { toMillis?: unknown; seconds?: unknown };
    if (typeof maybe.toMillis === "function") {
      return (maybe.toMillis as () => number)();
    }
    if (typeof maybe.seconds === "number" && Number.isFinite(maybe.seconds)) {
      return maybe.seconds * 1000;
    }
  }
  return null;
}

/**
 * Load a pet's 14-day walk summary when the caller has access to the pet.
 * Returns undefined silently if the pet is missing or unauthorized.
 */
export async function loadRecentPetWalkSummary(
  db: Firestore,
  uid: string,
  petId?: string,
  now = new Date(),
): Promise<RecentWalkSummary | undefined> {
  if (!petId || !isFirestoreDocumentId(petId)) return undefined;

  const petSnap = await db.doc(`pets/${petId}`).get();
  if (!petSnap.exists) return undefined;
  const pet = petSnap.data() as { familyId?: string | null; ownerUid?: string } | undefined;
  if (!pet) return undefined;

  if (pet.familyId == null) {
    if (pet.ownerUid !== uid) return undefined;
  } else {
    if (!isFirestoreDocumentId(pet.familyId)) return undefined;
    const famSnap = await db.doc(`families/${pet.familyId}`).get();
    if (!famSnap.exists) return undefined;
    const memberUids = famSnap.data()?.memberUids;
    if (!Array.isArray(memberUids) || !memberUids.includes(uid)) return undefined;
  }

  // Single-field query avoids adding a composite index on (petId, startedAt).
  const walksSnap = await db
    .collection("walks")
    .where("petId", "==", petId)
    .limit(30)
    .get();

  const nowMs = now.getTime();
  const cutoffMs = nowMs - RECENT_WALK_WINDOW_MS;
  let walkCount = 0;
  let totalMin = 0;
  let totalKm = 0;

  for (const docSnap of walksSnap.docs) {
    const walk = docSnap.data() as {
      startedAt?: unknown;
      durationMin?: unknown;
      distanceKm?: unknown;
    };
    const startedMs = extractMillis(walk.startedAt);
    if (startedMs === null || startedMs < cutoffMs || startedMs > nowMs) continue;
    if (typeof walk.durationMin !== "number" || !Number.isFinite(walk.durationMin) || walk.durationMin <= 0) {
      continue;
    }
    walkCount += 1;
    totalMin += walk.durationMin;
    if (typeof walk.distanceKm === "number" && Number.isFinite(walk.distanceKm) && walk.distanceKm > 0) {
      totalKm += walk.distanceKm;
    }
  }

  if (walkCount === 0) return undefined;
  return {
    walkCount,
    avgDurationMin: Math.round(totalMin / walkCount),
    avgDistanceKm: Math.round((totalKm / walkCount) * 10) / 10,
  };
}

/**
 * Enforce a per-user hourly limit (20 requests/hour) in server-only Firestore docs.
 */
export async function enforceWalkGoalRateLimit(
  db: Firestore,
  uid: string,
  nowMs = Date.now(),
): Promise<void> {
  if (!isFirestoreDocumentId(uid)) {
    throw new HttpsError("invalid-argument", "Invalid user id");
  }
  const ref = db.doc(`aiRateLimits/walkGoal_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists
      ? (snap.data() as { count?: unknown; windowStartMs?: unknown } | undefined)
      : undefined;
    const windowStartMs =
      typeof data?.windowStartMs === "number" ? data.windowStartMs : undefined;
    const count = typeof data?.count === "number" ? data.count : 0;

    if (
      windowStartMs === undefined ||
      nowMs - windowStartMs >= WALK_GOAL_RATE_LIMIT_WINDOW_MS
    ) {
      tx.set(ref, {
        uid,
        count: 1,
        windowStartMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (count >= WALK_GOAL_RATE_LIMIT_MAX) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many walk goal requests. Please try again later.",
      );
    }

    tx.set(
      ref,
      {
        uid,
        count: count + 1,
        windowStartMs,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/**
 * Call Gemini Interactions API (`gemini-4-hydrogen`) and return a clamped recommendation.
 */
export async function generateWalkGoalRecommendation(
  input: NormalizedWalkGoalRequest,
  options: {
    apiKey?: string;
    recentWalkSummary?: RecentWalkSummary;
    now?: Date;
    createInteraction?: (
      params: CreateWalkGoalInteractionParams,
    ) => Promise<{ output_text?: string }>;
  } = {},
): Promise<WalkGoalRecommendationResult> {
  const params: CreateWalkGoalInteractionParams = {
    model: WALK_GOAL_AI_MODEL,
    system_instruction: buildWalkGoalSystemInstruction(input.locale),
    input: buildWalkGoalPrompt(input, options.recentWalkSummary, options.now),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: WALK_GOAL_RESPONSE_SCHEMA,
    },
    generation_config: {
      thinking_level: "low",
    },
    store: false,
  };

  let interaction: { output_text?: string };
  if (options.createInteraction) {
    interaction = await options.createInteraction(params);
  } else {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Gemini API key is not configured.",
      );
    }
    const ai = new GoogleGenAI({ apiKey });
    interaction = await ai.interactions.create(params);
  }

  return {
    ...parseWalkGoalResponse(interaction.output_text),
    model: WALK_GOAL_AI_MODEL,
  };
}
