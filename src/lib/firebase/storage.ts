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

export function fileExt(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;
  const fromMime = file.type.split("/")[1];
  return fromMime ?? "jpg";
}
