/**
 * iOS post data layer (P1c) — writes posts/{postId} (top-level), mirroring web
 * createPost (apps/web/src/lib/firebase/posts.ts). Same collection, same fields
 * (Post type from @mango/shared-types), so the existing feed + Cloud Functions
 * consume iOS-authored posts unchanged. Backend does NOT change.
 *
 * Used by the auto-photo-share flow (walks-auto-photo-share.md): a START post
 * may be created BEFORE the walk doc exists and an END post AFTER — `walkId` is
 * just a string cross-link, the walk doc need not exist when the post is written
 * (readers tolerate a missing referenced doc).
 *
 * UI (PhotoPromptSheet / PostComposer) is Feature Builder's; this is data/upload.
 */
import firestore from "@react-native-firebase/firestore";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type Visibility,
} from "@mango/shared-types";
import { uploadPostPhoto } from "./photos";

function emptyReactionCounts(): Record<ReactionEmoji, number> {
  return REACTION_EMOJIS.reduce(
    (acc, emoji) => {
      acc[emoji] = 0;
      return acc;
    },
    {} as Record<ReactionEmoji, number>,
  );
}

export type CreatePostInput = {
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  petIds: string[];
  text: string;
  visibility: Visibility;
  /** Local image URIs (from camera) to compress + upload, in order. */
  photoUris: string[];
  /** Optional cross-link to a walks/{walkId} doc. The walk doc need NOT exist
   *  yet (START post precedes the walk save). See newWalkId() in walks.ts to
   *  pre-generate a stable walk id at session start. */
  walkId?: string;
};

/**
 * Create a post. Mirrors web createPost behaviour:
 *  1. write the doc (photoURLs:[] + empty reactionCounts; walkId only if set)
 *  2. upload photos with allSettled (one failure doesn't kill the others)
 *  3. orphan rollback — if ALL uploads failed AND there's no text, delete the
 *     empty doc and throw
 *  4. otherwise patch the succeeded photoURLs; if some failed, throw a
 *     partial-failure error (doc kept)
 * Returns the new postId.
 */
export async function createPost(input: CreatePostInput): Promise<string> {
  const db = firestore();
  const ref = db.collection("posts").doc();

  const base: Record<string, unknown> = {
    authorUid: input.authorUid,
    authorName: input.authorName,
    authorPhotoURL: input.authorPhotoURL,
    petIds: input.petIds,
    text: input.text,
    photoURLs: [] as string[],
    visibility: input.visibility,
    createdAt: firestore.FieldValue.serverTimestamp(),
    reactionCounts: emptyReactionCounts(),
  };
  // Only write walkId when present so non-walk composer posts don't carry a
  // stray field.
  if (input.walkId) base.walkId = input.walkId;
  await ref.set(base);

  const results = await Promise.allSettled(
    input.photoUris.map((uri, i) => uploadPostPhoto(uri, input.authorUid, ref.id, i)),
  );

  const photoURLs: string[] = [];
  let failures = 0;
  for (const r of results) {
    if (r.status === "fulfilled") photoURLs.push(r.value);
    else failures++;
  }

  const expected = input.photoUris.length;
  const allFailed = expected > 0 && photoURLs.length === 0;
  const textIsEmpty = !input.text.trim();

  // Orphan rollback — nothing useful made it to the server.
  if (allFailed && textIsEmpty) {
    await ref.delete();
    throw new Error("照片上傳全部失敗，貼文已取消。");
  }

  if (photoURLs.length > 0) {
    await ref.update({ photoURLs });
  }

  if (failures > 0) {
    // Partial failure — doc kept (still has text or some photos); surface so
    // the UI can tell the user.
    throw new Error(
      `${failures}/${expected} 張照片上傳失敗，貼文已建立但缺少部分照片`,
    );
  }

  return ref.id;
}

/** Delete a post (mirrors web deletePost). */
export async function deletePost(postId: string): Promise<void> {
  await firestore().collection("posts").doc(postId).delete();
}
