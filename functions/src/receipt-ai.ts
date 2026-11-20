/**
 * AI receipt OCR powered by the Gemini Interactions API (`gemini-4-hydrogen`)
 * with structured JSON output and high-resolution image understanding.
 */
import { GoogleGenAI } from "@google/genai";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { isFirestoreDocumentId } from "./document-id";

export const RECEIPT_AI_MODEL = "gemini-4-hydrogen";
export const RECEIPT_RATE_LIMIT_MAX = 30;
export const RECEIPT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const MAX_RECEIPT_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_RECEIPT_BASE64_LENGTH =
  Math.ceil(MAX_RECEIPT_IMAGE_BYTES / 3) * 4;

export const VALID_RECEIPT_CATEGORIES = [
  "food",
  "medical",
  "grooming",
  "toy",
  "training",
  "insurance",
  "other",
] as const;

export type ReceiptCategory = (typeof VALID_RECEIPT_CATEGORIES)[number];

export const ALLOWED_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedReceiptMimeType =
  (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

export type NormalizedReceiptRequest = {
  imageBase64: string;
  mimeType: AllowedReceiptMimeType;
};

export type ExtractedReceiptResult = {
  amount?: number;
  vendor?: string;
  spentAt?: string;
  category: ReceiptCategory;
  items: string[];
};

export const RECEIPT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    amount: {
      type: "number",
      description: "Total amount paid in TWD. Return 0 if unreadable.",
    },
    vendor: {
      type: "string",
      description:
        "Store, veterinary clinic, or merchant name. Return empty string if unreadable.",
    },
    spentAt: {
      type: "string",
      description:
        'Receipt date in ISO "YYYY-MM-DD" format (convert Taiwan ROC/民國 years by adding 1911). Return empty string if unreadable.',
    },
    category: {
      type: "string",
      enum: [
        "food",
        "medical",
        "grooming",
        "toy",
        "training",
        "insurance",
        "other",
      ],
      description: "Best-matching pet expense category.",
    },
    items: {
      type: "array",
      items: { type: "string" },
      description:
        "Purchased line item names from the receipt. Return empty array if none.",
    },
  },
  required: ["amount", "vendor", "spentAt", "category", "items"],
} as const;

export type CreateReceiptInteractionParams = {
  model: string;
  system_instruction: string;
  input: [
    { type: "text"; text: string },
    {
      type: "image";
      data: string;
      mime_type: AllowedReceiptMimeType;
      resolution: "high";
    },
  ];
  response_format: {
    type: "text";
    mime_type: "application/json";
    schema: typeof RECEIPT_RESPONSE_SCHEMA;
  };
  generation_config: {
    thinking_level: "low";
  };
  store: false;
};

export const RECEIPT_SYSTEM_INSTRUCTION = [
  "You extract structured data from a Taiwanese pet store, veterinary clinic, grooming salon, or pet service receipt photo (including Taiwan uniform invoices / 統一發票).",
  'Convert Taiwan ROC (民國) years into Gregorian "YYYY-MM-DD" by adding 1911 (for example, 115/11/20 becomes 2026-11-20).',
  "Category guessing rules:",
  '- vet / 動物醫院 / 獸醫 / 醫療 / 藥 → "medical"',
  '- 飼料 / 罐頭 / pet food / dog food / cat food / 寵物食品 → "food"',
  '- 美容 / 洗澡 / grooming / salon / 修毛 → "grooming"',
  '- 玩具 / toy / 用品 (if clearly not food/medical) → "toy"',
  '- 訓練 / training class → "training"',
  '- 保險 / insurance → "insurance"',
  '- otherwise → "other"',
  "Return ONLY valid JSON matching the provided schema, with no markdown fences or commentary.",
].join("\n");

export const RECEIPT_USER_PROMPT =
  "Extract the total amount in TWD, vendor name, receipt date (YYYY-MM-DD), expense category, and purchased line items from this receipt photo.";

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_RECEIPT_MIME_TYPES);
const VALID_CATEGORY_SET = new Set<string>(VALID_RECEIPT_CATEGORIES);

/**
 * Validate and normalize an untrusted receipt extraction payload.
 */
