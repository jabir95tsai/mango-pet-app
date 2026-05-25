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

  for (const d of snap.docs) {
    if (excludeWalkId && d.id === excludeWalkId) continue;
    const w = d.data();
    // Personal-mode filter — same semantics as the cron's
    // `where("familyId", "!=", null)`. Skipping in-memory keeps the
    // composite-index requirement to (walkerUid, startedAt) only.
    if (w.familyId == null) continue;
    const startedAt = w.startedAt as Timestamp | undefined;
    if (!startedAt) continue;
    totalScore += Number(w.score) || 0;
    totalDistanceKm += Number(w.distanceKm) || 0;
    totalDurationMin += Number(w.durationMin) || 0;
    walkCount += 1;
    walkDays.add(Math.floor(startedAt.toMillis() / 86_400_000));
  }

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
