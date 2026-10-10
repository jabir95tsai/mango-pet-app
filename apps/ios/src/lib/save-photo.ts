/**
 * Save / share a photo — the iOS native-upgrade over web's navigator.share /
 * Blob download. `saveToLibraryAsync` (PhotosKit) needs a LOCAL file uri:
 * remote Storage URLs are downloaded byte-for-byte to the cache
 * (expo-file-system) — no re-encode — and the temp file is removed afterwards.
 * ImageManipulator is only a fallback for a download / format the library
 * rejects. Local `file://` uris (fresh camera captures) are saved directly.
 *
 * Permission is add-only (writeOnly). Batch callers ask once via
 * `ensureAddPermission()` and pass `skipPermission`; a denial throws a
 * `PhotoPermissionError` so screens can offer iOS Settings.
 */
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

import { t } from "./i18n";

export class PhotoPermissionError extends Error {
  readonly code = "permission";
  constructor() {
    super(t("Common.saveToAlbum.permissionDenied"));
    this.name = "PhotoPermissionError";
  }
}

/** Ask (once) for add-only Photos access. */
export async function ensureAddPermission(): Promise<boolean> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  return perm.granted;
}

function extOf(url: string): string {
  const path = decodeURIComponent(url.split("?")[0] ?? "");
  const m = /\.([a-z0-9]{3,4})$/i.exec(path);
  const ext = m?.[1]?.toLowerCase();
  return ext && ["jpg", "jpeg", "png", "heic", "webp", "gif"].includes(ext) ? ext : "jpg";
}

/** Local copy of `url` + whether it is a temp file we must delete. */
async function localise(url: string): Promise<{ uri: string; temp: boolean }> {
  if (!/^https?:/i.test(url)) return { uri: url, temp: false };
  const target = `${FileSystem.cacheDirectory}mango-photo-${Date.now()}-${Math.round(Math.random() * 1e6)}.${extOf(url)}`;
  try {
    const res = await FileSystem.downloadAsync(url, target);
    if (res.status >= 200 && res.status < 300) return { uri: res.uri, temp: true };
    void FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
  } catch {
    /* fall through to the re-encode fallback */
  }
  const result = await ImageManipulator.manipulateAsync(url, [], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 1,
  });
  return { uri: result.uri, temp: true };
}

/** Save a photo to the device Photos library. Throws on denial / failure. */
export async function savePhotoToAlbum(
  url: string,
  opts: { skipPermission?: boolean } = {},
): Promise<void> {
  if (!opts.skipPermission && !(await ensureAddPermission())) throw new PhotoPermissionError();
  const { uri, temp } = await localise(url);
  try {
    await MediaLibrary.saveToLibraryAsync(uri);
  } finally {
    if (temp) void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

/** Open the native share sheet for a photo. */
export async function sharePhoto(url: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(t("Common.shareUnavailable"));
  const { uri } = await localise(url);
  await Sharing.shareAsync(uri, { mimeType: "image/jpeg" });
}
