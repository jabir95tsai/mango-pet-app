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
  setDoc,
  Timestamp,
  type QueryConstraint,
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

function withOptionalLimit(
  constraints: QueryConstraint[],
  max: number | null,
): QueryConstraint[] {
  return max === null ? constraints : [...constraints, fsLimit(max)];
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
  /** Optional pre-minted doc id. Set by the walks-auto-photo-share
   *  flow so the START post (published BEFORE the walk doc is
   *  saved) can cross-link to the same walkId the eventual walk doc
   *  will carry. When omitted, falls back to Firestore's auto id. */
  walkId?: string;
};

/** Mint a Firestore-auto walk id without writing yet. Used by the
 *  walks-auto-photo-share flow so the START post can publish with
 *  the correct `walkId` cross-link before the walk doc itself
 *  exists. Returns a string id from `doc(collection)` — Firestore's
 *  client-side id generator is collision-safe for our scale. */
export function mintWalkId(): string {
  return doc(walksCol()).id;
}

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
      // Spec D2 caps at 5; client pre-uploads each photo to Storage
      // during tracking, then hands the resulting download URLs here.
      // Empty array is fine — the `clean` helper strips it.
      photoURLs: args.photoURLs?.length ? args.photoURLs : undefined,
      createdAt: serverTimestamp(),
    }),
  };
  let docRef;
  if (args.walkId) {
    // Pre-minted id from the auto-photo-share flow — use setDoc so the
    // resulting walk lands at the same id the START post already
    // cross-links to.
    docRef = walkDoc(args.walkId);
    await setDoc(docRef, data);
  } else {
    docRef = await addDoc(walksCol(), data);
  }
  // Re-read so caller sees server-set timestamps (and any rule-applied
  // coercion). Worth the extra round-trip — walks are infrequent writes.
  const snap = await getDoc(docRef);
  return { ...(snap.data() as Walk), walkId: docRef.id };
}

export async function listWalks(
  familyId: string,
  max: number | null = 50,
): Promise<Walk[]> {
  const snap = await getDocs(
    query(
      walksCol(),
      ...withOptionalLimit(
        [where("familyId", "==", familyId), orderBy("startedAt", "desc")],
        max,
      ),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Walk), walkId: d.id }));
}

/** Personal-mode counterpart of {@link listWalks}: walks the signed-in
 *  user took outside any family. Index:
 *  `(walkerUid ASC, familyId ASC, startedAt DESC)`. */
export async function listPersonalWalks(
  walkerUid: string,
  max: number | null = 50,
): Promise<Walk[]> {
  const snap = await getDocs(
    query(
      walksCol(),
      ...withOptionalLimit(
        [
          where("walkerUid", "==", walkerUid),
          where("familyId", "==", null),
          orderBy("startedAt", "desc"),
        ],
        max,
      ),
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
