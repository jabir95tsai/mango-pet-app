/**
 * WEB PREVIEW ONLY — Metro picks this over ai-receipt.ts when bundling for the
 * browser (docs/features/ios-web-preview.md). Receipt OCR is a billed
 * `extractReceipt` Cloud Function (Gemini) call, so the design preview never
 * makes it: the scanner shows its normal "couldn't read it — enter manually"
 * state instead.
 */
import type { ExtractedReceipt } from "@mango/shared-types";

export async function extractReceipt(
  _base64: string,
  _mimeType: string = "image/jpeg",
): Promise<ExtractedReceipt> {
  throw new Error("Receipt scanning is disabled in the browser preview");
}