export function normalizeReceiptRequest(
  raw: unknown,
): NormalizedReceiptRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "Request payload must be an object",
    );
  }
  const data = raw as Record<string, unknown>;

  if (typeof data.mimeType !== "string") {
    throw new HttpsError("invalid-argument", "mimeType is required");
  }
  const baseMime = data.mimeType.split(";")[0].trim().toLowerCase();
  const normalizedMime = baseMime === "image/jpg" ? "image/jpeg" : baseMime;
  if (!ALLOWED_MIME_SET.has(normalizedMime)) {
    throw new HttpsError(
      "invalid-argument",
      `Unsupported receipt image mimeType: ${normalizedMime || "empty"}`,
    );
  }

  if (typeof data.imageBase64 !== "string") {
    throw new HttpsError("invalid-argument", "imageBase64 is required");
  }
  const withoutDataUrl = data.imageBase64
    .trim()
    .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  const cleaned = withoutDataUrl.replace(/\s+/g, "");

  if (!cleaned) {
    throw new HttpsError("invalid-argument", "imageBase64 must not be empty");
  }
  if (cleaned.length > MAX_RECEIPT_BASE64_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      "Receipt image exceeds maximum allowed size",
    );
  }
  if (cleaned.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    throw new HttpsError("invalid-argument", "Invalid base64 image payload");
  }

  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((cleaned.length * 3) / 4) - padding;
  if (decodedBytes <= 0 || decodedBytes > MAX_RECEIPT_IMAGE_BYTES) {
    throw new HttpsError(
      "invalid-argument",
      "Receipt image exceeds maximum allowed size",
    );
  }

  return {
    imageBase64: cleaned,
    mimeType: normalizedMime as AllowedReceiptMimeType,
  };
}

/**
 * Coerce a model-provided category string to a supported ExpenseCategory.
 */
export function coerceReceiptCategory(raw: unknown): ReceiptCategory {
  if (typeof raw === "string" && VALID_CATEGORY_SET.has(raw)) {
    return raw as ReceiptCategory;
  }
  return "other";
}

/**
 * Validate a YYYY-MM-DD string as a real calendar date within [2000, 2100].
 */
export function parseValidIsoDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return undefined;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return undefined;
  }
  return trimmed;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/**
 * Parse and normalize the structured JSON receipt returned by Gemini.
 */
export function parseReceiptResponse(
  outputText: string | undefined,
): ExtractedReceiptResult {
  if (!outputText || !outputText.trim()) {
    throw new HttpsError("internal", "Empty AI receipt response");
  }

  let parsed: Record<string, unknown>;
  try {
    const raw = JSON.parse(stripCodeFences(outputText));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Expected JSON object");
    }
    parsed = raw as Record<string, unknown>;
  } catch {
    throw new HttpsError("internal", "Failed to parse AI receipt response");
  }

  const rawAmount = parsed.amount;
  const amountNum =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string" && rawAmount.trim() !== ""
        ? Number(rawAmount)
        : NaN;
  const amount =
    Number.isFinite(amountNum) && amountNum > 0
      ? Math.round(amountNum * 100) / 100
      : undefined;

  const vendor =
    typeof parsed.vendor === "string"
      ? parsed.vendor.trim().slice(0, 120) || undefined
      : undefined;

  const spentAt = parseValidIsoDate(
    typeof parsed.spentAt === "string" ? parsed.spentAt.trim() : "",
  );

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 50)
    : [];

  return {
    amount,
    vendor,
    spentAt,
    category: coerceReceiptCategory(parsed.category),
    items,
  };
}

/**
 * Enforce a per-user hourly limit (30 requests/hour) in server-only Firestore docs.
 */
export async function enforceReceiptRateLimit(
  db: Firestore,
  uid: string,
  nowMs = Date.now(),
): Promise<void> {
  if (!isFirestoreDocumentId(uid)) {
    throw new HttpsError("invalid-argument", "Invalid user id");
  }
  const ref = db.doc(`aiRateLimits/receipt_${uid}`);
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
      nowMs - windowStartMs >= RECEIPT_RATE_LIMIT_WINDOW_MS
    ) {
      tx.set(ref, {
        uid,
        count: 1,
        windowStartMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (count >= RECEIPT_RATE_LIMIT_MAX) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many receipt scan requests. Please try again later.",
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
 * Call Gemini Interactions API (`gemini-4-hydrogen`) to extract structured receipt data.
 */
export async function extractReceiptWithGemini(
  input: NormalizedReceiptRequest,
  options: {
    apiKey?: string;
    createInteraction?: (
      params: CreateReceiptInteractionParams,
    ) => Promise<{ output_text?: string }>;
  } = {},
): Promise<ExtractedReceiptResult> {
  const params: CreateReceiptInteractionParams = {
    model: RECEIPT_AI_MODEL,
    system_instruction: RECEIPT_SYSTEM_INSTRUCTION,
    input: [
      { type: "text", text: RECEIPT_USER_PROMPT },
      {
        type: "image",
        data: input.imageBase64,
        mime_type: input.mimeType,
        resolution: "high",
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: RECEIPT_RESPONSE_SCHEMA,
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

  return parseReceiptResponse(interaction.output_text);
}
