/**
 * iOS walk data layer — writes `walks/{walkId}` via @react-native-firebase
 * with EXACTLY the fields the existing leaderboard Cloud Functions + web feed
 * expect (spec docs/features/ios-p1-walks.md §Data contract). No backend is
 * changed: the `onDocumentCreated("walks/{walkId}")` trigger recomputes the
 * leaderboard automatically (and skips it when `familyId == null`).
 *
 * `score` is computed with the SHARED formula (@mango/shared-business) so iOS
 * and web produce identical scores — the leaderboard sums these stored values.
 *
 * Idempotency (TRACK-9, web apps/web/src/lib/firebase/walks.ts createWalk):
 * a tracked walk carries a pre-minted id and may be retried after an uncertain
 * acknowledgement (timeout, app backgrounded, recovered local draft). A plain
 * `set()` retry would be an UPDATE touching createdAt/score/…, which
 * firestore.rules (walks update: notes/photoURLs only) rejects — so the walk
 * would look "unsaved" forever. Like web we create-if-missing in a
 * transaction and treat an existing doc from the SAME session as success.
 */
import firestore from "@react-native-firebase/firestore";
import { computeWalkScore, type ScorablePet } from "@mango/shared-business";
import type { WalkPathPoint } from "@mango/shared-types";

export type CreateWalkInput = {
  /** Pet fields the score formula reads (RNFB Timestamp satisfies it). */
  scorePet: ScorablePet | null;
  /** Current streak (days) — feeds the score formula. */
  streakDays: number;
  /** Precomputed score (frozen at stop / stored in a local draft). When set,
   *  it is written as-is and `scorePet` / `streakDays` are ignored. */
  score?: number;
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

/** The shared score formula for a walk input (honours a precomputed score). */
export function walkScoreOf(input: CreateWalkInput): number {
  if (typeof input.score === "number" && Number.isFinite(input.score)) return input.score;
  return computeWalkScore({
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    pet: input.scorePet,
    streakDays: input.streakDays,
  });
}

type TimestampLike = { toMillis?: () => number } | null | undefined;

function millisOf(value: unknown): number | null {
  const ts = value as TimestampLike;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

/**
 * Persist a completed walk. Returns the new `walkId`. The doc shape mirrors
 * the web `createWalk` write so the same triggers/feed consume it unchanged.
 *
 * With a pre-minted `walkId` the write is create-if-missing (transaction):
 * a retry after the first write already landed resolves successfully without
 * touching the stored doc; a doc from a DIFFERENT session under the same id
 * is rejected (web parity).
 */
export async function createWalk(input: CreateWalkInput): Promise<string> {
  const db = firestore();
  const ref = input.walkId
    ? db.collection("walks").doc(input.walkId)
    : db.collection("walks").doc();

  const data = {
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
    score: walkScoreOf(input),
    notes: input.notes ?? null,
    photoURLs: input.photoURLs ?? [],
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  if (!input.walkId) {
    // Manual entries mint their own id and are never retried on the same id.
    await ref.set(data);
    return ref.id;
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, data);
      return;
    }
    const saved = snap.data() ?? {};
    if (
      saved.walkerUid !== input.walkerUid ||
      saved.petId !== input.petId ||
      (saved.familyId ?? null) !== input.familyId ||
      millisOf(saved.startedAt) !== input.startedAt.getTime() ||
      millisOf(saved.endedAt) !== input.endedAt.getTime()
    ) {
      throw new Error("Walk ID is already used by another session.");
    }
    // Same session already persisted (lost ack) → success, no write.
  });

  return ref.id;
}

/**
 * Recap edits after the core save (web updateWalkDetails). Only `notes` and
 * `photoURLs` change — the only keys firestore.rules lets the walker update —
 * so the walk is never re-created and its score/timestamps never move.
 */
export async function updateWalkDetails(
  walkId: string,
  details: { notes: string; photoURLs: string[] },
): Promise<void> {
  await firestore().collection("walks").doc(walkId).update({
    notes: details.notes,
    photoURLs: details.photoURLs,
  });
}

/**
 * Delete a walk (web deleteWalk). Rules allow the personal owner or any
 * member of the walk's family; the leaderboard trigger re-aggregates.
 */
export async function deleteWalk(walkId: string): Promise<void> {
  await firestore().collection("walks").doc(walkId).delete();
}
