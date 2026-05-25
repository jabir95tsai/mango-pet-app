/**
 * Save-to-album helper — Web Share API wrapper that lets the user
 * pipe a freshly-picked image into the OS share sheet, where "Save
 * Image" is the path into iOS Photos / Android MediaStore.
 *
 * Spec docs/features/save-photo-to-album.md (D1). PWAs can't write
 * directly into the system photo library — that's a sandbox rule,
 * not a Mango bug. Web Share API with `files` is the only path that
 * iOS Safari honours; an `<a download>` fallback was rejected in
 * the spec because iOS routes downloads into Files App, not Photos.
 *
 * `canSaveToAlbum` is sync so the calling component can decide
 * render-or-not without an async dance — Web Share with files is
 * available on iOS 16.4+ and Android Chrome 84+; everything else
 * returns false and the spec-mandated UX is to hide the button
 * outright (no disabled state + tooltip noise).
 */

/** Returns true when this browser supports `navigator.share({ files: [...] })`
 *  for the given file (or for files in general when called without one).
 *
 *  Two call modes:
 *    - `canSaveToAlbum()` — probe support before any file exists
 *      (e.g., to early-out before mounting the file input listener).
 *      Returns true whenever `navigator.canShare` exists at all.
 *    - `canSaveToAlbum(file)` — strict per-file check; calls
 *      `navigator.canShare({ files: [file] })` which gates on both the
 *      browser feature AND whether the OS share targets accept the
 *      file's MIME type (HEIC, e.g., works on iOS but not desktop). */
export function canSaveToAlbum(file?: File): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function") return false;
  if (!file) return true;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    // Some implementations throw on unsupported MIME types rather
    // than returning false. Treat throw as "no".
    return false;
  }
}

/** Outcomes the caller renders distinct UI for:
 *    - `ok: true`              → success, swap the button icon to ✓
 *    - `reason: "dismissed"`   → user closed the share sheet, no error
 *    - `reason: "unsupported"` → caller shouldn't have rendered the button
 *    - `reason: "failed"`      → genuine failure, show a quiet error */
export type SaveToAlbumResult = {
  ok: boolean;
  reason?: "unsupported" | "dismissed" | "failed";
};

/** Open the OS share sheet for `file`. The user picks "Save Image"
 *  (iOS) / "Save to Photos" (Android) — or any other share target —
 *  themselves.
 *
 *  AbortError from a dismissed share sheet is the standard signal
 *  for "user closed it"; we report that as `dismissed` so the
 *  caller doesn't flash an error state when the user just changed
 *  their mind. */
export async function saveToAlbum(
  file: File,
  title = "Mango Pet",
): Promise<SaveToAlbumResult> {
  if (!canSaveToAlbum(file)) return { ok: false, reason: "unsupported" };
  try {
    await navigator.share({ files: [file], title });
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, reason: "dismissed" };
    }
    return { ok: false, reason: "failed" };
  }
}
