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
import { postPhotoPath, walkPhotoPath } from "./storage-paths";

const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.8;

/**
 * Resize (longest edge → 1920) + JPEG-compress a local image URI. Returns the
 * compressed local URI (always JPEG). NOTE: resize targets width 1920; phone
 * camera photos (≫1920px) downsize. A source already < 1920px wide would be
 * upscaled — acceptable for camera photos; revisit if we add gallery import.
 */
export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_EDGE_PX } }],
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
