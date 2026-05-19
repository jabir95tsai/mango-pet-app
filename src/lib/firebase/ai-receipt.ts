import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { getFirebaseApp } from "./config";
import type { ExpenseCategory, ExtractedReceipt } from "@/lib/types";

const MODEL = "gemini-2.0-flash";

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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fence ? fence[1].trim() : trimmed;
}

function coerceCategory(raw: unknown): ExpenseCategory {
  if (typeof raw === "string" && VALID_CATEGORIES.includes(raw as ExpenseCategory)) {
    return raw as ExpenseCategory;
  }
  return "other";
}

export async function extractReceipt(file: File): Promise<ExtractedReceipt> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large (max 8 MB).");
  }

  const ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const base64 = await fileToBase64(file);

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        mimeType: file.type,
        data: base64,
      },
    },
  ]);

  const text = result.response.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(text)) as Record<string, unknown>;
  } catch (err) {
    console.error("[ai-receipt] failed to parse JSON:", text);
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
