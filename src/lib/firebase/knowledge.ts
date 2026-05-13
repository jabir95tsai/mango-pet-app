import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import type { KnowledgeArticle, KnowledgeCategory } from "@/lib/types";

const COL = "knowledgeArticles";

export async function listArticles(opts?: {
  category?: KnowledgeCategory;
  max?: number;
}): Promise<KnowledgeArticle[]> {
  const ref = collection(getDb(), COL);
  const q = opts?.category
    ? query(
        ref,
        where("category", "==", opts.category),
        orderBy("publishedAt", "desc"),
        limit(opts.max ?? 50),
      )
    : query(ref, orderBy("publishedAt", "desc"), limit(opts?.max ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...(d.data() as KnowledgeArticle),
    articleId: d.id,
  }));
}

export async function getArticle(id: string): Promise<KnowledgeArticle | null> {
  const snap = await getDoc(doc(getDb(), COL, id));
  return snap.exists()
    ? { ...(snap.data() as KnowledgeArticle), articleId: snap.id }
    : null;
}

// Bookmark articles per user
function bookmarkDoc(uid: string, articleId: string) {
  return doc(getDb(), "users", uid, "knowledgeBookmarks", articleId);
}

export async function listBookmarkedIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(
    collection(getDb(), "users", uid, "knowledgeBookmarks"),
  );
  return new Set(snap.docs.map((d) => d.id));
}

export async function toggleBookmark(
  uid: string,
  articleId: string,
  current: boolean,
): Promise<void> {
  if (current) {
    await deleteDoc(bookmarkDoc(uid, articleId));
  } else {
    await setDoc(bookmarkDoc(uid, articleId), {
      addedAt: serverTimestamp(),
    });
  }
}
