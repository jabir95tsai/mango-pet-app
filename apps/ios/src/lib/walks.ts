/**
 * iOS walk data layer — writes `walks/{walkId}` via @react-native-firebase
 * with EXACTLY the fields the existing leaderboard Cloud Functions + web feed
 * expect (spec docs/features/ios-p1-walks.md §Data contract). No backend is
 * changed: the `onDocumentCreated("walks/{walkId}")` trigger recomputes the
 * leaderboard automatically (and skips it when `familyId == null`).
 *
 * `score` is computed with the SHARED formula (@mango/shared-business) so iOS
 * and web produce identical scores — the leaderboard sums these stored values.
 */
import firestore from "@react-native-firebase/firestore";
import { computeWalkScore, type ScorablePet } from "@mango/shared-business";
import type { WalkPathPoint } from "@mango/shared-types";

export type CreateWalkInput = {
  /** Pet fields the score formula reads (RNFB Timestamp satisfies it). */
  scorePet: ScorablePet | null;
  /** Current streak (days) — feeds the score formula. */
  streakDays: number;
  /** `null` = personal mode → NOT on the leaderboard (trigger short-circuits). */
  familyId: string | null;
  walkerUid: string;
  walkerName: string;
  walkerPhotoURL?: string | null;
  petId: string;
  petName?: string | null;
  startedAt: Date;
  endedAt: Date;
  distanceKm: number;
  durationMin: number;
  /** ≤500 sampled points (the tracking service already caps this). */
  path?: WalkPathPoint[];
  isManual: boolean;
  notes?: string | null;
  /** ≤5 Storage download URLs (see storage-paths.walkPhotoPath). */
  photoURLs?: string[];
  /** Pre-generated walk id (from newWalkId()) so an auto-photo-share START
   *  post created BEFORE the walk is saved can cross-link to the same id. When
   *  omitted, an id is auto-generated. */
  walkId?: string;
};

/** Pre-generate a stable walks/{walkId} id at walk-session start. Use it for
 *  the walk photos' sessionId + a START post's `walkId` cross-link, then pass
 *  the same id to createWalk() at save time. */
export function newWalkId(): string {
  return firestore().collection("walks").doc().id;
}

/**
 * Persist a completed walk. Returns the new `walkId`. The doc shape mirrors
 * the web `createWalk` write so the same triggers/feed consume it unchanged.
 */
export async function createWalk(input: CreateWalkInput): Promise<string> {
  const db = firestore();
  const ref = input.walkId
    ? db.collection("walks").doc(input.walkId)
    : db.collection("walks").doc();

  const score = computeWalkScore({
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    pet: input.scorePet,
    streakDays: input.streakDays,
  });

  await ref.set({
    walkId: ref.id,
    familyId: input.familyId, // null = personal (no leaderboard)
    walkerUid: input.walkerUid,
    walkerName: input.walkerName,
    walkerPhotoURL: input.walkerPhotoURL ?? null,
    ownerUid: input.walkerUid, // legacy mirror of walkerUid
    petId: input.petId,
    petName: input.petName ?? null,
    startedAt: firestore.Timestamp.fromDate(input.startedAt),
    endedAt: firestore.Timestamp.fromDate(input.endedAt),
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    path: input.path ?? [],
    isManual: input.isManual,
    score,
    notes: input.notes ?? null,
    photoURLs: input.photoURLs ?? [],
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return ref.id;
}
