import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { getFirebaseStorage } from "./config";

export async function uploadImage(
  path: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const storage = getFirebaseStorage();
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}

export async function deleteImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), path));
  } catch (err) {
    if ((err as { code?: string }).code !== "storage/object-not-found") throw err;
  }
}

export function petAvatarPath(uid: string, petId: string, ext: string): string {
  return `users/${uid}/pets/${petId}/avatar.${ext}`;
}

export function postPhotoPath(uid: string, postId: string, idx: number, ext: string): string {
  return `users/${uid}/posts/${postId}/${idx}.${ext}`;
}

/** Path for one walk photo. Lives under the walker's own namespace so
 *  the existing `users/{uid}/{allPaths=**}` storage rule covers writes
 *  (uploader == self) and reads (any signed-in family member). Spec
 *  caps at 5 per walk; `idx` is 0-4 and `ts` is `Date.now()` to keep
 *  filenames unique within an idx slot when the user deletes + re-takes
 *  the same slot. */
export function walkPhotoPath(
  uid: string,
  walkId: string,
  idx: number,
  ts: number,
  ext: string,
): string {
  return `users/${uid}/walks/${walkId}/photos/${idx}-${ts}.${ext}`;
}

export function fileExt(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;
  const fromMime = file.type.split("/")[1];
  return fromMime ?? "jpg";
}
