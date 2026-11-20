/**
 * iOS receipt OCR — invokes the shared `extractReceipt` Cloud Function
 * (region asia-east1, powered by @google/genai + gemini-4-hydrogen),
 * matching apps/web/src/lib/firebase/ai-receipt.ts.
 */
import { firebase } from "@react-native-firebase/functions";
import type { ExtractReceiptInput, ExtractedReceipt } from "@mango/shared-types";

import { t } from "@/lib/i18n";

const FN_REGION = "asia-east1";

/**
 * Extract structured receipt data from a base64 JPEG (from
 * compressReceiptToBase64). Throws on failure so the caller can fall back to
 * manual entry.
 */
export async function extractReceipt(
  base64: string,
  mimeType: string = "image/jpeg",
): Promise<ExtractedReceipt> {
  if (!base64.trim()) {
    throw new Error(t("PetsPage.scanner.failed"));
  }
  const payload: ExtractReceiptInput = {
    imageBase64: base64,
    mimeType,
  };
  const res = await firebase
    .app()
    .functions(FN_REGION)
    .httpsCallable("extractReceipt")(payload);
  return res.data as ExtractedReceipt;
}
