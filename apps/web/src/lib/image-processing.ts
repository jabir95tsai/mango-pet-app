"use client";

/**
 * Client-side image pipeline:
 *
 *  1. Detect iPhone HEIC/HEIF and convert to JPEG (uses heic2any, lazy-loaded).
 *  2. Compress + downscale to a target size/dimension (uses browser-image-
 *     compression, lazy-loaded). Both libs are browser-only and heavy enough
 *     to want lazy loading.
 *
 * Why: Chrome/Firefox cannot render HEIC, so uploading a raw iPhone photo
 * means everyone except Safari sees a broken image. Compression also keeps
 * Firebase Storage / network usage sane.
 */

export type ProcessOptions = {
  /** Soft cap on output size. Default 1 MB. */
  maxSizeMB?: number;
  /** Cap the longest edge in pixels. Default 1920. */
  maxWidthOrHeight?: number;
  /** Skip compression entirely (still converts HEIC). Use for receipts/OCR. */
  preserveQuality?: boolean;
  /** Called with progress 0–1 during compression. */
  onProgress?: (progress: number) => void;
};

const HEIC_EXT_RE = /\.(heic|heif)$/i;
const HEIC_MIME_RE = /^image\/(heic|heif)/i;

function isHeic(file: File): boolean {
  return HEIC_MIME_RE.test(file.type) || HEIC_EXT_RE.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const blob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  const jpegBlob = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name.replace(HEIC_EXT_RE, ".jpg");
  return new File([jpegBlob], newName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Run a File through the HEIC→JPEG + compression pipeline.
 * Returns a new File ready to upload. Throws on non-image input.
 */
export async function processImage(
  file: File,
  opts: ProcessOptions = {},
): Promise<File> {
  if (!isImage(file)) {
    throw new Error("這個檔案不是圖片");
  }

  const {
    maxSizeMB = 1,
    maxWidthOrHeight = 1920,
    preserveQuality = false,
    onProgress,
  } = opts;

  let current = file;

  // Step 1: HEIC/HEIF → JPEG (iPhone default since iOS 11).
  if (isHeic(file)) {
    try {
      current = await convertHeicToJpeg(file);
    } catch (err) {
      console.error("[image-processing] HEIC conversion failed", err);
      throw new Error(
        "iPhone HEIC 格式轉換失敗。請在 iPhone 設定 → 相機 → 格式 → 改成「相容性最高」(JPEG)，再重試。",
      );
    }
  }

  // Step 2: compress + resize unless caller wants original quality.
  const needsShrink =
    current.size > maxSizeMB * 1024 * 1024 || maxWidthOrHeight < Number.POSITIVE_INFINITY;
  if (!preserveQuality && needsShrink) {
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      current = await imageCompression(current, {
        maxSizeMB,
        maxWidthOrHeight,
        useWebWorker: true,
        fileType: "image/jpeg",
        onProgress,
      });
    } catch (err) {
      console.error("[image-processing] compression failed", err);
      // Don't block the upload — just use the (possibly large) original.
    }
  } else if (preserveQuality && current.size > maxSizeMB * 1024 * 1024) {
    // Receipts: only shrink if WAY over budget, keep dimensions higher.
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      current = await imageCompression(current, {
        maxSizeMB,
        maxWidthOrHeight,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.92,
        onProgress,
      });
    } catch {
      // ignore
    }
  }

  return current;
}

/** Predefined presets for the places that upload images. Definition now
 *  lives in @mango/shared-business (web + ios share one set of dimensions);
 *  re-exported here so existing `@/lib/image-processing` imports of
 *  `IMAGE_PRESETS` keep working unchanged. */
export { IMAGE_PRESETS } from "@mango/shared-business";
