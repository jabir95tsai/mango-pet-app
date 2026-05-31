/**
 * Leaderboard scoring helper — shared by:
 *   - aggregateLeaderboards (daily 00:30 Asia/Taipei cron, authoritative)
 *   - recomputeWalkerLeaderboards (onCreate(walks/{walkId}) realtime trigger)
 *
 * Centralising the per-walker scoring logic here guarantees both paths
 * produce identical entry shapes — the daily cron reconciles whatever
 * the realtime trigger wrote during the day, and the two should agree
 * within rounding error (in fact: exactly, since both call this helper).
 *
 * Personal-mode walks (`familyId == null`) are skipped, matching the
 * cron's existing `where("familyId", "!=", null)` predicate. The
 * filter lives here so callers can't accidentally diverge.
 */

import {
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

/** Internal aggregation shape — mirrors the cron's `UserAccum`.
 *  Re-exported so the cron + trigger can pass the result to
 *  `writeLeaderboard*` without re-typing every field. */
export type UserAccum = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  city?: string;
  totalScore: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  walkCount: number;
  /** Set of integer day-buckets (`floor(ts/86_400_000)`) — used by
   *  `streakFromDays` downstream. Kept as a Set so the caller's
   *  consecutive-day computation matches the cron exactly. */
  walkDays: Set<number>;
};

export type LeaderboardPeriod = "weekly" | "monthly" | "all_time";

/** Lower-bound for the period, in milliseconds since epoch. `null` for
 *  all_time (no lower bound). `weekly` matches the cron's "last 7 days"
 *  semantics; `monthly` matches the cron's "this calendar month". */
