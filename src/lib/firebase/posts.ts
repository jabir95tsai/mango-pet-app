import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import {
  fileExt,
  postPhotoPath,
  uploadImage,
} from "./storage";
import {
  REACTION_EMOJIS,
  type Post,
  type PostInput,
  type ReactionEmoji,
} from "@/lib/types";

const POSTS = "posts";

function postsCol() {
  return collection(getDb(), POSTS);
}

function emptyReactionCounts(): Record<ReactionEmoji, number> {
  return REACTION_EMOJIS.reduce(
    (acc, emoji) => {
      acc[emoji] = 0;
      return acc;
    },
    {} as Record<ReactionEmoji, number>,
  );
}

export type CreatePostArgs = PostInput & {
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  photos: File[];
};

export async function createPost(args: CreatePostArgs): Promise<Post> {
  const docRef = await addDoc(postsCol(), {
    authorUid: args.authorUid,
    authorName: args.authorName,
    authorPhotoURL: args.authorPhotoURL,
    petIds: args.petIds,
    text: args.text,
    photoURLs: [] as string[],
    visibility: args.visibility,
    createdAt: serverTimestamp(),
    reactionCounts: emptyReactionCounts(),
  });

  const uploads = await Promise.all(
    args.photos.map((file, i) =>
      uploadImage(postPhotoPath(args.authorUid, docRef.id, i, fileExt(file)), file),
    ),
  );

  const photoURLs = uploads.map((u) => u.url);
  if (photoURLs.length > 0) {
    await updateDoc(docRef, { photoURLs });
  }

  const snap = await getDoc(docRef);
  return { ...(snap.data() as Post), postId: snap.id };
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(getDb(), POSTS, postId));
}

export async function listPublicPosts(max = 30): Promise<Post[]> {
  const snap = await getDocs(
    query(
      postsCol(),
      where("visibility", "==", "public"),
      orderBy("createdAt", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
}

export async function listMyPosts(uid: string, max = 30): Promise<Post[]> {
  const snap = await getDocs(
    query(
      postsCol(),
      where("authorUid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
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
      const snap = await getDocs(
        query(
          postsCol(),
          where("authorUid", "in", chunk),
          where("visibility", "in", ["friends", "public"]),
          orderBy("createdAt", "desc"),
          limit(max),
        ),
      );
      return snap.docs.map((d) => ({ ...(d.data() as Post), postId: d.id }));
    }),
  );
  return results.flat();
}

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
    const ta = (a.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    const tb = (b.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    return tb - ta;
  });
}

function reactionDoc(postId: string, uid: string) {
  return doc(getDb(), POSTS, postId, "reactions", uid);
}

export async function getMyReaction(
  postId: string,
  uid: string,
): Promise<ReactionEmoji | null> {
  const snap = await getDoc(reactionDoc(postId, uid));
  return snap.exists() ? (snap.data().emoji as ReactionEmoji) : null;
}

export async function setReaction(
  postId: string,
  uid: string,
  emoji: ReactionEmoji | null,
): Promise<void> {
  const current = await getMyReaction(postId, uid);
  const postRef = doc(getDb(), POSTS, postId);

  if (current === emoji) return;

  if (current && current !== emoji) {
    await updateDoc(postRef, {
      [`reactionCounts.${current}`]: increment(-1),
    });
  }

  if (emoji) {
    await setDoc(reactionDoc(postId, uid), {
      uid,
      emoji,
      reactedAt: serverTimestamp(),
    });
    await updateDoc(postRef, {
      [`reactionCounts.${emoji}`]: increment(1),
    });
  } else {
    await deleteDoc(reactionDoc(postId, uid));
  }
}
