/**
 * Image size / dimension presets — PURE constants shared by web
 * (browser-image-compression) + ios (expo-image-manipulator) so the same
 * avatar / post / receipt is downscaled to the SAME budget on both platforms.
 *
 * - `maxSizeMB`:        soft cap on the output file size.
 * - `maxWidthOrHeight`: cap on the longest edge, in pixels.
 * - `preserveQuality`:  receipts skip aggressive compression so OCR (the
 *                       `extractReceipt` Gemini call) stays legible (~150 DPI).
 *
 * Keep these in lockstep across platforms — a smaller iOS avatar than web
 * (or vice-versa) means the same pet shows at different sharpness per device.
 */
export const IMAGE_PRESETS = {
  avatar: { maxSizeMB: 0.6, maxWidthOrHeight: 800 },
  post: { maxSizeMB: 1, maxWidthOrHeight: 1920 },
  receipt: { maxSizeMB: 3.5, maxWidthOrHeight: 2400, preserveQuality: true },
} as const;

export type ImagePresetName = keyof typeof IMAGE_PRESETS;
export type ImagePreset = (typeof IMAGE_PRESETS)[ImagePresetName];
