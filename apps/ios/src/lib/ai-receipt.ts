/**
 * iOS receipt OCR — mirrors apps/web/src/lib/firebase/ai-receipt.ts. The web
 * "extractReceipt callable" is actually a client-side Firebase AI Logic call
 * (firebase/ai → Gemini), NOT a Cloud Function. iOS reuses the SAME firebase JS
 * SDK (already a dependency, v12.13.0) via a SECONDARY JS app initialized from
 * the public web config — @react-native-firebase has no `ai` module at our SDK
 * version, and firebase/ai is REST-based (fetch) so it runs fine in RN.
 *
 * The firebase config values below are the project's PUBLIC web config (api
 * keys for Firebase clients are not secrets — they ship in every web bundle;
 * access is gated by Firebase rules + API key restrictions). Sourced from
 * GoogleService-Info.plist + apps/web APP_ID_KNOWN_GOOD.
 *
 * Prompt + parsing are copied verbatim from web so both platforms extract the
 * same fields. Same model: gemini-2.5-flash.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import type { ExpenseCategory, ExtractedReceipt } from "@mango/shared-types";

const AI_APP_NAME = "ai-receipt";
const MODEL = "gemini-2.5-flash";

const firebaseConfig = {
  apiKey: "AIzaSyD_oYrPK-olpOK-y8ekKAH6RUBdAPNesdk",
  authDomain: "mango-pet-app.firebaseapp.com",
  projectId: "mango-pet-app",
  storageBucket: "mango-pet-app.firebasestorage.app",
  messagingSenderId: "722604603606",
  appId: "1:722604603606:web:9d4efbb3033bfd9811f177",
};

/** Lazily init a dedicated JS app for AI Logic (separate from the native RNFB
 *  app, which the firebase JS SDK can't see). Idempotent. */
function aiApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === AI_APP_NAME);
  return existing ?? initializeApp(firebaseConfig, AI_APP_NAME);
}

const PROMPT = `You extract structured data from a Taiwanese pet store / vet / pet service receipt photo.

Return ONLY valid JSON, no markdown, no commentary. Shape:
{
  "amount": <number, total amount in TWD; 0 if unreadable>,
  "vendor": <string, store/clinic name; "" if unreadable>,
  "spentAt": <string, ISO date "YYYY-MM-DD"; "" if unreadable>,
  "category": <one of: "food"|"medical"|"grooming"|"toy"|"training"|"insurance"|"other">,
  "items": <array of strings, line items; [] if none>
}

Category guessing rules:
- vet / 動物醫院 / 獸醫 / 醫療 / 藥 → "medical"
- 飼料 / 罐頭 / pet food / dog food / cat food / 寵物食品 → "food"
- 美容 / 洗澡 / grooming / salon / 修毛 → "grooming"
- 玩具 / toy / 用品 (if clearly not food/medical) → "toy"
- 訓練 / training class → "training"
- 保險 / insurance → "insurance"
- otherwise → "other"

Output JSON only. Do not wrap in markdown fences.`;

const VALID_CATEGORIES: ExpenseCategory[] = [
  "food",
  "medical",
  "grooming",
  "toy",
  "training",
  "insurance",
  "other",
];

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fence ? fence[1].trim() : trimmed;
}

function coerceCategory(raw: unknown): ExpenseCategory {
  if (
    typeof raw === "string" &&
    VALID_CATEGORIES.includes(raw as ExpenseCategory)
  ) {
    return raw as ExpenseCategory;
  }
  return "other";
}

/**
 * Extract structured receipt data from a base64 JPEG (from
 * compressReceiptToBase64). Throws on a parse failure so the caller can fall
 * back to manual entry.
 */
export async function extractReceipt(
  base64: string,
  mimeType: string = "image/jpeg",
): Promise<ExtractedReceipt> {
  const ai = getAI(aiApp(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const result = await model.generateContent([
    PROMPT,
    { inlineData: { mimeType, data: base64 } },
  ]);

  const text = result.response.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(text)) as Record<string, unknown>;
  } catch {
    throw new Error("AI 回傳的結果無法解析，請手動輸入。");
  }

  const amountNum = Number(parsed.amount);
  const spentRaw = typeof parsed.spentAt === "string" ? parsed.spentAt : "";
  const vendor = typeof parsed.vendor === "string" ? parsed.vendor : "";
  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];

  return {
    amount: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined,
    vendor: vendor.trim() || undefined,
    spentAt: spentRaw.match(/^\d{4}-\d{2}-\d{2}$/) ? spentRaw : undefined,
    category: coerceCategory(parsed.category),
    items: itemsRaw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
