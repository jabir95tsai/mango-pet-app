/**
 * Save / share a remote photo (P3c) — the iOS native-upgrade over web's
 * navigator.share / Blob download. `saveToLibraryAsync` (PhotosKit) needs a
 * LOCAL file uri, so we first localise the Storage URL with expo-image-
 * manipulator (already installed; no expo-file-system needed). Mirrors
 * save-photo-to-album.md intent.
 */
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

/** Download a remote image to a local cache uri (no resize — preserve quality). */
async function localise(url: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(url, [], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 1,
  });
  return result.uri;
}

/**
 * Save a remote photo to the device Photos library. Requests add-only
 * permission first (writeOnly = true). Throws on denial or failure so the
 * caller can surface a message.
 */
export async function savePhotoToAlbum(url: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    throw new Error("需要相簿儲存權限");
  }
  const localUri = await localise(url);
  await MediaLibrary.saveToLibraryAsync(localUri);
}

/** Open the native share sheet for a remote photo. */
export async function sharePhoto(url: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("此裝置不支援分享");
  }
  const localUri = await localise(url);
  await Sharing.shareAsync(localUri, { mimeType: "image/jpeg" });
}
