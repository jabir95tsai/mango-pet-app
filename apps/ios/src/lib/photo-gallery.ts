/**
 * iOS photo-gallery aggregator (P3c) — mirrors apps/web/src/lib/firebase/
 * photo-gallery.ts. Builds a unified GalleryPhotoAsset list from the user's
 * posts + walks + pet avatars + expense receipts, using the SAME stable asset
 * ids (so users/{uid}/photoDownloadState docs match across platforms). Reuses
 * the already-shipped iOS scope helpers. Read + a downloaded-state write only;
 * no backend change.
 */
import firestore from "@react-native-firebase/firestore";
import type {
  Expense,
  GalleryPhotoAsset,
  GalleryPhotoSource,
  Pet,
  PhotoDownloadMode,
  Post,
  Walk,
} from "@mango/shared-types";

import { listMyPosts } from "./posts";
import { listPetsForScope, listWalksForScope } from "./walk-data";
import { listExpensesForScope } from "./pets-data";

export type PhotoGallerySourceKey = "posts" | "walks" | "pets" | "expenses";

export type PhotoGalleryLoadResult = {
  assets: GalleryPhotoAsset[];
  failedSources: PhotoGallerySourceKey[];
};

const MAX_POSTS = 80;
const MAX_WALKS = 120;
const MAX_EXPENSES = 200;

function safeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function sourceFilePart(source: GalleryPhotoSource): string {
  switch (source) {
    case "post":
      return "post";
    case "walk":
      return "walk";
    case "pet-avatar":
      return "pet-avatar";
    case "expense-receipt":
      return "receipt";
  }
}

function fileNameFor(
  source: GalleryPhotoSource,
  sourceId: string,
  indexOrKind: string,
): string {
  const id = safeSlug(sourceId) || "photo";
  const suffix = safeSlug(indexOrKind) || "image";
  return `mango-pet-${sourceFilePart(source)}-${id}-${suffix}.jpg`;
}

function stableId(
  source: GalleryPhotoSource,
  sourceId: string,
  indexOrKind: string,
): string {
  return `${source}:${sourceId}:${indexOrKind}`;
}

