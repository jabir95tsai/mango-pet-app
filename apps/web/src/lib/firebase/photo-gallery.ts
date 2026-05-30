import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "./config";
import { listExpenses, listPersonalExpenses } from "./expenses";
import { listPersonalPets, listPets } from "./pets";
import { listMyPosts } from "./posts";
import { listPersonalWalks, listWalks } from "./walks";
import type {
  Expense,
  GalleryPhotoAsset,
  GalleryPhotoSource,
  Pet,
  PhotoDownloadMode,
  Post,
  Walk,
} from "@/lib/types";

export type PhotoGallerySourceKey = "posts" | "walks" | "pets" | "expenses";

export type PhotoGalleryLoadResult = {
  assets: GalleryPhotoAsset[];
  failedSources: PhotoGallerySourceKey[];
};

const MAX_POSTS = 80;
const MAX_WALKS = 120;
const MAX_EXPENSES = 200;

function photoDownloadStateCol(uid: string) {
  return collection(getDb(), "users", uid, "photoDownloadState");
}

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

function millis(ts: Timestamp | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function firstPetName(petIds: string[], petNames: Map<string, string>): string | undefined {
  for (const petId of petIds) {
    const name = petNames.get(petId);
    if (name) return name;
  }
  return undefined;
}

function postAssets(posts: Post[], petNames: Map<string, string>): GalleryPhotoAsset[] {
  return posts.flatMap((post) =>
    (post.photoURLs ?? []).map((url, idx) => ({
      id: stableId("post", post.postId, String(idx)),
      source: "post" as const,
      url,
      title: post.text.trim() || "Post photo",
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
      title: walk.petName ? `${walk.petName} walk photo` : "Walk photo",
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
      title: `${pet.name} avatar`,
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
      title: expense.vendor || "Receipt photo",
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

export async function listMyPhotoAssetsWithStatus(
  uid: string,
  familyId: string | null,
): Promise<PhotoGalleryLoadResult> {
  const petNames = new Map<string, string>();
  const failedSources: PhotoGallerySourceKey[] = [];

  const petsResult = await Promise.allSettled([
    familyId ? listPets(familyId) : listPersonalPets(uid),
  ]);
  const pets =
    petsResult[0].status === "fulfilled"
      ? petsResult[0].value.filter((pet) => pet.ownerUid === uid)
      : [];
  if (petsResult[0].status === "rejected") failedSources.push("pets");
  for (const pet of pets) {
    petNames.set(pet.petId, pet.name);
  }

  const results = await Promise.allSettled([
    listMyPosts(uid, MAX_POSTS).then((posts) => postAssets(posts, petNames)),
    (familyId ? listWalks(familyId, MAX_WALKS) : listPersonalWalks(uid, MAX_WALKS))
      .then((walks) =>
        walkAssets(walks.filter((walk) => (walk.walkerUid ?? walk.ownerUid) === uid)),
      ),
    Promise.resolve(petAssets(pets)),
    (familyId
      ? listExpenses(familyId, { max: MAX_EXPENSES })
      : listPersonalExpenses(uid, { max: MAX_EXPENSES })
    ).then((expenses) =>
      expenseAssets(
        expenses.filter((expense) => (expense.payerUid ?? expense.ownerUid) === uid),
      ),
    ),
  ]);

  const sourceKeys: PhotoGallerySourceKey[] = [
    "posts",
    "walks",
    "pets",
    "expenses",
  ];
  const assets: GalleryPhotoAsset[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      assets.push(...result.value);
    } else {
      failedSources.push(sourceKeys[idx]);
    }
  });

  return {
    assets: dedupeAndSort(assets),
    failedSources: Array.from(new Set(failedSources)),
  };
}

export async function listMyPhotoAssets(
  uid: string,
  familyId: string | null,
): Promise<GalleryPhotoAsset[]> {
  const result = await listMyPhotoAssetsWithStatus(uid, familyId);
  return result.assets;
}

export async function listDownloadedPhotoAssetIds(
  uid: string,
): Promise<Set<string>> {
  const snap = await getDocs(photoDownloadStateCol(uid));
  return new Set(snap.docs.map((d) => d.id));
}

export async function markPhotoAssetsDownloaded(
  uid: string,
  completedAssets: GalleryPhotoAsset[],
  mode: PhotoDownloadMode,
): Promise<void> {
  if (completedAssets.length === 0) return;
  const batch = writeBatch(getDb());
  for (const asset of completedAssets) {
    batch.set(
      doc(photoDownloadStateCol(uid), asset.id),
      {
        assetId: asset.id,
        source: asset.source,
        sourceId: asset.sourceId,
        urlHash: hashString(asset.url),
        downloadedAt: serverTimestamp(),
        mode,
      },
      { merge: true },
    );
  }
  await batch.commit();
}
