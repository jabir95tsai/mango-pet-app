/**
 * Firebase Storage object paths — MUST match apps/web byte-for-byte
 * (apps/web/src/lib/firebase/storage.ts) so iOS-uploaded photos live at the
 * same locations the web app + any future server logic expect. Spec
 * docs/features/ios-p1-walks.md §Storage.
 */

/** Walk photo (≤5 per walk). Web: storage.ts:49. `sessionId` is the walk id
 *  (photos may be uploaded under a session id that becomes the walkId). */
export function walkPhotoPath(
  walkerUid: string,
  sessionId: string,
  idx: number,
  ts: number,
  ext: string,
): string {
  return `users/${walkerUid}/walks/${sessionId}/photos/${idx}-${ts}.${ext}`;
}

/** Post photo. Web: storage.ts:33. */
export function postPhotoPath(
  authorUid: string,
  postId: string,
  idx: number,
  ext: string,
): string {
  return `users/${authorUid}/posts/${postId}/${idx}.${ext}`;
}
