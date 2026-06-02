/**
 * iOS photo compression + upload helpers (P1c). Compress before upload to
 * keep Storage + bandwidth sane, then upload via @react-native-firebase/storage
 * to the SAME paths web uses (storage-paths.ts → matches apps/web byte-for-byte).
 *
 * Compression parity with web's "post" preset
 * (apps/web/src/lib/image-processing.ts: maxWidthOrHeight 1920, jpeg ~0.9,
 * target ~1MB). expo-image-manipulator is quality-based (no maxSizeMB target),
 * so we resize the longest edge to 1920 + jpeg compress 0.8 — same order of
 * magnitude. UI (camera, prompt sheet, composer) is Feature Builder's; this is
 * the data/upload layer only.
 */
import * as ImageManipulator from "expo-image-manipulator";
import storage from "@react-native-firebase/storage";
import { IMAGE_PRESETS } from "@mango/shared-business";
import { petAvatarPath, postPhotoPath, walkPhotoPath } from "./storage-paths";

const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.8;

/**
 * Resize (longest edge → `maxEdge`, default 1920) + JPEG-compress a local image
 * URI. Returns the compressed local URI (always JPEG). expo-image-manipulator
 * is quality-based (no maxSizeMB target), so we resize + jpeg-compress to the
 * same order of magnitude as web's browser-image-compression presets.
 */
export async function compressImage(
  uri: string,
  maxEdge: number = MAX_EDGE_PX,
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxEdge } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

async function uploadJpeg(localUri: string, path: string): Promise<string> {
  const ref = storage().ref(path);
  await ref.putFile(localUri, { contentType: "image/jpeg" });
  return ref.getDownloadURL();
}

/**
 * Compress + upload one walk photo (≤5 per walk). `sessionId` is the walk id;
 * `idx` is 0-4. Returns the Storage download URL to store in walk.photoURLs.
 */
export async function uploadWalkPhoto(
  uri: string,
  walkerUid: string,
  sessionId: string,
  idx: number,
): Promise<string> {
  const compressed = await compressImage(uri);
  const path = walkPhotoPath(walkerUid, sessionId, idx, Date.now(), "jpg");
  return uploadJpeg(compressed, path);
}

/**
 * Compress + upload one post photo. `idx` is 0-based. Returns the Storage
 * download URL to store in post.photoURLs.
 */
export async function uploadPostPhoto(
  uri: string,
  authorUid: string,
  postId: string,
  idx: number,
): Promise<string> {
  const compressed = await compressImage(uri);
  const path = postPhotoPath(authorUid, postId, idx, "jpg");
  return uploadJpeg(compressed, path);
}

/**
 * Compress (avatar preset → 800px longest edge) + upload a pet avatar to
 * `users/{uid}/pets/{petId}/avatar.jpg`. Returns the Storage download URL to
 * store in pet.photoURL. `uid` namespaces the upload (web parity).
 */
export async function uploadPetAvatar(
  uri: string,
  uid: string,
  petId: string,
): Promise<string> {
  const compressed = await compressImage(
    uri,
    IMAGE_PRESETS.avatar.maxWidthOrHeight,
  );
  const path = petAvatarPath(uid, petId, "jpg");
  return uploadJpeg(compressed, path);
}

/**
 * Compress a receipt photo with the shared receipt preset (longest edge 2400,
 * higher quality so OCR stays legible ~150 DPI) and return its base64 — fed
 * straight to the Firebase AI Logic Gemini call (inlineData). Returns the
 * local uri too (for the preview thumbnail). No Storage upload here; the AI
 * scan is ephemeral.
 */
export async function compressReceiptToBase64(
  uri: string,
): Promise<{ uri: string; base64: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: IMAGE_PRESETS.receipt.maxWidthOrHeight } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  return { uri: result.uri, base64: result.base64 ?? "" };
}