export function periodStartMs(
  period: LeaderboardPeriod,
  now: Date,
): number | null {
  if (period === "all_time") return null;
  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return start.getTime();
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

/** Compute a single walker's leaderboard score for a single period.
 *
 *  Returns `null` when the walker has no qualifying walks in the period
 *  (so the caller knows there's no entry to write — or, for the cron,
 *  the existing entry should be cleaned up because the walker dropped
 *  off the period entirely).
 *
 *  Reads top-level `walks/` only — legacy `users/{uid}/walks/` docs
 *  were migrated to top-level (see firestore.rules "Legacy paths
 *  removed 2026-05-23"), and the cron's existing `where("familyId",
 *  "!=", null)` already excluded any legacy stragglers.
 *
 *  Queries by `walkerUid` (the canonical field — `walks.ts` writes it
 *  on every new walk, and legacy walks are mirrored). The personal-
 *  mode filter (`familyId == null` → skip) happens in memory so we
 *  only need the `(walkerUid ASC, startedAt ASC)` composite index in
 *  firestore.indexes.json — covers both the equality predicate and
 *  the `startedAt >= T` range filter. (The earlier version of this
 *  comment claimed a different index existed; it didn't, and every
 *  trigger fire threw FAILED_PRECONDITION until the real one was
 *  added.) */
export async function computeWalkerPeriodScore(
  walkerUid: string,
  period: LeaderboardPeriod,
  db: Firestore = getFirestore(),
  now: Date = new Date(),
  /** Doc id to exclude from the aggregation. Used by the onDelete
   *  trigger: Firestore's composite-indexed queries are eventually
   *  consistent across the global index, so the just-deleted doc can
   *  still show up in the query result for up to ~1s after the delete
   *  event fires — leaving the entry overcounted by 1 until the next
   *  recompute. Passing the id here makes the trigger deterministic
   *  regardless of how stale the index is. The onCreate trigger doesn't
   *  need this (Firestore is strongly consistent for the just-inserted
   *  doc post-create). */
  excludeWalkId?: string,
): Promise<UserAccum | null> {
  const startMs = periodStartMs(period, now);

  let q = db
    .collection("walks")
    .where("walkerUid", "==", walkerUid) as FirebaseFirestore.Query;
  if (startMs != null) {
    q = q.where("startedAt", ">=", Timestamp.fromMillis(startMs));
  }
  const snap = await q.get();

  let totalScore = 0;
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let walkCount = 0;
  const walkDays = new Set<number>();
  // Diagnostic: track every doc id we encountered + why it was kept
  // or skipped, so when an entry's walkCount doesn't match what the
  // user sees in /app/walks we can immediately spot the leaking doc.
  // Cheap (few docs per walker per period); remove after the
  // post-onDelete-trigger ghost-walk investigation closes.
  const audit: Array<{ id: string; kept: boolean; reason?: string; familyId?: unknown }> = [];

  for (const d of snap.docs) {
    if (excludeWalkId && d.id === excludeWalkId) {
      audit.push({ id: d.id, kept: false, reason: "excludeWalkId" });
      continue;
    }
    const w = d.data();
    // Personal-mode filter — same semantics as the cron's
    // `where("familyId", "!=", null)`. Skipping in-memory keeps the
    // composite-index requirement to (walkerUid, startedAt) only.
    if (w.familyId == null) {
      audit.push({ id: d.id, kept: false, reason: "familyId==null", familyId: w.familyId });
      continue;
    }
    const startedAt = w.startedAt as Timestamp | undefined;
    if (!startedAt) {
      audit.push({ id: d.id, kept: false, reason: "no startedAt", familyId: w.familyId });
      continue;
    }
    totalScore += Number(w.score) || 0;
    totalDistanceKm += Number(w.distanceKm) || 0;
    totalDurationMin += Number(w.durationMin) || 0;
    walkCount += 1;
    walkDays.add(Math.floor(startedAt.toMillis() / 86_400_000));
    audit.push({ id: d.id, kept: true, familyId: w.familyId });
  }

  logger.info(
    `computeWalkerPeriodScore: walker=${walkerUid} period=${period} ` +
      `snapSize=${snap.size} walkCount=${walkCount} ` +
      `audit=${JSON.stringify(audit)}`,
  );

  if (walkCount === 0) return null;

  // Profile lookup last — skipped entirely when the walker has no
  // qualifying walks (saves a read on the personal-mode-only case).
  const profileDoc = await db.doc(`users/${walkerUid}`).get();
  const p = profileDoc.data() ?? {};
  return {
    uid: walkerUid,
    displayName: (p.displayName as string) ?? "Friend",
    photoURL: (p.photoURL as string | null) ?? null,
    city: p.city as string | undefined,
    totalScore,
    totalDistanceKm,
    totalDurationMin,
    walkCount,
    walkDays,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Dog-centric leaderboard (leaderboard v2) — mirrors the walker helper
// but groups by petId instead of walkerUid.
//
// Spec: docs/features/leaderboard-v2-dog-centric.md
//
// Two deliberate differences from the walker path:
//   1. INCLUDES personal-mode walks (familyId == null). A solo user's dog
//      still competes. The walker board keeps excluding personal-mode —
//      that filter is NOT applied here.
//   2. A dog's score sums walks across ANY walker (family members A + B
//      both walking the same dog both credit that dog).
//
// `ownerVisibility` is denormalised from the pet OWNER's
// `users/{ownerUid}.leaderboardVisibility` (per-user master switch,
// default 'public') so the client can filter the friends/all tabs
// without cross-family pet reads.
// ─────────────────────────────────────────────────────────────────────

export type DogVisibility = "public" | "friends" | "off";

export type DogAccum = {
  petId: string;
  petName: string;
  petPhotoURL: string | null;
  breed: string | null;
  species: string;
  ownerUid: string;
  ownerName: string;
  familyId: string | null;
  totalScore: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  walkCount: number;
  /** Day-buckets the dog was walked on by ANY walker — drives the dog's
   *  own "consecutive days walked" streak via `streakFromDays`. */
  walkDays: Set<number>;
  ownerVisibility: DogVisibility;
};

/** Compute one dog's leaderboard accumulation for one period. Returns
 *  null when the dog has no qualifying walks in the period (caller then
 *  knows to skip / clean up the entry). Reads top-level `walks/` by
 *  `petId` — needs the (petId ASC, startedAt ASC) composite index. */
export async function computeDogPeriodScore(
  petId: string,
  period: LeaderboardPeriod,
  db: Firestore = getFirestore(),
  now: Date = new Date(),
  excludeWalkId?: string,
): Promise<DogAccum | null> {
  const startMs = periodStartMs(period, now);

  let q = db
    .collection("walks")
    .where("petId", "==", petId) as FirebaseFirestore.Query;
  if (startMs != null) {
    q = q.where("startedAt", ">=", Timestamp.fromMillis(startMs));
  }
  const snap = await q.get();

  let totalScore = 0;
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let walkCount = 0;
  const walkDays = new Set<number>();
  // Fallbacks for a deleted pet doc — derive display fields from the
  // walks themselves (every walk stores petName + ownerUid/walkerUid).
  let fallbackPetName = "";
  let fallbackOwnerUid = "";
  let fallbackFamilyId: string | null = null;

  for (const d of snap.docs) {
    if (excludeWalkId && d.id === excludeWalkId) continue;
    const w = d.data();
    // NOTE: no `familyId == null` skip — personal-mode dogs count here.
    const startedAt = w.startedAt as Timestamp | undefined;
    if (!startedAt) continue;
    totalScore += Number(w.score) || 0;
    totalDistanceKm += Number(w.distanceKm) || 0;
    totalDurationMin += Number(w.durationMin) || 0;
    walkCount += 1;
    walkDays.add(Math.floor(startedAt.toMillis() / 86_400_000));
    if (!fallbackPetName && typeof w.petName === "string") fallbackPetName = w.petName;
    if (!fallbackOwnerUid) {
      fallbackOwnerUid = (w.ownerUid as string) || (w.walkerUid as string) || "";
    }
    if (w.familyId != null) fallbackFamilyId = w.familyId as string;
  }

  if (walkCount === 0) return null;

  // Pet doc — source of truth for name / photo / breed / species / owner.
  const petDoc = await db.doc(`pets/${petId}`).get();
  const pet = petDoc.data() ?? {};
  const ownerUid = (pet.ownerUid as string) || fallbackOwnerUid;

  // Owner profile — for ownerName + the visibility master switch.
  let ownerName = "Friend";
  let ownerVisibility: DogVisibility = "public";
  if (ownerUid) {
    const ownerDoc = await db.doc(`users/${ownerUid}`).get();
    const o = ownerDoc.data() ?? {};
    ownerName = (o.displayName as string) ?? "Friend";
    const v = o.leaderboardVisibility;
    if (v === "public" || v === "friends" || v === "off") ownerVisibility = v;
  }

  return {
    petId,
    petName: (pet.name as string) || fallbackPetName || "毛孩",
    petPhotoURL: (pet.photoURL as string | null) ?? null,
    breed: (pet.breed as string | null) ?? null,
    species: (pet.species as string) || "dog",
    ownerUid,
    ownerName,
    familyId: (pet.familyId as string | null) ?? fallbackFamilyId,
    totalScore,
    totalDistanceKm,
    totalDurationMin,
    walkCount,
    walkDays,
    ownerVisibility,
  };
}
