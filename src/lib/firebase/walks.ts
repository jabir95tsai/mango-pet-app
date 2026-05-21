import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./config";
import type { Walk, WalkInput } from "@/lib/types";

const WALKS = "walks";

function walksCol() {
  return collection(getDb(), WALKS);
}

function walkDoc(walkId: string) {
  return doc(getDb(), WALKS, walkId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export type CreateWalkArgs = WalkInput & {
  familyId: string;
  /** The actual walker — credited on leaderboards. */
  walkerUid: string;
  walkerName?: string;
  walkerPhotoURL?: string | null;
  score: number;
};

export async function createWalk(args: CreateWalkArgs): Promise<Walk> {
  const data = clean({
    familyId: args.familyId,
    walkerUid: args.walkerUid,
    walkerName: args.walkerName,
    walkerPhotoURL: args.walkerPhotoURL,
    // Keep ownerUid mirrored so legacy leaderboard aggregation (which still
    // groups by ownerUid) sees the walker. Removed in a later cleanup pass.
    ownerUid: args.walkerUid,
    petId: args.petId,
    petName: args.petName,
    startedAt: Timestamp.fromDate(args.startedAt),
    endedAt: Timestamp.fromDate(args.endedAt),
    distanceKm: args.distanceKm,
    durationMin: args.durationMin,
    path: args.path,
    isManual: args.isManual,
    score: args.score,
    notes: args.notes,
    createdAt: serverTimestamp(),
  });
  const docRef = await addDoc(walksCol(), data);
  // Re-read so caller sees server-set timestamps (and any rule-applied
  // coercion). Worth the extra round-trip — walks are infrequent writes.
  const snap = await getDoc(docRef);
  return { ...(snap.data() as Walk), walkId: docRef.id };
}

export async function listWalks(familyId: string, max = 50): Promise<Walk[]> {
  const snap = await getDocs(
    query(
      walksCol(),
      where("familyId", "==", familyId),
      orderBy("startedAt", "desc"),
      fsLimit(max),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Walk), walkId: d.id }));
}

export async function deleteWalk(walkId: string): Promise<void> {
  await deleteDoc(walkDoc(walkId));
}

/** One-shot migration: copy `users/{uid}/walks/*` to top-level walks/* with
 *  familyId + walkerUid set. Idempotent — won't overwrite existing top-level
 *  docs with the same id. */
export async function migrateLegacyWalksToFamily(
  legacyUid: string,
  familyId: string,
): Promise<number> {
  const legacy = await getDocs(
    collection(getDb(), "users", legacyUid, "walks"),
  );
  if (legacy.empty) return 0;

  let migrated = 0;
  // Firestore batches max 500 ops; chunk just in case.
  const docs = legacy.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const slice = docs.slice(i, i + 400);
    const batch = writeBatch(getDb());
    for (const legacyDoc of slice) {
      const newRef = doc(getDb(), WALKS, legacyDoc.id);
      const existing = await getDoc(newRef);
      if (existing.exists()) continue;
      const data = legacyDoc.data();
      batch.set(newRef, {
        ...data,
        familyId,
        walkerUid: data.ownerUid ?? legacyUid,
      });
      migrated++;
    }
    if (migrated > 0) await batch.commit();
  }
  return migrated;
}
