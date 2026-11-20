import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./config";
import type { ExtractReceiptInput, ExtractedReceipt } from "@/lib/types";

const FN_REGION = "asia-east1";
const MAX_RECEIPT_FILE_BYTES = 6 * 1024 * 1024;

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

function mapReceiptCallableError(err: unknown): Error {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  switch (code) {
    case "functions/unauthenticated":
      return new Error("請先登入再使用 AI 收據辨識。");
    case "functions/resource-exhausted":
      return new Error("AI 辨識次數已達上限，請稍後再試或手動輸入。");
    case "functions/invalid-argument":
      return new Error("圖片格式不支援或檔案過大，請重新選擇收據照片。");
    case "functions/failed-precondition":
    case "functions/unavailable":
      return new Error("AI 收據辨識服務暫時無法使用，請稍後再試或手動輸入。");
    default:
      return new Error("AI 回傳的結果無法解析，請手動輸入。");
  }
}

export async function extractReceipt(file: File): Promise<ExtractedReceipt> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }
  if (file.size > MAX_RECEIPT_FILE_BYTES) {
    throw new Error("Image is too large (max 6 MB).");
  }

  const imageBase64 = await fileToBase64(file);
  const fns = getFunctions(getFirebaseApp(), FN_REGION);
  const fn = httpsCallable<ExtractReceiptInput, ExtractedReceipt>(
    fns,
    "extractReceipt",
  );

  try {
    const res = await fn({ imageBase64, mimeType: file.type });
    return res.data;
  } catch (err) {
    console.error("[ai-receipt] extractReceipt callable failed:", err);
    throw mapReceiptCallableError(err);
  }
}