function millis(ts: { toMillis?: () => number } | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function firstPetName(
  petIds: string[],
  petNames: Map<string, string>,
): string | undefined {
  for (const petId of petIds) {
    const name = petNames.get(petId);
    if (name) return name;
  }
  return undefined;
}

function postAssets(
  posts: Post[],
  petNames: Map<string, string>,
): GalleryPhotoAsset[] {
  return posts.flatMap((post) =>
    (post.photoURLs ?? []).map((url, idx) => ({
      id: stableId("post", post.postId, String(idx)),
      source: "post" as const,
      url,
      title: post.text.trim() || "貼文照片",
      createdAt: post.createdAt,
      sourceId: post.postId,
      petId: post.petIds[0],
      petName: firstPetName(post.petIds, petNames),
      fileName: fileNameFor("post", post.postId, String(idx)),
    })),
  );
}

function walkAssets(walks: Walk[]): GalleryPhotoAsset[] {
  return walks.flatMap((walk) =>
    (walk.photoURLs ?? []).map((url, idx) => ({
      id: stableId("walk", walk.walkId, String(idx)),
      source: "walk" as const,
      url,
      title: walk.petName ? `${walk.petName} 散步照` : "散步照片",
      createdAt: walk.startedAt,
      sourceId: walk.walkId,
      petId: walk.petId,
      petName: walk.petName,
      fileName: fileNameFor("walk", walk.walkId, String(idx)),
    })),
  );
}

function petAssets(pets: Pet[]): GalleryPhotoAsset[] {
  return pets
    .filter((pet) => Boolean(pet.photoURL))
    .map((pet) => ({
      id: stableId("pet-avatar", pet.petId, "avatar"),
      source: "pet-avatar" as const,
      url: pet.photoURL!,
      title: `${pet.name} 頭像`,
      createdAt: pet.createdAt,
      sourceId: pet.petId,
      petId: pet.petId,
      petName: pet.name,
      fileName: fileNameFor("pet-avatar", pet.petId, "avatar"),
    }));
}

function expenseAssets(expenses: Expense[]): GalleryPhotoAsset[] {
  return expenses
    .filter((expense) => Boolean(expense.receiptURL))
    .map((expense) => ({
      id: stableId("expense-receipt", expense.expenseId, "receipt"),
      source: "expense-receipt" as const,
      url: expense.receiptURL!,
      title: expense.vendor || "收據照片",
      createdAt: expense.spentAt,
      sourceId: expense.expenseId,
      petId: expense.petId,
      petName: expense.petName,
      fileName: fileNameFor("expense-receipt", expense.expenseId, "receipt"),
    }));
}

function dedupeAndSort(assets: GalleryPhotoAsset[]): GalleryPhotoAsset[] {
  const byUrl = new Map<string, GalleryPhotoAsset>();
  for (const asset of assets) {
    if (!asset.url || byUrl.has(asset.url)) continue;
    byUrl.set(asset.url, asset);
  }
  return Array.from(byUrl.values()).sort(
    (a, b) => millis(b.createdAt) - millis(a.createdAt),
  );
}

/** Build the user's gallery. familyId scopes walks/pets/expenses (personal when
 *  null); only the user's own rows are kept (walkerUid / ownerUid / payerUid). */
export async function listMyPhotoAssetsWithStatus(
  uid: string,
  familyId: string | null,
): Promise<PhotoGalleryLoadResult> {
  const petNames = new Map<string, string>();
  const failedSources: PhotoGallerySourceKey[] = [];

  let pets: Pet[] = [];
  try {
    const all = await listPetsForScope(familyId, uid);
    pets = all.filter((p) => p.ownerUid === uid);
    for (const pet of pets) petNames.set(pet.petId, pet.name);
  } catch {
    failedSources.push("pets");
  }

  const results = await Promise.allSettled([
    listMyPosts(uid, MAX_POSTS).then((posts) => postAssets(posts, petNames)),
    listWalksForScope(familyId, uid, MAX_WALKS).then((walks) =>
      walkAssets(walks.filter((w) => (w.walkerUid ?? w.ownerUid) === uid)),
    ),
    Promise.resolve(petAssets(pets)),
    listExpensesForScope(familyId, uid, MAX_EXPENSES).then((expenses) =>
      expenseAssets(
        expenses.filter((e) => (e.payerUid ?? e.ownerUid) === uid),
      ),
    ),
  ]);

  const sourceKeys: PhotoGallerySourceKey[] = ["posts", "walks", "pets", "expenses"];
  const assets: GalleryPhotoAsset[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") assets.push(...result.value);
    else failedSources.push(sourceKeys[idx]);
  });

  return {
    assets: dedupeAndSort(assets),
    failedSources: Array.from(new Set(failedSources)),
  };
}

export async function listDownloadedPhotoAssetIds(
  uid: string,
): Promise<Set<string>> {
  try {
    const snap = await firestore()
      .collection("users")
      .doc(uid)
      .collection("photoDownloadState")
      .get();
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
}

/** Record that the given assets were saved/shared (mirrors web batch write to
 *  users/{uid}/photoDownloadState/{assetId}). Best-effort; not user-blocking. */
export async function markPhotoAssetsDownloaded(
  uid: string,
  assets: GalleryPhotoAsset[],
  mode: PhotoDownloadMode,
): Promise<void> {
  if (assets.length === 0) return;
  const db = firestore();
  const batch = db.batch();
  const col = db.collection("users").doc(uid).collection("photoDownloadState");
  for (const asset of assets) {
    batch.set(
      col.doc(asset.id),
      {
        assetId: asset.id,
        source: asset.source,
        sourceId: asset.sourceId,
        urlHash: hashString(asset.url),
        downloadedAt: firestore.FieldValue.serverTimestamp(),
        mode,
      },
      { merge: true },
    );
  }
  await batch.commit();
}
