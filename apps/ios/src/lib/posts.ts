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
import firestore, {
  type FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  COMMENT_MAX_LEN,
  REACTION_EMOJIS,
  type Comment,
  type Post,
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

/** Delete a post (mirrors web deletePost). Cloud Functions cascade-delete the
 *  reactions + comments subcollections; this client only removes the doc. */
export async function deletePost(postId: string): Promise<void> {
  await firestore().collection("posts").doc(postId).delete();
}

// ── Feed reads (mirror apps/web/src/lib/firebase/posts.ts byte-for-byte so both
//    platforms hit the SAME composite indexes; one-shot getDocs, no onSnapshot)

function postsCol() {
  return firestore().collection("posts");
}

function mapPosts(
  snap: FirebaseFirestoreTypes.QuerySnapshot,
): Post[] {
  return snap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
}

export async function listPublicPosts(max = 30): Promise<Post[]> {
  const snap = await postsCol()
    .where("visibility", "==", "public")
    .orderBy("createdAt", "desc")
    .limit(max)
    .get();
  return mapPosts(snap);
}

export async function listMyPosts(uid: string, max = 30): Promise<Post[]> {
  const snap = await postsCol()
    .where("authorUid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(max)
    .get();
  return mapPosts(snap);
}

export async function listFriendsPosts(
  friendUids: string[],
  max = 30,
): Promise<Post[]> {
  if (friendUids.length === 0) return [];
  // Firestore "in" supports up to 30 values; chunk if more.
  const chunks: string[][] = [];
  for (let i = 0; i < friendUids.length; i += 30) {
    chunks.push(friendUids.slice(i, i + 30));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await postsCol()
        .where("authorUid", "in", chunk)
        .where("visibility", "in", ["friends", "public"])
        .orderBy("createdAt", "desc")
        .limit(max)
        .get();
      return mapPosts(snap);
    }),
  );
  return results.flat();
}

/** Mixed feed = own + public + friends-visible, deduped, newest-first.
 *  Identical aggregation to web listFeedPosts. */
export async function listFeedPosts(
  uid: string,
  friendUids: string[] = [],
  max = 30,
): Promise<Post[]> {
  const [mine, publicPosts, friendsPosts] = await Promise.all([
    listMyPosts(uid, max),
    listPublicPosts(max),
    listFriendsPosts(friendUids, max),
  ]);
  const dedup = new Map<string, Post>();
  for (const p of [...mine, ...publicPosts, ...friendsPosts]) {
    dedup.set(p.postId, p);
  }
  return Array.from(dedup.values()).sort((a, b) => {
    const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    return tb - ta;
  });
}

// ── Reactions: posts/{postId}/reactions/{uid}. The CLIENT maintains
//    post.reactionCounts via increment (mirrors web setReaction — NOT a server
//    trigger). commentCount, by contrast, is server-maintained.

function reactionDoc(postId: string, uid: string) {
  return postsCol().doc(postId).collection("reactions").doc(uid);
}

export async function getMyReaction(
  postId: string,
  uid: string,
): Promise<ReactionEmoji | null> {
  const snap = await reactionDoc(postId, uid).get();
  return snap.exists ? ((snap.data()?.emoji as ReactionEmoji) ?? null) : null;
}

/** Set/clear the current user's reaction. Re-reads current first so the
 *  count increments balance (mirrors web). Pass `null` to remove. */
export async function setReaction(
  postId: string,
  uid: string,
  emoji: ReactionEmoji | null,
): Promise<void> {
  const current = await getMyReaction(postId, uid);
  if (current === emoji) return;
  const postRef = postsCol().doc(postId);

  if (current && current !== emoji) {
    await postRef.update({
      [`reactionCounts.${current}`]: firestore.FieldValue.increment(-1),
    });
  }
  if (emoji) {
    await reactionDoc(postId, uid).set({
      uid,
      emoji,
      reactedAt: firestore.FieldValue.serverTimestamp(),
    });
    await postRef.update({
      [`reactionCounts.${emoji}`]: firestore.FieldValue.increment(1),
    });
  } else {
    await reactionDoc(postId, uid).delete();
  }
}

// ── Comments: posts/{postId}/comments/{commentId}. Flat, oldest-first, cursor
//    paginated (NOT onSnapshot — "點開才讀"). commentCount denorm is maintained
//    ONLY by Cloud Functions onCreate/onDelete; this client never writes it.

export type CreateCommentArgs = {
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
};

export async function createComment(
  args: CreateCommentArgs,
): Promise<{ commentId: string }> {
  const text = args.text.trim();
  if (!text) throw new Error("留言不能是空白");
  if (text.length > COMMENT_MAX_LEN) {
    throw new Error(`留言最多 ${COMMENT_MAX_LEN} 字`);
  }
  const ref = await postsCol().doc(args.postId).collection("comments").add({
    authorUid: args.authorUid,
    authorName: args.authorName,
    authorPhotoURL: args.authorPhotoURL,
    text,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  return { commentId: ref.id };
}

/** Delete a comment. Rules allow the comment author OR the post author. */
export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  await postsCol().doc(postId).collection("comments").doc(commentId).delete();
}

export type CommentPage = {
  comments: Comment[];
  /** Cursor for the next page; pass back as `after`. Null when exhausted. */
  cursor: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

/** One page of comments, oldest-first. Pass the previous page's `cursor` as
 *  `after` to page forward. Default page size 20 (web parity). */
export async function listComments(
  postId: string,
  pageSize = 20,
  after: FirebaseFirestoreTypes.QueryDocumentSnapshot | null = null,
): Promise<CommentPage> {
  let q = postsCol()
    .doc(postId)
    .collection("comments")
    .orderBy("createdAt", "asc");
  if (after) q = q.startAfter(after);
  const snap = await q.limit(pageSize).get();
  const comments = snap.docs.map((d) => ({
    ...(d.data() as Omit<Comment, "commentId">),
    commentId: d.id,
  }));
  const cursor =
    snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
  return { comments, cursor };
}
