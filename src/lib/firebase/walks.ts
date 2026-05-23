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
  /** `null` to create a personal-mode walk (lives outside any family;
   *  permission gated by walker == self per rules). Personal walks do
   *  NOT contribute to the public leaderboard — guarded server-side in
   *  the aggregator to avoid score-farming. */
  familyId: string | null;
  /** The actual walker — credited on leaderboards. */
  walkerUid: string;
  walkerName?: string;
  walkerPhotoURL?: string | null;
  score: number;
};

export async function createWalk(args: CreateWalkArgs): Promise<Walk> {
  const data = {
    // familyId preserved explicitly (including null) so personal-mode
    // queries `where("familyId", "==", null)` actually match.
    familyId: args.familyId,
    ...clean({
      walkerUid: args.walkerUid,
      walkerName: args.walkerName,
      walkerPhotoURL: args.walkerPhotoURL,
      // Keep ownerUid mirrored so legacy leaderboard aggregation (which
      // still groups by ownerUid) sees the walker. Removed in a later
      // cleanup pass.
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
    }),
  };
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

/** Personal-mode counterpart of {@link listWalks}: walks the signed-in
 *  user took outside any family. Index:
 *  `(walkerUid ASC, familyId ASC, startedAt DESC)`. */
export async function listPersonalWalks(
  walkerUid: string,
  max = 50,
): Promise<Walk[]> {
  const snap = await getDocs(
    query(
      walksCol(),
      where("walkerUid", "==", walkerUid),
      where("familyId", "==", null),
      orderBy("startedAt", "desc"),
      fsLimit(max),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Walk), walkId: d.id }));
}

export async function deleteWalk(walkId: string): Promise<void> {
  await deleteDoc(walkDoc(walkId));
}

// Legacy `users/{uid}/walks/*` migration helper was removed 2026-05-23
// along with the legacy data + rules; see
// docs/features/legacy-path-cleanup.md.
