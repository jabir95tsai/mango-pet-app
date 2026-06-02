/**
 * Mango Pet — Cloud Functions
 *
 *   - scanReminders: every 15 min, sends FCM push for due reminders.
 *   - aggregateLeaderboards: daily at 00:30 Asia/Taipei, recomputes weekly/monthly/all-time scores.
 *   - acceptFriendRequest / removeFriend: callable, mutates both sides atomically.
 *
 * Deploy:
 *   firebase deploy --only functions
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import {
  computeWalkerPeriodScore,
  computeDogPeriodScore,
  type UserAccum,
  type DogAccum,
} from "./leaderboard-helpers";
import {
  createMutualFriendship,
  pairId,
  type CreateFriendshipResult,
} from "./friendship-helpers";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TITLES,
  applyWalkToLifetimeStats,
  evaluateAchievements,
  type AchievementDef,
  type AchievementMetrics,
} from "./achievements";

initializeApp();

const db = getFirestore();
// Strip `undefined` from writes instead of throwing. Optional fields
// like `users.city` are commonly absent, and writers across
// aggregateLeaderboards / recomputeWalkerLeaderboards / etc. spread
// the value directly into `set()` — pre-flag, that triggered "Cannot
// use 'undefined' as a Firestore value (found in field 'city')" and
// every leaderboard write failed. Safe to enable globally: the
// existing call sites either intend the field to be present OR want
// it elided, and Firestore docs explicitly recommend this flag for
// admin code that shapes payloads from optional sources.
db.settings({ ignoreUndefinedProperties: true });
const messaging = getMessaging();

// Keep this aligned with the largest "notify before" option in the reminder form.
// The function queries by trigger time, so a one-week advance notification must
// include reminders whose trigger is still a week away.
const LOOK_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const FUNCTION_REGION = "asia-east1";

/** True when the callable's auth token is an anonymous (guest) sign-in.
 *  Guests are blocked from community callables (createFamily /
 *  joinFamilyByCode / acceptFriendRequest) — a defense-in-depth layer on
 *  top of the firestore.rules `isRealUser()` gate (these callables write
 *  via Admin SDK, which bypasses rules, so the check must live here too).
 *  Spec docs/features/guest-login.md §C. */
function isGuestAuth(req: { auth?: { token?: { firebase?: { sign_in_provider?: string } } } }): boolean {
  return req.auth?.token?.firebase?.sign_in_provider === "anonymous";
}

// ─────────────────────────────────────────────────────────────────────
// scanReminders — every 15 min
// ─────────────────────────────────────────────────────────────────────

export const scanReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 2,
    memory: "256MiB",
  },
  async () => {
    const now = Timestamp.now();
    const nowMs = now.toMillis();

    // collectionGroup catches both:
    //   - legacy: users/{uid}/reminders/*
    //   - new:    reminders/{reminderId} (top-level, family-scoped)
    // We dispatch by whether the doc has a `familyId` field. Once all
    // legacy data is migrated and the legacy paths are deleted, the
    // collectionGroup query will only return top-level docs.
    const snap = await db
      .collectionGroup("reminders")
      .where("done", "==", false)
      .where("notified", "==", false)
      .where("triggerAt", "<=", Timestamp.fromMillis(nowMs + LOOK_AHEAD_MS))
      .get();

    logger.info(`scanReminders: candidate count = ${snap.size}`);

    let sent = 0;
    let deferred = 0;
    let noTokens = 0;
    let failed = 0;

    for (const reminderDoc of snap.docs) {
      try {
        const reminder = reminderDoc.data();
        const triggerMs = (reminder.triggerAt as Timestamp).toMillis();
        const notifyBeforeMs =
          (Number(reminder.notifyBeforeMinutes) || 0) * 60 * 1000;
        const dueAt = triggerMs - notifyBeforeMs;

        if (dueAt > nowMs) {
          deferred++;
          continue;
        }

        // Determine recipient uids:
        //   - Family reminder (top-level with familyId): broadcast to all
        //     members of the family. Anyone can mark done, so everyone
        //     should know the pet needs attention.
        //   - Legacy per-user reminder: send only to that user.
        let recipientUids: string[];
        const familyId = reminder.familyId as string | undefined;
        if (familyId) {
          const famSnap = await db.doc(`families/${familyId}`).get();
          const fam = famSnap.data();
          recipientUids = ((fam?.memberUids ?? []) as string[]).filter(Boolean);
        } else {
          const parentUid = reminderDoc.ref.parent.parent?.id;
          recipientUids = parentUid ? [parentUid] : [];
        }

        if (recipientUids.length === 0) {
          await reminderDoc.ref.update({ notified: true, notifiedAt: now });
          continue;
        }

        // Collect FCM tokens from every recipient. Each token-removal write
        // happens against its own user doc, so we keep track of which uid
        // each token came from for later cleanup.
        const tokensWithOwner: { uid: string; token: string }[] = [];
        const userRefByUid = new Map<string, FirebaseFirestore.DocumentReference>();
        for (const recipUid of recipientUids) {
          const userRef = db.doc(`users/${recipUid}`);
          const userSnap = await userRef.get();
          userRefByUid.set(recipUid, userRef);
          const t = ((userSnap.data()?.fcmTokens ?? []) as string[]).filter(Boolean);
          for (const tok of t) tokensWithOwner.push({ uid: recipUid, token: tok });
        }

        if (tokensWithOwner.length === 0) {
          await reminderDoc.ref.update({ notified: true, notifiedAt: now });
          noTokens++;
          continue;
        }

        const title = (reminder.title as string) || "Mango Pet";
        const body =
          (reminder.description as string) ||
          (reminder.petId ? "🐾 提醒到時間了" : "🔔 提醒到時間了");

        const tokensList = tokensWithOwner.map((t) => t.token);
        const response = await messaging.sendEachForMulticast({
          tokens: tokensList,
          notification: { title, body },
          data: {
            reminderId: reminderDoc.id,
            petId: (reminder.petId as string) || "",
            url: reminder.petId ? `/app/pets/${reminder.petId}` : "/app",
          },
          webpush: {
            fcmOptions: {
              link: reminder.petId ? `/app/pets/${reminder.petId}` : "/app",
            },
          },
        });

        // Group invalid tokens by their owner uid for per-user arrayRemove.
        const invalidByUid = new Map<string, string[]>();
        response.responses.forEach((r, idx) => {
          if (!r.success && r.error) {
            const code = r.error.code;
            if (
              code === "messaging/invalid-registration-token" ||
              code === "messaging/registration-token-not-registered"
            ) {
              const { uid, token } = tokensWithOwner[idx];
              const list = invalidByUid.get(uid) ?? [];
              list.push(token);
              invalidByUid.set(uid, list);
            }
          }
        });
        for (const [uid, tokens] of invalidByUid) {
          const ref = userRefByUid.get(uid);
          if (!ref) continue;
          await ref.update({
            fcmTokens: FieldValue.arrayRemove(...tokens),
          });
        }

        await reminderDoc.ref.update({ notified: true, notifiedAt: now });
        sent++;
      } catch (err) {
        failed++;
        logger.error(
          `Failed processing reminder ${reminderDoc.ref.path}`,
          err,
        );
      }
    }

    logger.info(
      `scanReminders done — sent=${sent} deferred=${deferred} noTokens=${noTokens} failed=${failed}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// aggregateLeaderboards — daily 00:30 Asia/Taipei
// ─────────────────────────────────────────────────────────────────────
//
// Per-walker per-period scoring lives in `leaderboard-helpers.ts` so
// the realtime trigger (recomputeWalkerLeaderboards) and this cron
// produce identical entries — see docs/features/family-leaderboard-
// realtime.md "確保兩條 path 算出來的值一致". `UserAccum` is re-
// exported from there.

function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `weekly_${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `monthly_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function streakFromDays(days: Set<number>): number {
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort((a, b) => b - a);
  const todayIdx = Math.floor(Date.now() / 86_400_000);
  if (sorted[0] < todayIdx - 1) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === 1) streak++;
    else break;
  }
  return streak;
}

async function writeLeaderboard(
  periodKey: string,
  accums: Map<string, UserAccum>,
): Promise<void> {
  await writeLeaderboardWithRanks(periodKey, accums);
}

/** Writes a leaderboard period AND tracks per-uid rank diffs. The
 *  written `previousRank` field is THIS run's rank — next run reads
 *  it back as "the rank you had a moment ago" for the B1 (Phase 2)
 *  rank-overtake push. Returns the diff so the caller can wire push
 *  logic without re-querying. */
async function writeLeaderboardWithRanks(
  periodKey: string,
  accums: Map<string, UserAccum>,
): Promise<{
  /** Each uid → rank as stored on the existing entry (i.e., the rank
   *  written by the *previous* aggregation run). Missing = first time
   *  we're seeing this uid on this leaderboard. */
  oldPreviousRanks: Map<string, number>;
  /** Each uid → rank we're about to write (1-indexed). */
  newRanks: Map<string, number>;
}> {
  const now = Timestamp.now();
  const collection = db.collection(`leaderboards/${periodKey}/entries`);

  // 1. Read existing entries — both for the cleanup pass below AND
  //    to capture each uid's `previousRank` for the diff.
  const existing = await collection.get();
  const oldPreviousRanks = new Map<string, number>();
  for (const doc of existing.docs) {
    const prev = doc.data().previousRank;
    if (typeof prev === "number") oldPreviousRanks.set(doc.id, prev);
  }

  // 2. Compute today's rank (1-indexed, totalScore DESC, ties broken
  //    by uid for determinism).
  const sortedUids = [...accums.entries()]
    .sort(([uidA, a], [uidB, b]) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return uidA < uidB ? -1 : uidA > uidB ? 1 : 0;
    })
    .map(([uid]) => uid);
  const newRanks = new Map<string, number>();
  sortedUids.forEach((uid, i) => newRanks.set(uid, i + 1));

  // 3. Same write pattern as before, plus the `previousRank` field
  //    (this run's rank — next run reads it back as "previous").
  const currentUids = new Set(accums.keys());
  const batch = db.batch();
  for (const doc of existing.docs) {
    if (!currentUids.has(doc.id)) batch.delete(doc.ref);
  }
  for (const a of accums.values()) {
    const rank = newRanks.get(a.uid) ?? 0;
    batch.set(collection.doc(a.uid), {
      uid: a.uid,
      displayName: a.displayName,
      photoURL: a.photoURL,
      city: a.city,
      totalScore: Math.round(a.totalScore * 10) / 10,
      totalDistanceKm: Math.round(a.totalDistanceKm * 100) / 100,
      totalDurationMin: Math.round(a.totalDurationMin),
      walkCount: a.walkCount,
      streakDays: streakFromDays(a.walkDays),
      updatedAt: now,
      // lastUpdatedAt tracks the *score-changing* write — both cron
      // reconciliation and realtime trigger set it. Client glow hook
      // compares this across snapshots to detect a fresh write.
      lastUpdatedAt: now,
      previousRank: rank,
    });
  }
  await batch.commit();

  return { oldPreviousRanks, newRanks };
}

export const aggregateLeaderboards = onSchedule(
  {
    schedule: "30 0 * * *",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 1,
    memory: "512MiB",
  },
  async () => {
    const now = new Date();
    const weekKey = isoWeekLabel(now);
    const monthKey = monthLabel(now);

    // Enumerate active walker uids via the same collectionGroup query
    // we've always used — Phase 0 family-leaderboard filter (personal-
    // mode walks excluded) is preserved. We only need the set of uids
    // here; the helper re-queries each walker's walks per period to
    // do the actual aggregation. That doubles the read fan-out vs the
    // old single-pass loop, but at daily cron cadence + Firestore's
    // per-walker query being tiny, the cost is negligible — and it's
    // the price for sharing the codepath with the realtime trigger
    // (the whole point of this refactor).
    const allWalks = await db
      .collectionGroup("walks")
      .where("familyId", "!=", null)
      .get();
    const walkerUids = new Set<string>();
    for (const d of allWalks.docs) {
      const w = d.data();
      const uid = (w.walkerUid as string) || (w.ownerUid as string);
      if (uid) walkerUids.add(uid);
    }
    logger.info(
      `aggregateLeaderboards: walks=${allWalks.size} walkers=${walkerUids.size}`,
    );

    const weekly = new Map<string, UserAccum>();
    const monthly = new Map<string, UserAccum>();
    const allTime = new Map<string, UserAccum>();

    // Per-walker score via the shared helper. Parallel inside each
    // walker (3 periods) but serial across walkers — keeps the cron's
    // peak concurrency bounded for the (rare) thousands-of-walkers
    // case without needing a queue.
    for (const uid of walkerUids) {
      const [w, m, a] = await Promise.all([
        computeWalkerPeriodScore(uid, "weekly", db, now),
        computeWalkerPeriodScore(uid, "monthly", db, now),
        computeWalkerPeriodScore(uid, "all_time", db, now),
      ]);
      if (w) weekly.set(uid, w);
      if (m) monthly.set(uid, m);
      if (a) allTime.set(uid, a);
    }

    // Weekly + monthly use the same writer (they need previousRank
    // stored too if we ever want per-period overtake push, but Phase 2
    // B1 only acts on all_time per spec). all_time goes through the
    // diff-returning variant so we can push to anyone who dropped.
    const [, , allTimeResult] = await Promise.all([
      writeLeaderboard(weekKey, weekly),
      writeLeaderboard(monthKey, monthly),
      writeLeaderboardWithRanks("all_time", allTime),
    ]);

    logger.info(
      `aggregateLeaderboards done — weekly=${weekly.size}, monthly=${monthly.size}, all=${allTime.size}`,
    );

    // Phase 2 B1 — rank-overtake push. Runs against all_time only.
    await runRankOvertakePushes(allTimeResult, allTime);

    // Dog-centric board (leaderboard v2) — same batch, same cron, no new
    // scheduled function (cost rule). Isolated so a dog-pass failure can't
    // undo the walker aggregation already committed above; the next run
    // reconciles idempotently.
    try {
      await runDogLeaderboardAggregation(now);
    } catch (err) {
      logger.error("runDogLeaderboardAggregation failed", err as Error);
    }

    // Rank achievements (rank-top10 / rank-1-week / rank-1-month). Reads the
    // entries just written above and evaluates the top users. Isolated so a
    // failure can't undo the aggregation. Low frequency (daily cron) per
    // spec §C "排行榜類在 aggregateLeaderboards cron 評估即可".
    try {
      await runRankAchievements(weekKey, monthKey);
    } catch (err) {
      logger.error("runRankAchievements failed", err as Error);
    }
  },
);

/** Evaluate the leaderboard-rank badges against the freshly-written
 *  entries. rank-top10 / rank-1-week come from the WEEKLY walker board OR
 *  weekly dog board (spec: "任一週 weekly 人榜或狗榜 rank ≤ 10"); rank-1-month
 *  from the MONTHLY walker board. Ranks are computed by sorting entries on
 *  totalScore DESC (same ordering the writers use). Guests are already
 *  excluded from both boards, so they can't appear here. */
async function runRankAchievements(
  weekKey: string,
  monthKey: string,
): Promise<void> {
  // Rank a collection's entries by totalScore DESC → uid→rank (1-indexed).
  // `ownerKey` extracts the user uid from an entry (walker entries are keyed
  // by uid; dog entries denormalise ownerUid).
  const rankByScore = (
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    ownerKey: (d: FirebaseFirestore.DocumentData) => string | undefined,
  ): Map<string, number> => {
    const rows = docs
      .map((d) => ({ uid: ownerKey(d.data()), score: Number(d.data().totalScore) || 0 }))
      .filter((r): r is { uid: string; score: number } => !!r.uid)
      .sort((a, b) => b.score - a.score);
    const out = new Map<string, number>();
    // Dense 1-indexed rank; a user's BEST rank wins if they own multiple
    // dog entries (take the first/highest).
    rows.forEach((r, i) => {
      const rank = i + 1;
      if (!out.has(r.uid) || rank < (out.get(r.uid) as number)) out.set(r.uid, rank);
    });
    return out;
  };

  const [weeklyWalker, monthlyWalker, weeklyDog] = await Promise.all([
    db.collection(`leaderboards/${weekKey}/entries`).get(),
    db.collection(`leaderboards/${monthKey}/entries`).get(),
    db.collection(`dogLeaderboards/${weekKey}/entries`).get(),
  ]);

  const weeklyWalkerRanks = rankByScore(weeklyWalker.docs, (d) => d.uid as string);
  const monthlyWalkerRanks = rankByScore(monthlyWalker.docs, (d) => d.uid as string);
  const weeklyDogRanks = rankByScore(weeklyDog.docs, (d) => d.ownerUid as string);

  // Best weekly rank per uid = min(walker weekly, dog weekly).
  const weeklyBest = new Map<string, number>();
  for (const [uid, r] of weeklyWalkerRanks) weeklyBest.set(uid, r);
  for (const [uid, r] of weeklyDogRanks) {
    if (!weeklyBest.has(uid) || r < (weeklyBest.get(uid) as number)) {
      weeklyBest.set(uid, r);
    }
  }

  // Only the users who could possibly earn a rank badge need evaluating:
  // weekly rank ≤ 10 (covers rank-top10 + rank-1-week) and monthly rank == 1.
  const toEval = new Set<string>();
  for (const [uid, r] of weeklyBest) if (r <= 10) toEval.add(uid);
  for (const [uid, r] of monthlyWalkerRanks) if (r === 1) toEval.add(uid);

  for (const uid of toEval) {
    await runAchievementEval(uid, {
      weeklyRank: weeklyBest.get(uid),
      monthlyRank: monthlyWalkerRanks.get(uid),
    });
  }
  logger.info(`runRankAchievements: evaluated ${toEval.size} top users`);
}

// ─────────────────────────────────────────────────────────────────────
// recomputeWalkerLeaderboards — onCreate(walks/{walkId}) realtime
// Spec: docs/features/family-leaderboard-realtime.md
//
// When a walk doc is created, recompute the walker's three leaderboard
// entries (weekly / monthly / all_time) so family members watching the
// leaderboard see the score update within 1-2s instead of next-day.
// Personal-mode walks (`familyId == null`) short-circuit — they're
// not on the leaderboard at all (cron applies the same filter).
//
// Does NOT recompute other family members — each member's own onCreate
// trigger fires when THEY walk. Does NOT touch ranks or push (B1 keeps
// its daily-throttled cadence; this trigger is pure score writeback +
// `lastUpdatedAt` bump for the client glow).
// ─────────────────────────────────────────────────────────────────────

export const recomputeWalkerLeaderboards = onDocumentCreated(
  {
    document: "walks/{walkId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const walk = event.data?.data();
    if (!walk) return;
    const walkerUid = (walk.walkerUid as string) || (walk.ownerUid as string);
    if (!walkerUid) return;
    // Personal-mode walks never reach the leaderboard — bail before
    // doing any reads. Same filter the cron applies via
    // `where("familyId", "!=", null)`.
    if (walk.familyId == null) return;

    const now = new Date();
    const weekKey = isoWeekLabel(now);
    const monthKey = monthLabel(now);

    // Recompute all 3 periods in parallel. Helper returns null when
    // the walker has no qualifying walks for that period (shouldn't
    // happen here — the just-created walk qualifies for all 3 — but
    // we guard so we never write a zero-score entry by accident).
    const [w, m, a] = await Promise.all([
      computeWalkerPeriodScore(walkerUid, "weekly", db, now),
      computeWalkerPeriodScore(walkerUid, "monthly", db, now),
      computeWalkerPeriodScore(walkerUid, "all_time", db, now),
    ]);

    const writes: Array<Promise<unknown>> = [];
    const wrote: Record<string, boolean> = {
      weekly: false,
      monthly: false,
      all_time: false,
    };
    if (w) {
      writes.push(writeSingleLeaderboardEntry(weekKey, w));
      wrote.weekly = true;
    }
    if (m) {
      writes.push(writeSingleLeaderboardEntry(monthKey, m));
      wrote.monthly = true;
    }
    if (a) {
      writes.push(writeSingleLeaderboardEntry("all_time", a));
      wrote.all_time = true;
    }
    await Promise.all(writes);

    // Audit doc — one per trigger fire, so we can spot-check that
    // realtime writes ran for a given walk and grep for anomalies.
    // Id format mirrors engagementPushes/{type}/waves/{ISO}: stable,
    // sortable, no collisions even for rapid back-to-back walks.
    const isoNow = now.toISOString();
    await db
      .doc(`realtimeLeaderboardUpdates/${walkerUid}_${isoNow}`)
      .set({
        walkerUid,
        walkId: event.params.walkId,
        familyId: walk.familyId,
        ranAt: Timestamp.now(),
        weekly: w
          ? { totalScore: Math.round(w.totalScore * 10) / 10, walkCount: w.walkCount }
          : null,
        monthly: m
          ? { totalScore: Math.round(m.totalScore * 10) / 10, walkCount: m.walkCount }
          : null,
        allTime: a
          ? { totalScore: Math.round(a.totalScore * 10) / 10, walkCount: a.walkCount }
          : null,
        wrote,
      });

    logger.info(
      `recomputeWalkerLeaderboards: walker=${walkerUid} ` +
        `walk=${event.params.walkId} wrote=${JSON.stringify(wrote)}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// recomputeWalkerLeaderboardsOnDelete — paired onDelete(walks/{walkId})
//
// Companion to recomputeWalkerLeaderboards. Without this, deleting a
// walk leaves the leaderboard entry stuck at the inflated total — the
// onCreate trigger added the walk's score but nothing ever subtracts
// it back. UI looks frozen ("排行榜沒有即時更新,我已經把遛狗紀錄刪掉了").
//
// Same recompute path as create (re-reads ALL of the walker's
// qualifying walks per period via the shared helper) so deletes are
// idempotent and exactly mirror what the daily cron would compute.
// Edge case: if this delete removed the walker's last qualifying walk
// in a period, computeWalkerPeriodScore returns null — we delete the
// entry doc entirely so the row vanishes from the leaderboard instead
// of lingering as a zero-score ghost.
// ─────────────────────────────────────────────────────────────────────

export const recomputeWalkerLeaderboardsOnDelete = onDocumentDeleted(
  {
    document: "walks/{walkId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const walk = event.data?.data();
    if (!walk) return;
    const walkerUid = (walk.walkerUid as string) || (walk.ownerUid as string);
    if (!walkerUid) return;
    // Personal-mode walks never touched the leaderboard, so deleting
    // one shouldn't either. Same gate as the onCreate companion.
    if (walk.familyId == null) return;

    const now = new Date();
    const weekKey = isoWeekLabel(now);
    const monthKey = monthLabel(now);

    // Pass the deleted walkId so the helper drops it from the
    // aggregation even if Firestore's composite-indexed query still
    // surfaces it for ~1s post-delete (eventual consistency at the
    // index layer). Without this guard the recompute can briefly
    // overcount by 1, leaving the entry showing "1 extra walk" until
    // the next trigger fires or the daily cron runs.
    const walkId = event.params.walkId;
    const [w, m, a] = await Promise.all([
      computeWalkerPeriodScore(walkerUid, "weekly", db, now, walkId),
      computeWalkerPeriodScore(walkerUid, "monthly", db, now, walkId),
      computeWalkerPeriodScore(walkerUid, "all_time", db, now, walkId),
    ]);

    const ops: Array<Promise<unknown>> = [];
    const result: Record<string, "rewrote" | "deleted"> = {};
    if (w) {
      ops.push(writeSingleLeaderboardEntry(weekKey, w));
      result.weekly = "rewrote";
    } else {
      ops.push(deleteLeaderboardEntryIfPresent(weekKey, walkerUid));
      result.weekly = "deleted";
    }
    if (m) {
      ops.push(writeSingleLeaderboardEntry(monthKey, m));
      result.monthly = "rewrote";
    } else {
      ops.push(deleteLeaderboardEntryIfPresent(monthKey, walkerUid));
      result.monthly = "deleted";
    }
    if (a) {
      ops.push(writeSingleLeaderboardEntry("all_time", a));
      result.all_time = "rewrote";
    } else {
      ops.push(deleteLeaderboardEntryIfPresent("all_time", walkerUid));
      result.all_time = "deleted";
    }
    await Promise.all(ops);

    // Audit doc — mirrors the onCreate companion so we can spot-check
    // a delete actually ran the recompute. Same id shape so they sort
    // together by walker + time.
    const isoNow = now.toISOString();
    await db
      .doc(`realtimeLeaderboardUpdates/${walkerUid}_${isoNow}_del`)
      .set({
        walkerUid,
        walkId: event.params.walkId,
        familyId: walk.familyId,
        ranAt: Timestamp.now(),
        kind: "delete",
        result,
      });

    logger.info(
      `recomputeWalkerLeaderboardsOnDelete: walker=${walkerUid} ` +
        `walk=${event.params.walkId} result=${JSON.stringify(result)}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// purgeMyOrphanWalks — callable, one-off cleanup
//
// Use case: user left a family. Their walks under that family still
// live at top-level `walks/{walkId}` with the old familyId — they no
// longer appear in `/app/walks` (which filters by currentFamilyId),
// but `recomputeWalkerLeaderboards` still counts them via the
// `where walkerUid == X` index. Result: leaderboard shows phantom
// walks the user can't see anywhere in the UI.
//
// "Orphan" = walk attributed to the caller (walkerUid == auth.uid)
// whose familyId is NOT in the caller's current `user.familyIds[]`
// and is NOT null (null = personal-mode, which the caller explicitly
// owns and we never auto-delete). Each delete fires
// recomputeWalkerLeaderboardsOnDelete so the leaderboard entry
// auto-recomputes — no manual entry cleanup needed.
//
// Always safe to re-run. dryRun=true first to preview the IDs
// without deleting; flip to false to commit.
// ─────────────────────────────────────────────────────────────────────

export const purgeMyOrphanWalks = onCall(
  { region: FUNCTION_REGION, cors: true, invoker: "public" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const dryRun = req.data?.dryRun === true;

    // Caller's current family memberships — the "kept" set.
    const userSnap = await db.doc(`users/${uid}`).get();
    const familyIds = new Set(
      ((userSnap.data()?.familyIds as string[] | undefined) ?? []).filter(
        Boolean,
      ),
    );

    const walksSnap = await db
      .collection("walks")
      .where("walkerUid", "==", uid)
      .get();

    type Orphan = {
      walkId: string;
      familyId: string;
      startedAt: string | null;
    };
    const orphans: Orphan[] = [];
    let keptPersonal = 0;
    let keptCurrentFamily = 0;
    for (const d of walksSnap.docs) {
      const w = d.data();
      const fid = w.familyId;
      if (fid == null) {
        keptPersonal++;
        continue;
      }
      if (typeof fid === "string" && familyIds.has(fid)) {
        keptCurrentFamily++;
        continue;
      }
      orphans.push({
        walkId: d.id,
        familyId: typeof fid === "string" ? fid : String(fid),
        startedAt:
          w.startedAt instanceof Timestamp
            ? (w.startedAt as Timestamp).toDate().toISOString()
            : null,
      });
    }

    if (!dryRun && orphans.length > 0) {
      // Batch in chunks of 400 (Firestore batch limit 500; leave
      // headroom). Each delete fires the onDelete trigger which
      // recomputes the leaderboard entry from scratch — no manual
      // entry cleanup needed.
      const BATCH = 400;
      for (let i = 0; i < orphans.length; i += BATCH) {
        const slice = orphans.slice(i, i + BATCH);
        const batch = db.batch();
        for (const o of slice) batch.delete(db.doc(`walks/${o.walkId}`));
        await batch.commit();
      }
    }

    // Audit doc — sortable id (uid + ISO) so multiple invocations sort
    // together by walker. Persists the orphan list even on dryRun so
    // we have a record of "what would've been deleted at this moment".
    const isoNow = new Date().toISOString();
    await db.doc(`orphanWalkPurges/${uid}_${isoNow}`).set({
      uid,
      ranAt: Timestamp.now(),
      dryRun,
      familyIds: Array.from(familyIds),
      keptPersonal,
      keptCurrentFamily,
      orphans,
    });

    logger.info(
      `purgeMyOrphanWalks: uid=${uid} dryRun=${dryRun} ` +
        `orphans=${orphans.length} keptPersonal=${keptPersonal} ` +
        `keptCurrentFamily=${keptCurrentFamily}`,
    );

    return {
      dryRun,
      deleted: dryRun ? 0 : orphans.length,
      orphans,
      keptPersonal,
      keptCurrentFamily,
    };
  },
);

/** Delete a leaderboard entry doc if it exists; no-op when the walker
 *  never appeared in the period (e.g., personal-mode-only history that
 *  somehow tripped the trigger). Used by the onDelete trigger when a
 *  recompute returns null for a period — leaving a stale entry would
 *  render as a 0-score row that never refreshes. */
async function deleteLeaderboardEntryIfPresent(
  periodKey: string,
  uid: string,
): Promise<void> {
  const ref = db.doc(`leaderboards/${periodKey}/entries/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.delete();
}

/** Write/merge a SINGLE leaderboard entry — used by the realtime
 *  trigger to bump one walker without touching the rest of the
 *  period's entries (ranks recomputed by the daily cron). `merge:true`
 *  so we don't clobber `previousRank` written by the last cron run —
 *  B1 rank-overtake push reads it back on the next aggregation. */
async function writeSingleLeaderboardEntry(
  periodKey: string,
  a: UserAccum,
): Promise<void> {
  const now = Timestamp.now();
  await db
    .doc(`leaderboards/${periodKey}/entries/${a.uid}`)
    .set(
      {
        uid: a.uid,
        displayName: a.displayName,
        photoURL: a.photoURL,
        city: a.city,
        totalScore: Math.round(a.totalScore * 10) / 10,
        totalDistanceKm: Math.round(a.totalDistanceKm * 100) / 100,
        totalDurationMin: Math.round(a.totalDurationMin),
        walkCount: a.walkCount,
        streakDays: streakFromDays(a.walkDays),
        updatedAt: now,
        lastUpdatedAt: now,
      },
      { merge: true },
    );
}

// ═════════════════════════════════════════════════════════════════════
// Dog-centric leaderboard (leaderboard v2)
// Spec: docs/features/leaderboard-v2-dog-centric.md
//
// Mirrors the walker leaderboard but keyed by petId in a separate
// collection `dogLeaderboards/{period}/entries/{petId}`. Coexists with
// the walker board — the walker functions above are UNCHANGED. Two
// behavioural differences live in `computeDogPeriodScore`: personal-mode
// walks are INCLUDED, and a dog's score sums across all walkers.
// ═════════════════════════════════════════════════════════════════════

/** Build the persisted dog-entry object from an accumulation + rank. */
function dogEntryData(a: DogAccum, now: Timestamp, rank?: number) {
  const data: Record<string, unknown> = {
    petId: a.petId,
    petName: a.petName,
    petPhotoURL: a.petPhotoURL,
    breed: a.breed,
    species: a.species,
    ownerUid: a.ownerUid,
    ownerName: a.ownerName,
    familyId: a.familyId,
    totalScore: Math.round(a.totalScore * 10) / 10,
    totalDistanceKm: Math.round(a.totalDistanceKm * 100) / 100,
    totalDurationMin: Math.round(a.totalDurationMin),
    walkCount: a.walkCount,
    streakDays: streakFromDays(a.walkDays),
    ownerVisibility: a.ownerVisibility,
    updatedAt: now,
    lastUpdatedAt: now,
  };
  if (rank != null) data.previousRank = rank;
  return data;
}

/** Full-period dog writer: ranks (totalScore DESC, tie by petId), writes
 *  every entry with `previousRank`, and deletes entries whose pet dropped
 *  out of the period. Mirrors `writeLeaderboardWithRanks` (no rank-overtake
 *  push for dogs, so no diff is returned). */
async function writeDogLeaderboard(
  periodKey: string,
  accums: Map<string, DogAccum>,
): Promise<void> {
  const now = Timestamp.now();
  const collection = db.collection(`dogLeaderboards/${periodKey}/entries`);
  const existing = await collection.get();

  const sortedPetIds = [...accums.entries()]
    .sort(([idA, a], [idB, b]) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    })
    .map(([id]) => id);
  const newRanks = new Map<string, number>();
  sortedPetIds.forEach((id, i) => newRanks.set(id, i + 1));

  const currentIds = new Set(accums.keys());
  const batch = db.batch();
  for (const doc of existing.docs) {
    if (!currentIds.has(doc.id)) batch.delete(doc.ref);
  }
  for (const a of accums.values()) {
    batch.set(
      collection.doc(a.petId),
      dogEntryData(a, now, newRanks.get(a.petId) ?? 0),
    );
  }
  await batch.commit();
}

/** Single-entry dog writer for the realtime triggers — `merge:true` so a
 *  cron-written `previousRank` isn't clobbered between daily runs. */
async function writeSingleDogLeaderboardEntry(
  periodKey: string,
  a: DogAccum,
): Promise<void> {
  await db
    .doc(`dogLeaderboards/${periodKey}/entries/${a.petId}`)
    .set(dogEntryData(a, Timestamp.now()), { merge: true });
}

async function deleteDogLeaderboardEntryIfPresent(
  periodKey: string,
  petId: string,
): Promise<void> {
  const ref = db.doc(`dogLeaderboards/${periodKey}/entries/${petId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.delete();
}

/** Daily full reconcile of the dog board — called from
 *  `aggregateLeaderboards` so we DON'T open a second scheduled function
 *  (cost rule). Enumerates every petId that has any walk (INCLUDING
 *  personal-mode), unlike the walker pass which excludes personal-mode. */
async function runDogLeaderboardAggregation(now: Date): Promise<void> {
  const weekKey = isoWeekLabel(now);
  const monthKey = monthLabel(now);

  // All walks, no familyId filter — personal-mode dogs are on the board.
  const allWalks = await db.collection("walks").get();
  const petIds = new Set<string>();
  for (const d of allWalks.docs) {
    const pid = d.data().petId as string | undefined;
    if (pid) petIds.add(pid);
  }
  logger.info(
    `runDogLeaderboardAggregation: walks=${allWalks.size} pets=${petIds.size}`,
  );

  const weekly = new Map<string, DogAccum>();
  const monthly = new Map<string, DogAccum>();
  const allTime = new Map<string, DogAccum>();
  for (const petId of petIds) {
    const [w, m, a] = await Promise.all([
      computeDogPeriodScore(petId, "weekly", db, now),
      computeDogPeriodScore(petId, "monthly", db, now),
      computeDogPeriodScore(petId, "all_time", db, now),
    ]);
    if (w) weekly.set(petId, w);
    if (m) monthly.set(petId, m);
    if (a) allTime.set(petId, a);
  }

  await Promise.all([
    writeDogLeaderboard(weekKey, weekly),
    writeDogLeaderboard(monthKey, monthly),
    writeDogLeaderboard("all_time", allTime),
  ]);
  logger.info(
    `runDogLeaderboardAggregation done — weekly=${weekly.size}, ` +
      `monthly=${monthly.size}, all=${allTime.size}`,
  );
}

/** onCreate(walks/{walkId}) — realtime dog board update. Unlike the
 *  walker companion, this does NOT bail on personal-mode walks. */
export const recomputeDogLeaderboards = onDocumentCreated(
  {
    document: "walks/{walkId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const walk = event.data?.data();
    if (!walk) return;
    const petId = walk.petId as string | undefined;
    if (!petId) return;

    const now = new Date();
    const weekKey = isoWeekLabel(now);
    const monthKey = monthLabel(now);

    const [w, m, a] = await Promise.all([
      computeDogPeriodScore(petId, "weekly", db, now),
      computeDogPeriodScore(petId, "monthly", db, now),
      computeDogPeriodScore(petId, "all_time", db, now),
    ]);

    const writes: Array<Promise<unknown>> = [];
    if (w) writes.push(writeSingleDogLeaderboardEntry(weekKey, w));
    if (m) writes.push(writeSingleDogLeaderboardEntry(monthKey, m));
    if (a) writes.push(writeSingleDogLeaderboardEntry("all_time", a));
    await Promise.all(writes);

    logger.info(
      `recomputeDogLeaderboards: pet=${petId} walk=${event.params.walkId}`,
    );
  },
);

/** onDelete(walks/{walkId}) — paired dog board recompute. Drops the entry
 *  when the dog's last qualifying walk in a period is removed. */
export const recomputeDogLeaderboardsOnDelete = onDocumentDeleted(
  {
    document: "walks/{walkId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const walk = event.data?.data();
    if (!walk) return;
    const petId = walk.petId as string | undefined;
    if (!petId) return;

    const now = new Date();
    const weekKey = isoWeekLabel(now);
    const monthKey = monthLabel(now);
    const walkId = event.params.walkId;

    const [w, m, a] = await Promise.all([
      computeDogPeriodScore(petId, "weekly", db, now, walkId),
      computeDogPeriodScore(petId, "monthly", db, now, walkId),
      computeDogPeriodScore(petId, "all_time", db, now, walkId),
    ]);

    const ops: Array<Promise<unknown>> = [];
    ops.push(
      w
        ? writeSingleDogLeaderboardEntry(weekKey, w)
        : deleteDogLeaderboardEntryIfPresent(weekKey, petId),
    );
    ops.push(
      m
        ? writeSingleDogLeaderboardEntry(monthKey, m)
        : deleteDogLeaderboardEntryIfPresent(monthKey, petId),
    );
    ops.push(
      a
        ? writeSingleDogLeaderboardEntry("all_time", a)
        : deleteDogLeaderboardEntryIfPresent("all_time", petId),
    );
    await Promise.all(ops);

    logger.info(
      `recomputeDogLeaderboardsOnDelete: pet=${petId} walk=${walkId}`,
    );
  },
);

/** onWrite(users/{uid}) — when a user flips their
 *  `leaderboardVisibility` master switch, fan the new value out to every
 *  dog entry they own (denormalised `ownerVisibility`) so the client's
 *  friends/all tab filter stays correct without re-aggregating. Cheap:
 *  short-circuits on every unrelated user write (e.g. hourly lastSeenAt)
 *  before doing any reads. Matches dog entries only — walker entries have
 *  no `ownerUid` field so the collectionGroup query skips them. */
export const syncDogEntryVisibility = onDocumentWritten(
  {
    document: "users/{uid}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return; // user deleted — entry cleanup handled elsewhere
    const before = event.data?.before?.data();
    const beforeV = (before?.leaderboardVisibility as string) ?? "public";
    const afterV = (after.leaderboardVisibility as string) ?? "public";
    if (beforeV === afterV) return; // unrelated user write — no-op

    const uid = event.params.uid;
    const snap = await db
      .collectionGroup("entries")
      .where("ownerUid", "==", uid)
      .get();
    if (snap.empty) return;

    const now = Timestamp.now();
    // Batch in chunks of 450 (< 500 write cap) for users with many dogs
    // across many periods.
    let batch = db.batch();
    let n = 0;
    for (const doc of snap.docs) {
      batch.set(
        doc.ref,
        { ownerVisibility: afterV, lastUpdatedAt: now },
        { merge: true },
      );
      if (++n % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (n % 450 !== 0) await batch.commit();
    logger.info(
      `syncDogEntryVisibility: uid=${uid} ${beforeV}→${afterV} entries=${snap.size}`,
    );
  },
);

// ═════════════════════════════════════════════════════════════════════
// Feed interaction v2 — comment + reaction push + commentCount denorm
// Spec: docs/features/feed-comments-and-reactions-v2.md §A + §C
//
// Three event triggers on the posts subtree:
//   - onCreate(posts/{postId}/comments/{commentId})  → commentCount +1 +
//     push the post author "{name} 留言了你的動態" (immediate).
//   - onDelete(posts/{postId}/comments/{commentId})  → commentCount -1
//     (clamped ≥ 0).
//   - onCreate(posts/{postId}/reactions/{uid})       → push the post author
//     "{name} 回應了你的動態", THROTTLED/AGGREGATED (see below).
//
// Shared gates (mirror the Epic 5 engagement-push contract):
//   1. Don't notify yourself (commenter/reactor == post author → skip).
//   2. Author must have ≥1 FCM token.
//   3. Author must not have opted out of the push type
//      (pushPrefs.engagementOptOut).
// All three reuse sendEngagementPush() + pushCopy() + the
// engagementPushes/{type}/waves/{ISO} audit posture.
// ═════════════════════════════════════════════════════════════════════

const POST_COMMENT_TYPE = "post-comment";
const POST_REACTION_TYPE = "post-reaction";

/** Reaction-push throttle window. Within this window after an author was
 *  last pushed for a reaction on a given post, further reactions are
 *  accumulated silently; the first reaction AFTER the window emits one
 *  aggregated "{name} 和其他 N 人回應了" push. Leading-edge fire keeps the
 *  author informed immediately on the first reaction; the window collapses
 *  bursts (multi-person pile-ons, rapid toggles) into at most one push per
 *  hour per post — the cost + anti-spam guard the spec mandates (§C). */
const REACTION_PUSH_COOLDOWN_MS = 60 * 60 * 1000;

const POST_EXCERPT_MAX = 60;

/** Shared author-notifiability gate: returns the author's valid FCM tokens
 *  when they should be pushed for `pushType`, or null to skip. Centralises
 *  gates 1–3 so the comment + reaction triggers can't diverge. */
async function resolveAuthorPushTarget(
  authorUid: string,
  actorUid: string,
  pushType: string,
): Promise<{ tokens: string[]; locale?: string } | null> {
  if (!authorUid || authorUid === actorUid) return null; // gate 1: not self
  const authorSnap = await db.doc(`users/${authorUid}`).get();
  if (!authorSnap.exists) return null;
  const a = authorSnap.data() ?? {};
  const tokens = ((a.fcmTokens ?? []) as string[]).filter(Boolean);
  if (tokens.length === 0) return null; // gate 2: has tokens
  const optOut = (a.pushPrefs?.engagementOptOut ?? []) as string[];
  if (optOut.includes(pushType)) return null; // gate 3: not opted out
  return { tokens, locale: a.locale as string | undefined };
}

/** onCreate(posts/{postId}/comments/{commentId}) — bump commentCount and
 *  push the post author. commentCount is clamped via increment (starts at
 *  undefined → 1 on the first comment). */
export const onCommentCreated = onDocumentCreated(
  {
    document: "posts/{postId}/comments/{commentId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;
    const postId = event.params.postId;
    const postRef = db.doc(`posts/${postId}`);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return; // post deleted between write + trigger
    const post = postSnap.data() ?? {};

    // Denormalised count — Admin SDK bypasses rules. increment handles the
    // absent-field case (treated as 0 → 1).
    await postRef.update({ commentCount: FieldValue.increment(1) });

    const target = await resolveAuthorPushTarget(
      post.authorUid as string,
      comment.authorUid as string,
      POST_COMMENT_TYPE,
    );
    if (!target) return;

    const commenterName = (comment.authorName as string) || "有人";
    // Excerpt is always safe to include: the recipient IS the post author,
    // who can read every comment on their own post regardless of post
    // visibility (open question #4 — excerpt OK).
    const raw = ((comment.text as string) || "").replace(/\s+/g, " ").trim();
    const excerpt =
      raw.length > POST_EXCERPT_MAX ? `${raw.slice(0, POST_EXCERPT_MAX)}…` : raw;

    const copy = pushCopy(
      target.locale,
      { name: commenterName, excerpt },
      { title: "新留言", body: "{name} 留言了你的動態：{excerpt}" },
      { title: "New comment", body: "{name} commented on your post: {excerpt}" },
    );

    try {
      await sendEngagementPush({
        uid: post.authorUid as string,
        tokens: target.tokens,
        body: copy,
        data: { type: POST_COMMENT_TYPE, postId },
        link: "/app/feed",
      });
    } catch (err) {
      logger.error(`onCommentCreated: push failed post=${postId}`, err);
    }
    logger.info(
      `onCommentCreated: post=${postId} comment=${event.params.commentId} ` +
        `pushed=${post.authorUid !== comment.authorUid}`,
    );
  },
);

/** onDelete(posts/{postId}/comments/{commentId}) — decrement commentCount,
 *  clamped at 0 (a comment created before this function shipped never
 *  incremented, so a naive increment(-1) could go negative). */
export const onCommentDeleted = onDocumentDeleted(
  {
    document: "posts/{postId}/comments/{commentId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const postId = event.params.postId;
    const postRef = db.doc(`posts/${postId}`);
    await db
      .runTransaction(async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists) return; // post gone (e.g. cascade delete) — no-op
        const current = Number(snap.data()?.commentCount) || 0;
        tx.update(postRef, { commentCount: Math.max(0, current - 1) });
      })
      .catch((err) =>
        logger.error(`onCommentDeleted: decrement failed post=${postId}`, err),
      );
    logger.info(
      `onCommentDeleted: post=${postId} comment=${event.params.commentId}`,
    );
  },
);

/** onCreate(posts/{postId}/reactions/{uid}) — push the post author that
 *  someone reacted, THROTTLED per post (see REACTION_PUSH_COOLDOWN_MS).
 *
 *  Fires only on a NEW reaction doc: setReaction() overwrites the uid-keyed
 *  doc when a user swaps emoji (an update, not a create), so emoji swaps
 *  don't re-notify. Throttle state lives in the server-only
 *  `postInteractionThrottle/{postId}` doc, updated inside a transaction so
 *  concurrent reactions can't double-send.
 *
 *  Leading-edge + aggregate-on-next-window:
 *    - first reaction (no active window) → send NOW, open a window.
 *    - reactions within the window → accumulate `pending`, no send.
 *    - first reaction after the window → send an aggregated
 *      "{name} 和其他 N 人回應了" folding in the `pending` accrued during the
 *      previous window, then open a fresh window. */
export const onReactionCreated = onDocumentCreated(
  {
    document: "posts/{postId}/reactions/{uid}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const reaction = event.data?.data();
    if (!reaction) return;
    const postId = event.params.postId;
    const reactorUid = (reaction.uid as string) || event.params.uid;

    const postSnap = await db.doc(`posts/${postId}`).get();
    if (!postSnap.exists) return;
    const post = postSnap.data() ?? {};

    // react-10 achievement: the POST AUTHOR earns it when this single post's
    // total reactions cross 10. Evaluate before the push gate so it runs on
    // every reaction (incl. self-reactions / when the author opted out of
    // reaction pushes). reactionCounts is denormalised on the post doc.
    const postAuthorUid = post.authorUid as string | undefined;
    if (postAuthorUid) {
      const counts = (post.reactionCounts ?? {}) as Record<string, number>;
      const totalReactions = Object.values(counts).reduce(
        (s, n) => s + (Number(n) || 0),
        0,
      );
      if (totalReactions >= 10) {
        await runAchievementEval(postAuthorUid, {
          singlePostReactions: totalReactions,
        });
      }
    }

    const target = await resolveAuthorPushTarget(
      post.authorUid as string,
      reactorUid,
      POST_REACTION_TYPE,
    );
    if (!target) return; // self-reaction / no tokens / opted out

    const nowMs = event.time ? new Date(event.time).getTime() : Date.now();
    const throttleRef = db.doc(`postInteractionThrottle/${postId}`);

    // Transaction decides whether THIS reaction sends a push, and folds in
    // any reactions accrued during the previous cooldown window.
    const decision = await db.runTransaction(async (tx) => {
      const snap = await tx.get(throttleRef);
      const data = snap.data() ?? {};
      const lastPushMs =
        (data.reactionLastPushAt as Timestamp | undefined)?.toMillis() ?? 0;
      const pending = Number(data.reactionPending) || 0;
      const windowOpen = lastPushMs > 0 && nowMs - lastPushMs < REACTION_PUSH_COOLDOWN_MS;

      if (windowOpen) {
        // Inside cooldown — accumulate silently, no push.
        tx.set(
          throttleRef,
          { reactionPending: pending + 1 },
          { merge: true },
        );
        return { send: false as const };
      }
      // Window closed (or first ever) — push now, folding in `pending`
      // others accrued during the previous window. Reset the window.
      tx.set(
        throttleRef,
        {
          reactionLastPushAt: Timestamp.fromMillis(nowMs),
          reactionPending: 0,
        },
        { merge: true },
      );
      return { send: true as const, others: pending };
    });

    if (!decision.send) {
      logger.info(`onReactionCreated: throttled post=${postId} reactor=${reactorUid}`);
      return;
    }

    // Reactor display name (reaction doc doesn't denormalise it).
    const reactorSnap = await db.doc(`users/${reactorUid}`).get();
    const reactorName = (reactorSnap.data()?.displayName as string) || "有人";
    const others = decision.others;

    const copy =
      others > 0
        ? pushCopy(
            target.locale,
            { name: reactorName, n: others },
            { title: "新回應", body: "{name} 和其他 {n} 人回應了你的動態" },
            { title: "New reaction", body: "{name} and {n} others reacted to your post" },
          )
        : pushCopy(
            target.locale,
            { name: reactorName },
            { title: "新回應", body: "{name} 回應了你的動態" },
            { title: "New reaction", body: "{name} reacted to your post" },
          );

    try {
      await sendEngagementPush({
        uid: post.authorUid as string,
        tokens: target.tokens,
        body: copy,
        data: { type: POST_REACTION_TYPE, postId },
        link: "/app/feed",
      });
    } catch (err) {
      logger.error(`onReactionCreated: push failed post=${postId}`, err);
    }
    logger.info(
      `onReactionCreated: post=${postId} reactor=${reactorUid} others=${others} sent`,
    );
  },
);

// ═════════════════════════════════════════════════════════════════════
// Achievements / badges — lifetime stats + evaluation + unlock push
// Spec: docs/features/achievements-badges.md
//
// - Lifetime stats (users/{uid}/stats/lifetime) cover ALL of a user's
//   walks (family + personal; guests included), maintained incrementally
//   by onWalkCreatedAchievements. ⚠️ This is a SEPARATE trigger from
//   recomputeWalkerLeaderboards (which bails on personal-mode) — badges
//   must count personal walks too.
// - evaluateAchievements (./achievements) grants newly-met badge docs once
//   and returns the fresh set; we then send ONE merged unlock push.
// - Mounted on walk / pets / post onCreate + family join callable + the
//   aggregateLeaderboards cron (rank). No new high-frequency scheduled fn.
// ═════════════════════════════════════════════════════════════════════

const ACHIEVEMENT_PUSH_TYPE = "achievement";

/** Read a user's profile push-eligibility for achievement unlock pushes.
 *  Unlike resolveAuthorPushTarget, the recipient IS the actor (badges are
 *  self-notifications), so there's no not-self gate. Returns null to skip
 *  (no tokens / opted out). */
async function resolveSelfPushTarget(
  uid: string,
  pushType: string,
): Promise<{ tokens: string[]; locale?: string } | null> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const u = snap.data() ?? {};
  const tokens = ((u.fcmTokens ?? []) as string[]).filter(Boolean);
  if (tokens.length === 0) return null;
  const optOut = (u.pushPrefs?.engagementOptOut ?? []) as string[];
  if (optOut.includes(pushType)) return null;
  return { tokens, locale: u.locale as string | undefined };
}

/** Send ONE merged unlock push for a batch of newly-earned badges (spec §F
 *  "同一次 evaluate 解多枚時可合併一則"). Single badge → name it; multiple →
 *  "解鎖 N 枚成就". Honours opt-out + token gates via resolveSelfPushTarget. */
async function sendAchievementUnlockPush(
  uid: string,
  badges: AchievementDef[],
): Promise<void> {
  if (badges.length === 0) return;
  const target = await resolveSelfPushTarget(uid, ACHIEVEMENT_PUSH_TYPE);
  if (!target) return;

  let copy;
  if (badges.length === 1) {
    const t = ACHIEVEMENT_TITLES[badges[0].id] ?? { zh: badges[0].id, en: badges[0].id };
    copy = pushCopy(
      target.locale,
      { name: t.zh, nameEn: t.en, emoji: badges[0].emoji },
      { title: "🏅 解鎖新成就", body: "恭喜解鎖「{name}」{emoji}" },
      { title: "🏅 Achievement unlocked", body: "You earned “{nameEn}” {emoji}" },
    );
  } else {
    copy = pushCopy(
      target.locale,
      { n: badges.length },
      { title: "🏅 解鎖新成就", body: "你一次解鎖了 {n} 枚成就，來看看吧！" },
      { title: "🏅 Achievements unlocked", body: "You unlocked {n} achievements — come take a look!" },
    );
  }

  await sendEngagementPush({
    uid,
    tokens: target.tokens,
    body: copy,
    data: { type: ACHIEVEMENT_PUSH_TYPE, badgeIds: badges.map((b) => b.id).join(",") },
    link: "/app/achievements",
  });
}

/** Is this uid a guest (anonymous)? Reads the denormalised users doc flag
 *  (set by upsertUser; cleared on upgrade). Used to gate non-guest badges
 *  in the evaluator. */
async function isGuestUser(uid: string): Promise<boolean> {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.data()?.isGuest === true;
}

/** Shared wrapper: evaluate achievements for a uid with the given metrics,
 *  wiring guest-gating + the merged unlock push. Swallows nothing — the
 *  evaluator logs its own errors. */
async function runAchievementEval(
  uid: string,
  metrics: AchievementMetrics,
): Promise<void> {
  const guest = await isGuestUser(uid);
  await evaluateAchievements(db, uid, metrics, {
    isGuest: guest,
    sendPush: sendAchievementUnlockPush,
  });
}

/** onCreate(walks/{walkId}) — achievements path. Maintains lifetime stats
 *  (ALL walks incl. personal-mode + guests) then evaluates walk/distance/
 *  duration/streak badges. Separate from recomputeWalkerLeaderboards which
 *  deliberately bails on personal-mode. */
export const onWalkCreatedAchievements = onDocumentCreated(
  {
    document: "walks/{walkId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const walk = event.data?.data();
    if (!walk) return;
    const uid = (walk.walkerUid as string) || (walk.ownerUid as string);
    if (!uid) return;

    const startedAtMs =
      (walk.startedAt as Timestamp | undefined)?.toMillis?.() ?? Date.now();
    const stats = await applyWalkToLifetimeStats(db, uid, {
      distanceKm: Number(walk.distanceKm) || 0,
      durationMin: Number(walk.durationMin) || 0,
      startedAtMs,
    });

    await runAchievementEval(uid, {
      walkCount: stats.walkCount,
      totalDistanceKm: stats.totalDistanceKm,
      totalDurationMin: stats.totalDurationMin,
      longestStreak: stats.longestStreak,
    });

    logger.info(
      `onWalkCreatedAchievements: uid=${uid} walk=${event.params.walkId} ` +
        `count=${stats.walkCount} dist=${stats.totalDistanceKm} ` +
        `longest=${stats.longestStreak}`,
    );
  },
);

/** onCreate(pets/{petId}) — pet-count badges. Counts pets the user owns
 *  (ownerUid). guest ✓ (pet badges are personal). */
export const onPetCreatedAchievements = onDocumentCreated(
  {
    document: "pets/{petId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const pet = event.data?.data();
    if (!pet) return;
    const uid = pet.ownerUid as string | undefined;
    if (!uid) return;
    const petsSnap = await db
      .collection("pets")
      .where("ownerUid", "==", uid)
      .get();
    await runAchievementEval(uid, { petCount: petsSnap.size });
    logger.info(
      `onPetCreatedAchievements: uid=${uid} pet=${event.params.petId} petCount=${petsSnap.size}`,
    );
  },
);

/** onCreate(posts/{postId}) — post-count badges (guest ✗; guests can't
 *  post anyway per guest-login rules). The react-10 badge is evaluated on
 *  the reaction trigger instead (it reads the post's reactionCounts). */
export const onPostCreatedAchievements = onDocumentCreated(
  {
    document: "posts/{postId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const post = event.data?.data();
    if (!post) return;
    const uid = post.authorUid as string | undefined;
    if (!uid) return;
    const postsSnap = await db
      .collection("posts")
      .where("authorUid", "==", uid)
      .get();
    await runAchievementEval(uid, { postCount: postsSnap.size });
    logger.info(
      `onPostCreatedAchievements: uid=${uid} post=${event.params.postId} postCount=${postsSnap.size}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// rank-overtake push helper — Phase 2 B1
// ─────────────────────────────────────────────────────────────────────

const RANK_OVERTAKE_TYPE = "rank-overtake";

/** For each user who dropped in rank since the previous aggregation
 *  run, push "{overtakerName} 超越你了". One push per dropped user per
 *  day (naturally enforced — aggregateLeaderboards runs once per day).
 *
 *  Overtaker = whoever currently sits at `newRank - 1` (the rank
 *  immediately above the dropped user) AND was behind them in the
 *  previous aggregation. If nobody fits that pattern (e.g., dropped
 *  user is rank 1 → there's no `newRank-1`) we skip — the push only
 *  fires when we have a real name to attribute the overtake to. */
async function runRankOvertakePushes(
  result: {
    oldPreviousRanks: Map<string, number>;
    newRanks: Map<string, number>;
  },
  accums: Map<string, UserAccum>,
): Promise<void> {
  const newRankToUid = new Map<number, string>();
  for (const [uid, rank] of result.newRanks) newRankToUid.set(rank, uid);

  let sent = 0;
  let failed = 0;
  let skippedNoToken = 0;
  let skippedOptOut = 0;
  let skippedNoDrop = 0;
  let skippedNoOvertaker = 0;
  let skippedNewEntry = 0;

  for (const [uid, newRank] of result.newRanks) {
    const oldRank = result.oldPreviousRanks.get(uid);
    if (oldRank == null) {
      skippedNewEntry++;
      continue;
    }
    if (newRank <= oldRank) {
      skippedNoDrop++;
      continue;
    }

    // Overtaker = user at the rank immediately above the dropped user.
    const overtakerUid = newRankToUid.get(newRank - 1);
    if (!overtakerUid) {
      skippedNoOvertaker++;
      continue;
    }
    // …who must have been BEHIND this user previously (otherwise they
    // didn't "overtake" — they just stayed ahead or both moved).
    const overtakerOldRank = result.oldPreviousRanks.get(overtakerUid);
    if (overtakerOldRank != null && overtakerOldRank <= oldRank) {
      skippedNoOvertaker++;
      continue;
    }

    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists) continue;
    const u = userDoc.data() ?? {};
    const tokens = ((u.fcmTokens ?? []) as string[]).filter(Boolean);
    if (tokens.length === 0) {
      skippedNoToken++;
      continue;
    }
    const optOut = (u.pushPrefs?.engagementOptOut ?? []) as string[];
    if (optOut.includes(RANK_OVERTAKE_TYPE)) {
      skippedOptOut++;
      continue;
    }

    const overtakerName = accums.get(overtakerUid)?.displayName || "Someone";

    const copy = pushCopy(
      u.locale as string | undefined,
      { overtakerName },
      {
        title: "你被超越了",
        body: "{overtakerName} 超越你了，加把勁追上吧 💪",
      },
      {
        title: "You've been passed",
        body: "{overtakerName} just passed you on the leaderboard — keep going 💪",
      },
    );

    try {
      const res = await sendEngagementPush({
        uid,
        tokens,
        body: copy,
        data: {
          type: RANK_OVERTAKE_TYPE,
          overtakerUid,
          oldRank: String(oldRank),
          newRank: String(newRank),
        },
        link: "/app/leaderboard",
      });
      if (res.ok) sent++;
      else failed++;
    } catch (err) {
      failed++;
      logger.error(`rankOvertake: send failed for uid=${uid}`, err);
    }
  }

  const isoNow = new Date().toISOString();
  await db
    .doc(`engagementPushes/${RANK_OVERTAKE_TYPE}/waves/${isoNow}`)
    .set({
      type: RANK_OVERTAKE_TYPE,
      ranAt: Timestamp.now(),
      sentCount: sent,
      failedCount: failed,
      skippedNoToken,
      skippedOptOut,
      skippedNoDrop,
      skippedNoOvertaker,
      skippedNewEntry,
      candidateUserCount: result.newRanks.size,
    });

  logger.info(
    `rankOvertake done — sent=${sent} failed=${failed} ` +
      `optOut=${skippedOptOut} noDrop=${skippedNoDrop} ` +
      `noOvertaker=${skippedNoOvertaker} newEntry=${skippedNewEntry} ` +
      `noToken=${skippedNoToken}`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Friend operations — callable (need cross-user writes)
// ─────────────────────────────────────────────────────────────────────

export const acceptFriendRequest = onCall(
  // `invoker: "public"` is the default for callable functions. The Cloud
  // Run IAM for this service had drifted (OPTIONS preflight returned 403
  // while paired callables on the same config returned 204), and a
  // plain `firebase deploy` UPDATE path does NOT re-apply the invoker
  // binding — only the initial CREATE does. The fix that landed was to
  // `firebase functions:delete acceptFriendRequest --force` then deploy
  // fresh. Setting this explicitly is documentation + defense for any
  // future re-create.
  { region: FUNCTION_REGION, cors: true, invoker: "public" },
  async (req) => {
    const myUid = req.auth?.uid;
    if (!myUid) throw new HttpsError("unauthenticated", "Sign-in required");
    if (isGuestAuth(req)) {
      throw new HttpsError("permission-denied", "綁定帳號後才能使用好友功能");
    }
    const fromUid = (req.data?.fromUid as string | undefined)?.trim();
    if (!fromUid) throw new HttpsError("invalid-argument", "fromUid required");

    const reqRef = db.doc(`users/${myUid}/friendRequests/${fromUid}`);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError("not-found", "Request not found");
    }

    const [meSnap, themSnap] = await Promise.all([
      db.doc(`users/${myUid}`).get(),
      db.doc(`users/${fromUid}`).get(),
    ]);
    const me = meSnap.data();
    const them = themSnap.data();
    if (!me || !them) {
      throw new HttpsError("failed-precondition", "Profiles missing");
    }

    const now = Timestamp.now();
    const batch = db.batch();
    batch.set(db.doc(`users/${myUid}/friends/${fromUid}`), {
      uid: fromUid,
      displayName: them.displayName ?? "Friend",
      photoURL: them.photoURL ?? null,
      addedAt: now,
    });
    batch.set(db.doc(`users/${fromUid}/friends/${myUid}`), {
      uid: myUid,
      displayName: me.displayName ?? "Friend",
      photoURL: me.photoURL ?? null,
      addedAt: now,
    });
    batch.delete(reqRef);
    await batch.commit();

    return { ok: true };
  },
);

export const removeFriend = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const myUid = req.auth?.uid;
    if (!myUid) throw new HttpsError("unauthenticated", "Sign-in required");
    const friendUid = (req.data?.friendUid as string | undefined)?.trim();
    if (!friendUid) throw new HttpsError("invalid-argument", "friendUid required");

    const batch = db.batch();
    batch.delete(db.doc(`users/${myUid}/friends/${friendUid}`));
    batch.delete(db.doc(`users/${friendUid}/friends/${myUid}`));
    await batch.commit();

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────
// sendTestPush — callable, sends a sanity-check notification to the
// caller's own FCM tokens. Use to verify VAPID key + SW registration
// without waiting for the next scanReminders tick.
// ─────────────────────────────────────────────────────────────────────

export const sendTestPush = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User doc not found");
    }
    const userData = userSnap.data() ?? {};
    const tokens = ((userData.fcmTokens as string[] | undefined) ?? []).filter(
      Boolean,
    );
    if (tokens.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "尚未啟用推播通知，請先到設定開啟",
      );
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "🥭 測試推播",
        body: "推播設定成功！提醒到時間會像這樣通知你。",
      },
      data: { url: "/app" },
      webpush: {
        fcmOptions: { link: "/app" },
      },
    });

    // Clean up invalid tokens — same logic as scanReminders so test
    // pushes also self-heal stale registrations.
    const invalidTokens: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error) {
        const code = r.error.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    if (invalidTokens.length > 0) {
      await userSnap.ref.update({
        fcmTokens: FieldValue.arrayRemove(...invalidTokens),
      });
    }

    return {
      ok: response.successCount > 0,
      sent: response.successCount,
      failed: response.failureCount,
      invalidTokens: invalidTokens.length,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────
// Families — multi-user pet sharing
//
// Data model:
//   families/{familyId}
//     name, ownerUid, memberUids[], inviteCode (6 digits), createdAt
//   users/{uid}.familyIds: string[]
//   users/{uid}.currentFamilyId: string
//
// Invite flow: creator gets a 6-digit code, shares it OOB (LINE/SMS), invitee
// types it into the join dialog. Code is unique across active families.
// ─────────────────────────────────────────────────────────────────────

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_MAX_ATTEMPTS = 10;

function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

async function reserveUniqueInviteCode(): Promise<string> {
  // Family inviteCode collisions are vanishingly rare at small scale (10^6
  // codes, dozens of families). Retry-on-collide is fine.
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateInviteCode();
    const dupe = await db
      .collection("families")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (dupe.empty) return code;
  }
  throw new HttpsError(
    "resource-exhausted",
    "Could not allocate a unique invite code after retries",
  );
}

export const createFamily = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    if (isGuestAuth(req)) {
      throw new HttpsError("permission-denied", "綁定帳號後才能建立家庭");
    }
    const name = ((req.data?.name as string | undefined) ?? "").trim() || "我的家庭";
    if (name.length > 40) {
      throw new HttpsError("invalid-argument", "Family name too long");
    }

    const inviteCode = await reserveUniqueInviteCode();
    const familyRef = db.collection("families").doc();
    const now = Timestamp.now();

    const batch = db.batch();
    batch.set(familyRef, {
      name,
      ownerUid: uid,
      memberUids: [uid],
      inviteCode,
      createdAt: now,
    });
    // Append to user.familyIds; set currentFamilyId so subsequent reads scope
    // to this family without an explicit switch.
    batch.set(
      db.doc(`users/${uid}`),
      {
        familyIds: FieldValue.arrayUnion(familyRef.id),
        currentFamilyId: familyRef.id,
      },
      { merge: true },
    );
    await batch.commit();

    return { familyId: familyRef.id, inviteCode };
  },
);

export const joinFamilyByCode = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    if (isGuestAuth(req)) {
      throw new HttpsError("permission-denied", "綁定帳號後才能加入家庭");
    }
    const code = ((req.data?.inviteCode as string | undefined) ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError("invalid-argument", "邀請碼必須是 6 位數字");
    }

    const found = await db
      .collection("families")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (found.empty) {
      throw new HttpsError("not-found", "邀請碼無效或已過期");
    }
    const familyDoc = found.docs[0];
    const family = familyDoc.data();
    const members = (family.memberUids as string[] | undefined) ?? [];

    if (members.includes(uid)) {
      return { familyId: familyDoc.id, alreadyMember: true };
    }

    const batch = db.batch();
    batch.update(familyDoc.ref, {
      memberUids: FieldValue.arrayUnion(uid),
    });
    batch.set(
      db.doc(`users/${uid}`),
      {
        familyIds: FieldValue.arrayUnion(familyDoc.id),
        // Switching context to the just-joined family is the obvious
        // default — user typed the code, they want to use it now.
        currentFamilyId: familyDoc.id,
      },
      { merge: true },
    );
    await batch.commit();

    // family-join achievement. Guests can't reach here (isGuestAuth gate
    // above), so isGuest is false — but runAchievementEval re-checks anyway.
    await runAchievementEval(uid, { familyJoined: true });

    return { familyId: familyDoc.id, alreadyMember: false };
  },
);

export const leaveFamily = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const familyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!familyId) throw new HttpsError("invalid-argument", "familyId required");

    const familyRef = db.doc(`families/${familyId}`);
    const snap = await familyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Family not found");
    const family = snap.data() ?? {};
    const members = (family.memberUids as string[] | undefined) ?? [];
    if (!members.includes(uid)) {
      throw new HttpsError("failed-precondition", "Not a member");
    }

    const isOwner = family.ownerUid === uid;
    const isLast = members.length === 1;

    const batch = db.batch();

    if (isLast) {
      // Last member out — delete the family doc entirely. The owned pets /
      // walks / etc. remain (orphaned) for safety; the user can re-link
      // them by creating a new family. We don't cascade-delete user data.
      batch.delete(familyRef);
    } else {
      // Remove from memberUids; if the owner is leaving, promote the
      // earliest-listed remaining member to owner.
      const remaining = members.filter((m) => m !== uid);
      const update: Record<string, unknown> = {
        memberUids: FieldValue.arrayRemove(uid),
      };
      if (isOwner && remaining.length > 0) {
        update.ownerUid = remaining[0];
      }
      batch.update(familyRef, update);
    }

    // Detach from this user's familyIds. If currentFamilyId points here,
    // unset it; client will pick another family (if any) on next refresh.
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};
    const update: Record<string, unknown> = {
      familyIds: FieldValue.arrayRemove(familyId),
    };
    if (userData.currentFamilyId === familyId) {
      update.currentFamilyId = FieldValue.delete();
    }
    batch.update(userRef, update);

    await batch.commit();
    return { ok: true };
  },
);

export const regenerateInviteCode = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const familyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!familyId) throw new HttpsError("invalid-argument", "familyId required");

    const familyRef = db.doc(`families/${familyId}`);
    const snap = await familyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Family not found");
    const family = snap.data() ?? {};
    const members = (family.memberUids as string[] | undefined) ?? [];
    if (!members.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a member of this family");
    }

    const inviteCode = await reserveUniqueInviteCode();
    await familyRef.update({ inviteCode });
    return { inviteCode };
  },
);

export const removeFamilyMember = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const familyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    const memberUid = ((req.data?.memberUid as string | undefined) ?? "").trim();
    if (!familyId || !memberUid) {
      throw new HttpsError("invalid-argument", "familyId and memberUid required");
    }

    const familyRef = db.doc(`families/${familyId}`);
    const snap = await familyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Family not found");
    const family = snap.data() ?? {};

    // Only the owner can remove others; anyone can remove themselves (use
    // leaveFamily for that, but allow self-removal here too as a fallback).
    if (family.ownerUid !== uid && memberUid !== uid) {
      throw new HttpsError("permission-denied", "Only the family owner can remove members");
    }

    const batch = db.batch();
    batch.update(familyRef, {
      memberUids: FieldValue.arrayRemove(memberUid),
    });
    const memberRef = db.doc(`users/${memberUid}`);
    const memberSnap = await memberRef.get();
    const memberData = memberSnap.data() ?? {};
    const memberUpdate: Record<string, unknown> = {
      familyIds: FieldValue.arrayRemove(familyId),
    };
    if (memberData.currentFamilyId === familyId) {
      memberUpdate.currentFamilyId = FieldValue.delete();
    }
    batch.update(memberRef, memberUpdate);
    await batch.commit();

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────
// importPersonalToFamily — Phase B3 callable
// Bulk-move the caller's personal-mode docs (familyId == null,
// per-collection owner field == caller.uid) into a family they belong
// to. Plain "search and replace familyId" — duplicate detection is
// deferred to B4 (pet-merge wizard). Writes an audit doc to
// families/{familyId}/migrations for the family to inspect later.
// ─────────────────────────────────────────────────────────────────────

/** Per-collection metadata for the bulk import. The owner field is
 *  the doc field the personal-mode rule checks (see firestore.rules). */
const IMPORT_TARGETS = [
  { type: "pets" as const, collection: "pets", ownerField: "ownerUid" },
  { type: "walks" as const, collection: "walks", ownerField: "walkerUid" },
  {
    type: "reminders" as const,
    collection: "reminders",
    ownerField: "createdByUid",
  },
  { type: "expenses" as const, collection: "expenses", ownerField: "payerUid" },
] as const;

type ImportType = (typeof IMPORT_TARGETS)[number]["type"];
type ImportCounts = Record<ImportType, number>;

export const importPersonalToFamily = onCall(
  { region: FUNCTION_REGION, cors: true, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const targetFamilyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!targetFamilyId) {
      throw new HttpsError("invalid-argument", "familyId required");
    }

    // Membership guard — caller must be in the target family before they
    // can flip ownership of any personal docs into it.
    const familyRef = db.doc(`families/${targetFamilyId}`);
    const familySnap = await familyRef.get();
    if (!familySnap.exists) {
      throw new HttpsError("not-found", "Family not found");
    }
    const memberUids =
      (familySnap.data()?.memberUids as string[] | undefined) ?? [];
    if (!memberUids.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a member of the target family",
      );
    }

    // Optional whitelist of types to import. Empty/missing = all 4.
    const requestedTypes = req.data?.types as ImportType[] | undefined;
    const targets =
      requestedTypes && requestedTypes.length > 0
        ? IMPORT_TARGETS.filter((t) => requestedTypes.includes(t.type))
        : IMPORT_TARGETS;

    const startedAt = Timestamp.now();
    const counts: ImportCounts = {
      pets: 0,
      walks: 0,
      reminders: 0,
      expenses: 0,
    };

    for (const target of targets) {
      // Query the caller's personal-mode docs in this collection.
      const snap = await db
        .collection(target.collection)
        .where(target.ownerField, "==", uid)
        .where("familyId", "==", null)
        .get();
      if (snap.empty) continue;

      // Chunk into batches of 400 to stay under Firestore's 500-write limit
      // (we reserve a few slots for the audit doc + headroom).
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const slice = docs.slice(i, i + 400);
        const batch = db.batch();
        for (const d of slice) {
          batch.update(d.ref, { familyId: targetFamilyId });
        }
        await batch.commit();
        counts[target.type] += slice.length;
      }

      logger.info(
        `importPersonalToFamily: moved ${counts[target.type]} ${target.type} ` +
          `for uid=${uid} into family=${targetFamilyId}`,
      );
    }

    // Audit doc — one per import event, id sortable by time.
    const finishedAt = Timestamp.now();
    const isoNow = new Date(finishedAt.toMillis()).toISOString();
    const auditId = `import-from-${uid}-${isoNow}`;
    await familyRef.collection("migrations").doc(auditId).set({
      type: "import-personal",
      fromUid: uid,
      targetFamilyId,
      startedAt,
      finishedAt,
      counts,
      // Record the type filter so a re-run debate can see whether unchecked
      // categories were truly empty or just skipped by the caller.
      requestedTypes: requestedTypes ?? null,
    });

    return { counts };
  },
);

// ─────────────────────────────────────────────────────────────────────
// mergeAndImportToFamily — Phase B4 callable
// Caller-supplied merge map of (personalPetId → familyPetId) pairs to
// fold into existing family pets, plus the same bulk-import pass
// importPersonalToFamily does for the rest. The match detection itself
// runs client-side (cheap, both lists already in memory after B3's
// ImportWizard render) — the server just executes what was confirmed.
//
// Merge semantics per spec:
//   - Move the personal pet's healthRecords subcollection docs over to
//     the family pet (read all, batched .set on the new ref, batched
//     .delete on the old refs — Firestore has no atomic subcoll move).
//   - Reassign petId on the personal user's walks / reminders / expenses
//     to the family pet's id. (Other family members' walks/reminders/
//     expenses are untouched — they already pointed at the family pet.)
//   - Delete the personal pet doc.
//   - DO NOT overwrite family pet fields (photoURL / bio / weightKg) —
//     spec is explicit: family pet wins on every field. The non-canonical
//     pet's values are logged in the audit doc for forensics.
// ─────────────────────────────────────────────────────────────────────

type MergePair = { personalPetId: string; familyPetId: string };

export const mergeAndImportToFamily = onCall(
  { region: FUNCTION_REGION, cors: true, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const targetFamilyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!targetFamilyId) {
      throw new HttpsError("invalid-argument", "familyId required");
    }
    const merges = (req.data?.merges as MergePair[] | undefined) ?? [];

    // Membership guard (same as importPersonalToFamily).
    const familyRef = db.doc(`families/${targetFamilyId}`);
    const familySnap = await familyRef.get();
    if (!familySnap.exists) {
      throw new HttpsError("not-found", "Family not found");
    }
    const memberUids =
      (familySnap.data()?.memberUids as string[] | undefined) ?? [];
    if (!memberUids.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a member of the target family",
      );
    }

    const startedAt = Timestamp.now();
    const mergedPets: Array<{
      personalPetId: string;
      familyPetId: string;
      movedHealthRecords: number;
      reassignedWalks: number;
      reassignedReminders: number;
      reassignedExpenses: number;
      lostFields: Record<string, unknown>;
    }> = [];

    // ── Step 1: process each user-confirmed merge ───────────────────
    for (const pair of merges) {
      // Sanity: caller must actually own the personal pet AND the family
      // pet must belong to the target family. We trust the client's
      // matching, but we double-check ownership here to prevent a
      // malicious caller from "merging" some other family's pet into
      // theirs.
      const personalRef = db.doc(`pets/${pair.personalPetId}`);
      const familyPetRef = db.doc(`pets/${pair.familyPetId}`);
      const [personalSnap, familyPetSnap] = await Promise.all([
        personalRef.get(),
        familyPetRef.get(),
      ]);
      if (!personalSnap.exists || !familyPetSnap.exists) continue;

      const pData = personalSnap.data() ?? {};
      const fData = familyPetSnap.data() ?? {};
      if (pData.familyId !== null || pData.ownerUid !== uid) {
        // Not actually the caller's personal pet — skip silently to keep
        // the rest of the merge batch from aborting.
        continue;
      }
      if (fData.familyId !== targetFamilyId) {
        continue;
      }

      // Move healthRecords subcollection: read personal pet's records,
      // batched-write to family pet path, batched-delete from old.
      let movedHealthRecords = 0;
      const hrSnap = await personalRef.collection("healthRecords").get();
      if (!hrSnap.empty) {
        const docs = hrSnap.docs;
        for (let i = 0; i < docs.length; i += 200) {
          const slice = docs.slice(i, i + 200);
          const writeBatch = db.batch();
          for (const d of slice) {
            const newRef = familyPetRef
              .collection("healthRecords")
              .doc(d.id);
            writeBatch.set(newRef, { ...d.data(), petId: pair.familyPetId });
            writeBatch.delete(d.ref);
          }
          await writeBatch.commit();
          movedHealthRecords += slice.length;
        }
      }

      // Reassign petId on caller's personal walks/reminders/expenses
      // that pointed at the personal pet. Note: we DON'T touch other
      // members' docs (they wouldn't reference a personal pet anyway).
      const collections = [
        { col: "walks", owner: "walkerUid" },
        { col: "reminders", owner: "createdByUid" },
        { col: "expenses", owner: "payerUid" },
      ] as const;
      const reassigned: Record<string, number> = {
        walks: 0,
        reminders: 0,
        expenses: 0,
      };
      for (const { col, owner } of collections) {
        const qSnap = await db
          .collection(col)
          .where(owner, "==", uid)
          .where("familyId", "==", null)
          .where("petId", "==", pair.personalPetId)
          .get();
        if (qSnap.empty) continue;
        const docs = qSnap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const slice = docs.slice(i, i + 400);
          const wb = db.batch();
          for (const d of slice) {
            // Reassign to the family pet AND switch into the family in
            // one write so the doc transitions atomically from personal
            // to family-scoped.
            wb.update(d.ref, {
              petId: pair.familyPetId,
              familyId: targetFamilyId,
            });
          }
          await wb.commit();
          reassigned[col] += slice.length;
        }
      }

      // Capture the values we're about to drop — spec wants them in the
      // audit log so the user could in principle recover.
      const lostFields = {
        photoURL: pData.photoURL ?? null,
        bio: pData.bio ?? null,
        weightKg: pData.weightKg ?? null,
        breed: pData.breed ?? null,
      };

      // Delete the personal pet doc last — order matters: if anything
      // above fails, a retry replays the moves idempotently (set/update
      // by id), but a half-done state still has the personal pet doc
      // present, which is the right signal that the merge isn't done.
      await personalRef.delete();

      mergedPets.push({
        personalPetId: pair.personalPetId,
        familyPetId: pair.familyPetId,
        movedHealthRecords,
        reassignedWalks: reassigned.walks,
        reassignedReminders: reassigned.reminders,
        reassignedExpenses: reassigned.expenses,
        lostFields,
      });
    }

    // ── Step 2: bulk import everything remaining ────────────────────
    // After the merges above, any remaining personal-mode docs the
    // caller owns get the same flat move importPersonalToFamily does.
    // We don't filter by type here because the wizard already decided
    // — if the caller wants no bulk move, they pass merges only and
    // type-restrict via the existing importPersonalToFamily callable
    // (server-side honouring the client choice is the wizard's job).
    const importCounts: ImportCounts = {
      pets: 0,
      walks: 0,
      reminders: 0,
      expenses: 0,
    };
    const requestedTypes = req.data?.importTypes as ImportType[] | undefined;
    const targets =
      requestedTypes && requestedTypes.length > 0
        ? IMPORT_TARGETS.filter((t) => requestedTypes.includes(t.type))
        : IMPORT_TARGETS;

    for (const target of targets) {
      const snap = await db
        .collection(target.collection)
        .where(target.ownerField, "==", uid)
        .where("familyId", "==", null)
        .get();
      if (snap.empty) continue;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const slice = docs.slice(i, i + 400);
        const wb = db.batch();
        for (const d of slice) {
          wb.update(d.ref, { familyId: targetFamilyId });
        }
        await wb.commit();
        importCounts[target.type] += slice.length;
      }
    }

    // ── Step 3: audit ───────────────────────────────────────────────
    const finishedAt = Timestamp.now();
    const isoNow = new Date(finishedAt.toMillis()).toISOString();
    const auditId = `merge-import-from-${uid}-${isoNow}`;
    await familyRef.collection("migrations").doc(auditId).set({
      type: "merge-and-import",
      fromUid: uid,
      targetFamilyId,
      startedAt,
      finishedAt,
      mergedPets,
      importCounts,
      requestedTypes: requestedTypes ?? null,
    });

    logger.info(
      `mergeAndImportToFamily: uid=${uid} family=${targetFamilyId} ` +
        `merged=${mergedPets.length} import=${JSON.stringify(importCounts)}`,
    );

    return { mergedPets, importCounts };
  },
);

// ─────────────────────────────────────────────────────────────────────
// deleteUserAccount — D1 (full hard delete cascade)
// User-initiated account deletion per docs/features/delete-account.md.
// Step order matters — see spec Phase 1 §"執行順序很重要".
// ─────────────────────────────────────────────────────────────────────

type DeleteSummary = {
  personalPetsHardDeleted: number;
  personalWalksHardDeleted: number;
  personalRemindersHardDeleted: number;
  personalExpensesHardDeleted: number;
  familyPetsHardDeleted: number;
  familyPetSubcollectionsCascaded: number;
  familyWalksHardDeleted: number;
  familyRemindersHardDeleted: number;
  familyRemindersDoneByCleared: number;
  familyExpensesHardDeleted: number;
  postsHardDeleted: number;
  reactionsHardDeleted: number;
  reviewsHardDeleted: number;
  restaurantsSubmittedByCleared: number;
  familiesLeft: number;
  familiesDissolved: number;
  storagePhotosDeleted: number;
};

const BATCH_SIZE = 400; // stay safely under Firestore's 500-write cap

/** Commit `mutator` calls in chunked batches so a 5000-doc cleanup
 *  doesn't blow the 500-write batch limit. Best-effort per chunk —
 *  if a chunk fails the error propagates and the caller aborts the
 *  remaining steps. */
async function deleteIdsInBatches<T>(
  items: T[],
  mutator: (b: FirebaseFirestore.WriteBatch, item: T) => void,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const item of slice) mutator(batch, item);
    await batch.commit();
  }
}

export const deleteUserAccount = onCall(
  {
    region: FUNCTION_REGION,
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const confirmDisplayName =
      ((req.data?.confirmDisplayName as string | undefined) ?? "").trim();

    // ─── Step 0: verify displayName matches before anything destructive
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }
    const userData = userSnap.data() ?? {};
    if (userData.displayName !== confirmDisplayName) {
      throw new HttpsError(
        "failed-precondition",
        "displayName confirmation does not match",
      );
    }

    const summary: DeleteSummary = {
      personalPetsHardDeleted: 0,
      personalWalksHardDeleted: 0,
      personalRemindersHardDeleted: 0,
      personalExpensesHardDeleted: 0,
      familyPetsHardDeleted: 0,
      familyPetSubcollectionsCascaded: 0,
      familyWalksHardDeleted: 0,
      familyRemindersHardDeleted: 0,
      familyRemindersDoneByCleared: 0,
      familyExpensesHardDeleted: 0,
      postsHardDeleted: 0,
      reactionsHardDeleted: 0,
      reviewsHardDeleted: 0,
      restaurantsSubmittedByCleared: 0,
      familiesLeft: 0,
      familiesDissolved: 0,
      storagePhotosDeleted: 0,
    };

    // ─── Step 1: collect pets where this user is the creator (ownerUid).
    // These get cascade-deleted along with every sub-doc that references
    // them. We need their petIds up front so steps 2-3 can scrub
    // walks/reminders/expenses that pointed at them and avoid double-
    // counting in step 4.
    const myPetsSnap = await db
      .collection("pets")
      .where("ownerUid", "==", uid)
      .get();
    const myPetIds = new Set(myPetsSnap.docs.map((d) => d.id));
    const personalPetIds = new Set<string>();
    for (const p of myPetsSnap.docs) {
      if (p.data().familyId === null) {
        personalPetIds.add(p.id);
        summary.personalPetsHardDeleted++;
      } else {
        summary.familyPetsHardDeleted++;
      }
    }

    // ─── Step 2: per-pet subcollection cleanup (healthRecords + the
    // top-level walks/reminders/expenses that target each petId).
    for (const petId of myPetIds) {
      const isPersonal = personalPetIds.has(petId);

      // 2a. healthRecords subcollection.
      const hrSnap = await db
        .collection("pets")
        .doc(petId)
        .collection("healthRecords")
        .get();
      await deleteIdsInBatches(hrSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) {
        // healthRecords don't have a dedicated personal counter — the
        // spec rolls them into personalPetsHardDeleted's implied cascade;
        // we silently delete without bumping a counter.
      } else {
        summary.familyPetSubcollectionsCascaded += hrSnap.size;
      }

      // 2b. walks pointing at this pet.
      const walksSnap = await db
        .collection("walks")
        .where("petId", "==", petId)
        .get();
      await deleteIdsInBatches(walksSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) summary.personalWalksHardDeleted += walksSnap.size;
      else summary.familyPetSubcollectionsCascaded += walksSnap.size;

      // 2c. reminders pointing at this pet.
      const remSnap = await db
        .collection("reminders")
        .where("petId", "==", petId)
        .get();
      await deleteIdsInBatches(remSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) summary.personalRemindersHardDeleted += remSnap.size;
      else summary.familyPetSubcollectionsCascaded += remSnap.size;

      // 2d. expenses pointing at this pet.
      const expSnap = await db
        .collection("expenses")
        .where("petId", "==", petId)
        .get();
      await deleteIdsInBatches(expSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) summary.personalExpensesHardDeleted += expSnap.size;
      else summary.familyPetSubcollectionsCascaded += expSnap.size;
    }

    // ─── Step 3: delete the pet docs themselves.
    await deleteIdsInBatches(myPetsSnap.docs, (b, d) => b.delete(d.ref));

    // ─── Step 4: walks/reminders/expenses owned by the user under OTHER
    // people's pets. We query by the per-collection owner field and
    // exclude anything whose petId was already cascaded in step 2.
    {
      const snap = await db
        .collection("walks")
        .where("walkerUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => !myPetIds.has(d.data().petId as string),
      );
      // Only family-mode walks fall here; personal-mode walks have
      // walkerUid === uid AND petId in personalPetIds → already cascaded.
      // Defensive: also exclude familyId === null just in case (shouldn't
      // happen because personal walks ALWAYS reference a personal pet).
      const familyDocs = docs.filter((d) => d.data().familyId !== null);
      await deleteIdsInBatches(familyDocs, (b, d) => b.delete(d.ref));
      summary.familyWalksHardDeleted += familyDocs.length;
    }
    {
      const snap = await db
        .collection("reminders")
        .where("createdByUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => !myPetIds.has(d.data().petId as string),
      );
      const familyDocs = docs.filter((d) => d.data().familyId !== null);
      await deleteIdsInBatches(familyDocs, (b, d) => b.delete(d.ref));
      summary.familyRemindersHardDeleted += familyDocs.length;
    }
    {
      const snap = await db
        .collection("expenses")
        .where("payerUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => !myPetIds.has(d.data().petId as string),
      );
      const familyDocs = docs.filter((d) => d.data().familyId !== null);
      await deleteIdsInBatches(familyDocs, (b, d) => b.delete(d.ref));
      summary.familyExpensesHardDeleted += familyDocs.length;
    }

    // ─── Step 5: clear doneByUid/doneAt on reminders this user marked
    // done but didn't create. The reminder doc stays (it belongs to
    // someone else); only the attribution gets scrubbed.
    {
      const snap = await db
        .collection("reminders")
        .where("doneByUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => d.data().createdByUid !== uid && !myPetIds.has(d.data().petId as string),
      );
      await deleteIdsInBatches(docs, (b, d) =>
        b.update(d.ref, {
          doneByUid: FieldValue.delete(),
          doneAt: FieldValue.delete(),
        }),
      );
      summary.familyRemindersDoneByCleared += docs.length;
    }

    // ─── Step 6a: clear submittedByUid on restaurants. Restaurants are
    // community assets — we keep them around with attribution stripped.
    {
      const snap = await db
        .collection("restaurants")
        .where("submittedByUid", "==", uid)
        .get();
      await deleteIdsInBatches(snap.docs, (b, d) =>
        b.update(d.ref, { submittedByUid: FieldValue.delete() }),
      );
      summary.restaurantsSubmittedByCleared += snap.size;
    }

    // ─── Step 6b: posts authored by this user. Each post has a reactions
    // subcollection; nuke that first, then the post.
    {
      const postsSnap = await db
        .collection("posts")
        .where("authorUid", "==", uid)
        .get();
      for (const post of postsSnap.docs) {
        const rxSnap = await post.ref.collection("reactions").get();
        await deleteIdsInBatches(rxSnap.docs, (b, d) => b.delete(d.ref));
      }
      await deleteIdsInBatches(postsSnap.docs, (b, d) => b.delete(d.ref));
      summary.postsHardDeleted += postsSnap.size;
    }

    // ─── Step 6c: this user's reactions on OTHER people's posts.
    // Decrement each post's reactionCounts[emoji] before deleting the
    // reaction doc. Skip reactions on the user's own posts (already
    // killed by 6b) — grouped by parent post so we batch one update
    // per post.
    {
      const rxSnap = await db
        .collectionGroup("reactions")
        .where("uid", "==", uid)
        .get();
      // Group reactions by parent post id, accumulating per-emoji counts.
      // Skip reactions whose parent post we already deleted in 6b — same
      // condition: post.authorUid === uid → the post is gone and any
      // increment update against it would 404.
      const perPost = new Map<
        string,
        {
          ref: FirebaseFirestore.DocumentReference;
          emojiCounts: Record<string, number>;
          reactionRefs: FirebaseFirestore.DocumentReference[];
        }
      >();
      for (const r of rxSnap.docs) {
        const postRef = r.ref.parent.parent;
        if (!postRef) continue;
        const postSnap = await postRef.get();
        if (!postSnap.exists) continue;
        if (postSnap.data()?.authorUid === uid) continue;
        const emoji = (r.data().emoji as string) || "❤️";
        let entry = perPost.get(postRef.id);
        if (!entry) {
          entry = { ref: postRef, emojiCounts: {}, reactionRefs: [] };
          perPost.set(postRef.id, entry);
        }
        entry.emojiCounts[emoji] = (entry.emojiCounts[emoji] ?? 0) + 1;
        entry.reactionRefs.push(r.ref);
      }
      // Apply per-post: decrement counts then delete reaction doc.
      for (const entry of perPost.values()) {
        const updates: Record<string, FirebaseFirestore.FieldValue> = {};
        for (const [emoji, n] of Object.entries(entry.emojiCounts)) {
          updates[`reactionCounts.${emoji}`] = FieldValue.increment(-n);
        }
        const batch = db.batch();
        batch.update(entry.ref, updates);
        for (const refToDelete of entry.reactionRefs) batch.delete(refToDelete);
        await batch.commit();
        summary.reactionsHardDeleted += entry.reactionRefs.length;
      }
    }

    // ─── Step 6d: restaurant reviews authored by this user. Per spec,
    // recompute averageRating + reviewCount on each affected restaurant.
    {
      const reviewsSnap = await db
        .collectionGroup("reviews")
        .where("authorUid", "==", uid)
        .get();
      // Group by parent restaurant to do one rating recompute per
      // restaurant instead of per review.
      const perRestaurant = new Map<
        string,
        {
          ref: FirebaseFirestore.DocumentReference;
          reviewRefs: FirebaseFirestore.DocumentReference[];
        }
      >();
      for (const rv of reviewsSnap.docs) {
        const restRef = rv.ref.parent.parent;
        if (!restRef) continue;
        let entry = perRestaurant.get(restRef.id);
        if (!entry) {
          entry = { ref: restRef, reviewRefs: [] };
          perRestaurant.set(restRef.id, entry);
        }
        entry.reviewRefs.push(rv.ref);
      }
      for (const entry of perRestaurant.values()) {
        // Delete the reviews first.
        await deleteIdsInBatches(entry.reviewRefs, (b, ref) => b.delete(ref));
        // Recompute from the surviving review set.
        const remaining = await entry.ref.collection("reviews").get();
        let sum = 0;
        for (const rv of remaining.docs)
          sum += Number(rv.data().rating) || 0;
        const newCount = remaining.size;
        const newAvg = newCount > 0 ? sum / newCount : 0;
        await entry.ref.update({
          averageRating: newAvg,
          reviewCount: newCount,
        });
        summary.reviewsHardDeleted += entry.reviewRefs.length;
      }
    }

    // ─── Step 7: friends + friendRequests (both directions).
    {
      // My friends subcollection — for each entry, also delete the reverse
      // doc at users/{friendUid}/friends/{myUid}.
      const friendsSnap = await userRef.collection("friends").get();
      const friendUids = friendsSnap.docs.map((d) => d.id);
      await deleteIdsInBatches(friendsSnap.docs, (b, d) => b.delete(d.ref));
      // Reverse side.
      await deleteIdsInBatches(friendUids, (b, friendUid) =>
        b.delete(db.doc(`users/${friendUid}/friends/${uid}`)),
      );

      // friendRequests TO me: just nuke the subcollection.
      const incomingReqs = await userRef.collection("friendRequests").get();
      await deleteIdsInBatches(incomingReqs.docs, (b, d) => b.delete(d.ref));

      // friendRequests FROM me to others: collectionGroup lookup since the
      // docs live under different users.
      const outgoingReqs = await db
        .collectionGroup("friendRequests")
        .where("fromUid", "==", uid)
        .get();
      await deleteIdsInBatches(outgoingReqs.docs, (b, d) => b.delete(d.ref));
    }

    // ─── Step 8: small per-user subcollections (favorites + bookmarks).
    {
      const favSnap = await userRef.collection("favoriteRestaurants").get();
      await deleteIdsInBatches(favSnap.docs, (b, d) => b.delete(d.ref));
      const bmSnap = await userRef.collection("knowledgeBookmarks").get();
      await deleteIdsInBatches(bmSnap.docs, (b, d) => b.delete(d.ref));
    }

    // ─── Step 9: leaderboard entries (one per period).
    {
      const lbSnap = await db
        .collectionGroup("entries")
        .where("uid", "==", uid)
        .get();
      await deleteIdsInBatches(lbSnap.docs, (b, d) => b.delete(d.ref));
    }

    // ─── Step 10: families. For each family the user belongs to:
    //   - if they're the sole member → dissolve (delete family doc)
    //   - if they're the owner → promote memberUids[1] (next-oldest) to owner
    //   - always: remove uid from memberUids
    {
      const familyIds: string[] =
        (userData.familyIds as string[] | undefined) ?? [];
      for (const familyId of familyIds) {
        const famRef = db.doc(`families/${familyId}`);
        const famSnap = await famRef.get();
        if (!famSnap.exists) continue;
        const fam = famSnap.data() ?? {};
        const members = (fam.memberUids as string[] | undefined) ?? [];
        const remaining = members.filter((m) => m !== uid);
        if (remaining.length === 0) {
          // Sole member → dissolve.
          await famRef.delete();
          summary.familiesDissolved++;
          continue;
        }
        const updates: Record<string, unknown> = {
          memberUids: FieldValue.arrayRemove(uid),
        };
        if (fam.ownerUid === uid) {
          updates.ownerUid = remaining[0];
        }
        await famRef.update(updates);
        summary.familiesLeft++;
      }
    }

    // ─── Step 11: audit doc. Written BEFORE the user doc + auth user
    // delete so we always have a record even if step 13/14 fail.
    const isoNow = new Date().toISOString();
    const auditRef = db.doc(`deletedAccounts/${uid}-${isoNow}`);
    await auditRef.set({
      deletedAt: Timestamp.now(),
      reason: "user-initiated",
      summary,
    });

    // ─── Step 12: storage cleanup. Both pet avatars and post photos live
    // under users/{uid}/ — one prefix-delete covers everything this user
    // uploaded. Best-effort: failures here don't roll back Firestore (the
    // orphan files are cheap and not user-visible). We list first for an
    // accurate count, then delete — `deleteFiles` itself returns void
    // in the current SDK.
    try {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
      const fileCount = files.length;
      if (fileCount > 0) {
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
      }
      summary.storagePhotosDeleted = fileCount;
      await auditRef.update({ "summary.storagePhotosDeleted": fileCount });
    } catch (err) {
      logger.warn(`deleteUserAccount: storage cleanup failed for uid=${uid}`, err);
    }

    // ─── Step 13: delete the user profile doc. (Subcollections already
    // emptied above — Firestore deletes the doc itself; subcoll docs
    // would survive but they're already gone.)
    await userRef.delete();

    // ─── Step 14: nuke the Firebase Auth user. Done last so a failure
    // here leaves the data already deleted (user could just sign in
    // again to a clean state) instead of the opposite.
    try {
      await getAuth().deleteUser(uid);
    } catch (err) {
      logger.error(
        `deleteUserAccount: auth.deleteUser failed for uid=${uid} ` +
          `— Firestore already wiped; user may retry sign-in to clean up`,
        err,
      );
      // Don't rethrow — the user's data is gone, they're effectively
      // deleted from the app's perspective even if the auth record
      // lingers (it'll re-create an empty user doc on next sign-in).
    }

    logger.info(
      `deleteUserAccount: completed uid=${uid} summary=${JSON.stringify(summary)}`,
    );

    return { summary };
  },
);

// ─────────────────────────────────────────────────────────────────────
// cleanupLegacyPaths — admin-only, destructive
//
// Wipes the frozen legacy `users/{uid}/{pets,walks,reminders,expenses}`
// sub-collections (and `pets/{petId}/healthRecords` underneath) that the
// Phase 3+4 family migration left in place. Client lib has not written
// to these paths for weeks; this just removes the cold storage so we can
// drop the legacy rule blocks and shrink the schema surface.
//
// Spec: docs/features/legacy-path-cleanup.md (Phase 2)
//
// Auth: requires Firebase Auth custom claim `admin == true`. The actual
// one-off cleanup is run from functions/scripts/run-legacy-cleanup.mjs
// (Admin SDK, no callable round-trip) to avoid setting up custom claims
// + ID-token exchange for a single ops run. This callable exists for
// the spec record and any future programmatic re-run; audit docs
// include `source: "callable" | "admin-script"` so both paths are
// distinguishable in `legacyCleanups/*`.
//
// Safety:
//   - default dryRun = true (must pass `dryRun: false` explicitly)
//   - per-uid try/catch — one user's failure doesn't abort the rest
//   - 400-doc batches (Firestore hard cap 500, buffer per backend.md §⑤)
//   - audit doc written even on partial failure
// ─────────────────────────────────────────────────────────────────────

type LegacyCleanupCounts = {
  uid: string;
  pets: number;
  healthRecords: number;
  walks: number;
  reminders: number;
  expenses: number;
};

const LEGACY_CLEANUP_BATCH_LIMIT = 400;

async function deleteRefsInBatches(
  refs: FirebaseFirestore.DocumentReference[],
): Promise<void> {
  for (let i = 0; i < refs.length; i += LEGACY_CLEANUP_BATCH_LIMIT) {
    const slice = refs.slice(i, i + LEGACY_CLEANUP_BATCH_LIMIT);
    const batch = db.batch();
    for (const ref of slice) batch.delete(ref);
    await batch.commit();
  }
}

/** Per-uid cleanup. The runner script duplicates this logic verbatim —
 *  keep both in sync if the schema ever grows new legacy paths. */
async function cleanupLegacyForUid(
  uid: string,
  dryRun: boolean,
): Promise<LegacyCleanupCounts> {
  const counts: LegacyCleanupCounts = {
    uid,
    pets: 0,
    healthRecords: 0,
    walks: 0,
    reminders: 0,
    expenses: 0,
  };

  // Order matters when actually deleting: nested healthRecords first so
  // pet docs disappear after their children, never leaving orphan
  // sub-collections that would pollute future collectionGroup queries.
  const petsSnap = await db.collection(`users/${uid}/pets`).get();
  for (const petDoc of petsSnap.docs) {
    const hrSnap = await db
      .collection(`users/${uid}/pets/${petDoc.id}/healthRecords`)
      .get();
    if (!dryRun && hrSnap.size > 0) {
      await deleteRefsInBatches(hrSnap.docs.map((d) => d.ref));
    }
    counts.healthRecords += hrSnap.size;
  }

  if (!dryRun && petsSnap.size > 0) {
    await deleteRefsInBatches(petsSnap.docs.map((d) => d.ref));
  }
  counts.pets = petsSnap.size;

  const walksSnap = await db.collection(`users/${uid}/walks`).get();
  if (!dryRun && walksSnap.size > 0) {
    await deleteRefsInBatches(walksSnap.docs.map((d) => d.ref));
  }
  counts.walks = walksSnap.size;

  const remindersSnap = await db.collection(`users/${uid}/reminders`).get();
  if (!dryRun && remindersSnap.size > 0) {
    await deleteRefsInBatches(remindersSnap.docs.map((d) => d.ref));
  }
  counts.reminders = remindersSnap.size;

  const expensesSnap = await db.collection(`users/${uid}/expenses`).get();
  if (!dryRun && expensesSnap.size > 0) {
    await deleteRefsInBatches(expensesSnap.docs.map((d) => d.ref));
  }
  counts.expenses = expensesSnap.size;

  return counts;
}

export const cleanupLegacyPaths = onCall(
  {
    region: FUNCTION_REGION,
    cors: true,
    // 9 min — large user counts × 5 sub-collections each can take a while.
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (req) => {
    if (req.auth?.token?.admin !== true) {
      throw new HttpsError(
        "permission-denied",
        "admin custom claim required",
      );
    }
    // Default to dryRun unless explicitly disabled — destructive op
    // should never accidentally fire on a bare `{}` call.
    const dryRun = req.data?.dryRun !== false;
    const targetUid =
      (req.data?.targetUid as string | undefined)?.trim() || undefined;

    let uids: string[];
    if (targetUid) {
      uids = [targetUid];
    } else {
      const allUsers = await db.collection("users").get();
      uids = allUsers.docs.map((d) => d.id);
    }

    logger.info(
      `cleanupLegacyPaths: mode=${dryRun ? "dryRun" : "REAL"} uids=${uids.length}` +
        (targetUid ? ` target=${targetUid}` : ""),
    );

    const counts: LegacyCleanupCounts[] = [];
    let uidsFailed = 0;
    for (const uid of uids) {
      try {
        counts.push(await cleanupLegacyForUid(uid, dryRun));
      } catch (err) {
        uidsFailed++;
        logger.error(`cleanupLegacyPaths uid=${uid} failed`, err);
      }
    }

    const totals = counts.reduce(
      (acc, c) => ({
        pets: acc.pets + c.pets,
        healthRecords: acc.healthRecords + c.healthRecords,
        walks: acc.walks + c.walks,
        reminders: acc.reminders + c.reminders,
        expenses: acc.expenses + c.expenses,
      }),
      { pets: 0, healthRecords: 0, walks: 0, reminders: 0, expenses: 0 },
    );

    // Audit doc id = ISO timestamp with `:` and `.` swapped for `-`
    // (both are technically valid in Firestore doc ids but awkward in
    // URLs and CLI usage).
    const auditId = new Date().toISOString().replace(/[:.]/g, "-");
    await db.collection("legacyCleanups").doc(auditId).set({
      cleanedAt: Timestamp.now(),
      reason: "schema-cleanup",
      mode: dryRun ? "dryRun" : "real",
      invokedBy: req.auth.uid,
      source: "callable",
      targetUid: targetUid ?? null,
      uidsProcessed: uids.length,
      uidsFailed,
      totals,
      // Keep only uids that had something to report; a 200-row audit
      // doc full of zeros is just noise.
      counts: counts.filter(
        (c) =>
          c.pets + c.healthRecords + c.walks + c.reminders + c.expenses > 0,
      ),
    });

    logger.info(
      `cleanupLegacyPaths done — mode=${dryRun ? "dryRun" : "real"} ` +
        `totals=${JSON.stringify(totals)} failed=${uidsFailed} audit=${auditId}`,
    );

    return {
      ok: true,
      mode: dryRun ? "dryRun" : "real",
      auditId,
      uidsProcessed: uids.length,
      uidsFailed,
      totals,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────
// backfillDisplayNameLower — admin-only, idempotent
//
// One-shot migration to populate `displayNameLower` on every existing
// users/{uid} doc that's missing it. Phase 1 (commit 07c874d) ensures
// new writes set the field; this fills in the historical gap so the
// Phase 3 searchUsers query (will read from displayNameLower) returns
// the full corpus.
//
// Spec: docs/features/friends-search-lowercase.md (Phase 2)
//
// Same operational pattern as cleanupLegacyPaths above:
//   - admin custom claim required at the callable seam
//   - actual one-off run happens via
//     functions/scripts/run-backfill-display-name-lower.mjs (Admin SDK,
//     ADC) to avoid ID-token exchange for an ops run
//   - audit doc legacy: `displayNameLowerBackfills/{ISO}` with
//     source: "callable" | "admin-script" to keep both paths
//     distinguishable
//
// Safety:
//   - default dryRun = true; opt out with `{ dryRun: false }`
//   - 400-doc batches (Firestore hard cap 500, buffer per backend.md)
//   - idempotent — skips docs that already have a non-empty value, so
//     re-running is safe and the next dry run shows missing=0
// ─────────────────────────────────────────────────────────────────────

type DisplayNameLowerBackfillCounts = {
  total: number;
  missing: number;
  written: number;
};

const DISPLAY_NAME_BACKFILL_BATCH_LIMIT = 400;

function computeDisplayNameLower(displayName: unknown): string {
  return String(displayName ?? "").trim().toLowerCase();
}

export const backfillDisplayNameLower = onCall(
  {
    region: FUNCTION_REGION,
    cors: true,
    // < 10 min cap. 1k users × 1 read + few-hundred batched writes is
    // comfortably under, but headroom for future growth doesn't hurt.
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (req) => {
    if (req.auth?.token?.admin !== true) {
      throw new HttpsError(
        "permission-denied",
        "admin custom claim required",
      );
    }
    const dryRun = req.data?.dryRun !== false;

    const allUsers = await db.collection("users").get();
    const total = allUsers.size;

    // Identify everyone missing the field. Treat empty string as missing
    // too — if upsertUser ever wrote `""` for a user with no displayName,
    // we still want the migration to fix it.
    const pending: { ref: FirebaseFirestore.DocumentReference; value: string }[] = [];
    for (const doc of allUsers.docs) {
      const data = doc.data();
      const existing = data.displayNameLower;
      if (typeof existing === "string" && existing.length > 0) continue;
      pending.push({ ref: doc.ref, value: computeDisplayNameLower(data.displayName) });
    }
    const missing = pending.length;

    let written = 0;
    if (!dryRun) {
      for (let i = 0; i < pending.length; i += DISPLAY_NAME_BACKFILL_BATCH_LIMIT) {
        const slice = pending.slice(i, i + DISPLAY_NAME_BACKFILL_BATCH_LIMIT);
        const batch = db.batch();
        for (const { ref, value } of slice) {
          batch.update(ref, { displayNameLower: value });
        }
        await batch.commit();
        written += slice.length;
      }
    }

    const counts: DisplayNameLowerBackfillCounts = { total, missing, written };
    const auditId = new Date().toISOString().replace(/[:.]/g, "-");
    await db.collection("displayNameLowerBackfills").doc(auditId).set({
      ranAt: Timestamp.now(),
      mode: dryRun ? "dryRun" : "real",
      invokedBy: req.auth.uid,
      source: "callable",
      counts,
    });

    logger.info(
      `backfillDisplayNameLower done — mode=${dryRun ? "dryRun" : "real"} ` +
        `counts=${JSON.stringify(counts)} audit=${auditId}`,
    );

    return {
      ok: true,
      mode: dryRun ? "dryRun" : "real",
      auditId,
      counts,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────
// exportUserData — read-only snapshot of "everything that's mine"
// Mirrors the SCOPE of deleteUserAccount's cascade (so user sees what
// would disappear), but read-only and never mutates. JSON returned
// directly to the client for browser-download. Spec:
// docs/features/data-export.md.
// ─────────────────────────────────────────────────────────────────────

export const exportUserData = onCall(
  {
    region: FUNCTION_REGION,
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    // ── User profile ─────────────────────────────────────────────────
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }
    const userData = userSnap.data() ?? {};

    // ── Per-user sub-collections ─────────────────────────────────────
    const [friendsSnap, incomingReqsSnap, favSnap, bmSnap] = await Promise.all([
      userRef.collection("friends").get(),
      userRef.collection("friendRequests").get(),
      userRef.collection("favoriteRestaurants").get(),
      userRef.collection("knowledgeBookmarks").get(),
    ]);

    // friendRequests SENT by me — collection-group lookup since they
    // live under other users.
    const outgoingReqsSnap = await db
      .collectionGroup("friendRequests")
      .where("fromUid", "==", uid)
      .get();

    // ── Pets I created (personal + family) + their sub-data ─────────
    const myPetsSnap = await db
      .collection("pets")
      .where("ownerUid", "==", uid)
      .get();
    const myPetIds = new Set(myPetsSnap.docs.map((d) => d.id));

    type PetExport = Record<string, unknown> & {
      petId: string;
      healthRecords: Record<string, unknown>[];
      walks: Record<string, unknown>[];
      reminders: Record<string, unknown>[];
      expenses: Record<string, unknown>[];
    };

    const pets: PetExport[] = [];
    for (const p of myPetsSnap.docs) {
      const petId = p.id;
      const [hr, w, r, e] = await Promise.all([
        db.collection("pets").doc(petId).collection("healthRecords").get(),
        db.collection("walks").where("petId", "==", petId).get(),
        db.collection("reminders").where("petId", "==", petId).get(),
        db.collection("expenses").where("petId", "==", petId).get(),
      ]);
      pets.push({
        ...(p.data() as Record<string, unknown>),
        petId,
        healthRecords: hr.docs.map((d) => ({ ...d.data(), recordId: d.id })),
        walks: w.docs.map((d) => ({ ...d.data(), walkId: d.id })),
        reminders: r.docs.map((d) => ({ ...d.data(), reminderId: d.id })),
        expenses: e.docs.map((d) => ({ ...d.data(), expenseId: d.id })),
      });
    }

    // ── Free-standing walks/reminders/expenses I own under OTHERS' pets ──
    // (filter out anything whose parent pet was already exported above)
    const [allMyWalksSnap, createdRemSnap, doneRemSnap, allMyExpensesSnap] =
      await Promise.all([
        db.collection("walks").where("walkerUid", "==", uid).get(),
        db.collection("reminders").where("createdByUid", "==", uid).get(),
        db.collection("reminders").where("doneByUid", "==", uid).get(),
        db.collection("expenses").where("payerUid", "==", uid).get(),
      ]);

    const freeWalks = allMyWalksSnap.docs
      .filter((d) => !myPetIds.has(d.data().petId as string))
      .map((d) => ({ ...d.data(), walkId: d.id }));

    // Union reminders created-by + done-by; dedupe by id. Don't include
    // those already nested under my own pets.
    const reminderById = new Map<string, Record<string, unknown>>();
    for (const d of [...createdRemSnap.docs, ...doneRemSnap.docs]) {
      if (myPetIds.has(d.data().petId as string)) continue;
      if (reminderById.has(d.id)) continue;
      reminderById.set(d.id, { ...d.data(), reminderId: d.id });
    }
    const freeReminders = Array.from(reminderById.values());

    const freeExpenses = allMyExpensesSnap.docs
      .filter((d) => !myPetIds.has(d.data().petId as string))
      .map((d) => ({ ...d.data(), expenseId: d.id }));

    // ── Posts authored by me + their reactions subcollection ────────
    const myPostsSnap = await db
      .collection("posts")
      .where("authorUid", "==", uid)
      .get();
    const posts: Record<string, unknown>[] = [];
    for (const p of myPostsSnap.docs) {
      const rx = await p.ref.collection("reactions").get();
      posts.push({
        ...(p.data() as Record<string, unknown>),
        postId: p.id,
        reactions: rx.docs.map((d) => ({ ...d.data(), uid: d.id })),
      });
    }

    // ── My reactions on OTHERS' posts ───────────────────────────────
    const rxOnOthersSnap = await db
      .collectionGroup("reactions")
      .where("uid", "==", uid)
      .get();
    const postReactionsOnOthers: Record<string, unknown>[] = [];
    for (const r of rxOnOthersSnap.docs) {
      const postRef = r.ref.parent.parent;
      if (!postRef) continue;
      // Skip reactions on my own posts — those rode along with `posts` above.
      const postSnap = await postRef.get();
      if (postSnap.exists && postSnap.data()?.authorUid === uid) continue;
      postReactionsOnOthers.push({
        ...(r.data() as Record<string, unknown>),
        postId: postRef.id,
      });
    }

    // ── Restaurant reviews I wrote ──────────────────────────────────
    const myReviewsSnap = await db
      .collectionGroup("reviews")
      .where("authorUid", "==", uid)
      .get();
    const restaurantReviews = myReviewsSnap.docs.map((d) => ({
      ...(d.data() as Record<string, unknown>),
      reviewId: d.id,
      restaurantId: d.ref.parent.parent?.id ?? null,
    }));

    // ── Families I belong to ────────────────────────────────────────
    const familyIds = (userData.familyIds as string[] | undefined) ?? [];
    const families: Record<string, unknown>[] = [];
    for (const fid of familyIds) {
      const fSnap = await db.doc(`families/${fid}`).get();
      if (!fSnap.exists) continue;
      families.push({ ...(fSnap.data() as Record<string, unknown>), familyId: fid });
    }

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        schemaVersion: "v1" as const,
        uid,
      },
      user: { ...userData, uid },
      friends: friendsSnap.docs.map((d) => ({ ...d.data(), uid: d.id })),
      friendRequests: {
        received: incomingReqsSnap.docs.map((d) => ({
          ...d.data(),
          requestId: d.id,
        })),
        sent: outgoingReqsSnap.docs.map((d) => ({
          ...d.data(),
          requestId: d.id,
          toUid: d.ref.parent.parent?.id ?? null,
        })),
      },
      favoriteRestaurants: favSnap.docs.map((d) => ({
        ...d.data(),
        restaurantId: d.id,
      })),
      knowledgeBookmarks: bmSnap.docs.map((d) => ({
        ...d.data(),
        articleId: d.id,
      })),
      pets,
      walks: freeWalks,
      reminders: freeReminders,
      expenses: freeExpenses,
      posts,
      postReactionsOnOthers,
      restaurantReviews,
      families,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────
// Engagement push helpers (Epic 5)
// ─────────────────────────────────────────────────────────────────────

/** Start-of-day in Asia/Taipei as a UTC Date. Taipei has no DST so a
 *  fixed +08:00 offset is safe here. Cheaper than pulling Intl.DateTimeFormat
 *  + parsing back. */
function startOfTaipeiDay(now: Date): Date {
  const TPE_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taipeiNow = now.getTime() + TPE_OFFSET_MS;
  const dayStartTaipei = Math.floor(taipeiNow / 86_400_000) * 86_400_000;
  return new Date(dayStartTaipei - TPE_OFFSET_MS);
}

type EngagementBody = { title: string; body: string };

/** Send a push to one user, with the same token-cleanup pattern as
 *  scanReminders (arrayRemove invalid tokens). Returns whether at least
 *  one delivery succeeded. */
async function sendEngagementPush(args: {
  uid: string;
  tokens: string[];
  body: EngagementBody;
  data?: Record<string, string>;
  link?: string;
}): Promise<{ ok: boolean; invalidCount: number }> {
  const { uid, tokens, body, data, link } = args;
  if (tokens.length === 0) return { ok: false, invalidCount: 0 };
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: body.title, body: body.body },
    data: { ...(data ?? {}), ...(link ? { url: link } : {}) },
    webpush: link ? { fcmOptions: { link } } : undefined,
  });
  const invalidTokens: string[] = [];
  response.responses.forEach((r, idx) => {
    if (!r.success && r.error) {
      const code = r.error.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });
  if (invalidTokens.length > 0) {
    await db
      .doc(`users/${uid}`)
      .update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
  }
  return { ok: response.successCount > 0, invalidCount: invalidTokens.length };
}

/** Pick i18n copy for an engagement push based on user.locale. The
 *  message bank lives here (server-side) — frontend doesn't render
 *  these strings, only the Settings toggles read the i18n labels for
 *  the section. Keys mirror messages/{locale}.json `Push.*` so wording
 *  stays in sync (manual sync at edit time). */
function pushCopy(
  locale: string | undefined,
  vars: Record<string, string | number>,
  zh: { title: string; body: string },
  en: { title: string; body: string },
): EngagementBody {
  const pick = locale === "en" ? en : zh;
  const interp = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  return { title: interp(pick.title), body: interp(pick.body) };
}

// ─────────────────────────────────────────────────────────────────────
// eveningWalkReminder — Phase 1 A1
// Cron 20:00 Asia/Taipei. For each user with FCM tokens + at least one
// pet + not opted out: if today's walk minutes < 30, push a nudge.
// ─────────────────────────────────────────────────────────────────────

const EVENING_WALK_REMINDER_TYPE = "evening-walk-reminder";

/** Hardcoded fallback for pets without a walkGoal (legacy pets +
 *  pets created before per-pet-walk-goal shipped). Kept in sync with
 *  DEFAULT_WALK_GOAL_MINUTES in src/lib/walk-goals.ts — Cloud
 *  Functions can't import from src/, so the value lives in both
 *  trees. If the default ever changes, update both. */
const DEFAULT_WALK_GOAL_MIN = 30;
const WALK_GOAL_MIN_BOUND = 5;
const WALK_GOAL_MAX_BOUND = 180;

/** Server-side mirror of getPetWalkGoalMinutes() in src/lib/walk-goals.ts.
 *  Returns the per-pet goal in minutes with the same clamp + fallback
 *  the client uses, so push thresholds match the dial the user sees.
 *  Accepts the raw Firestore doc data (not a typed Pet). */
function getPetWalkGoalMinutes(
  pet: Record<string, unknown> | null | undefined,
): number {
  const wg = pet?.walkGoal as { minutes?: unknown } | undefined;
  const m = wg?.minutes;
  if (typeof m === "number" && Number.isFinite(m) && m > 0) {
    return Math.min(WALK_GOAL_MAX_BOUND, Math.max(WALK_GOAL_MIN_BOUND, m));
  }
  return DEFAULT_WALK_GOAL_MIN;
}

export const eveningWalkReminder = onSchedule(
  {
    schedule: "0 20 * * *",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 1,
    memory: "256MiB",
  },
  async () => {
    const now = new Date();
    const startOfToday = startOfTaipeiDay(now);

    // Pre-aggregate today's walk minutes per walker. One global query
    // (cheap — `startedAt >=` over a day's worth of walks) beats N
    // per-user queries.
    const todaysWalksSnap = await db
      .collectionGroup("walks")
      .where("startedAt", ">=", Timestamp.fromMillis(startOfToday.getTime()))
      .get();
    const minutesByUid = new Map<string, number>();
    for (const d of todaysWalksSnap.docs) {
      const w = d.data();
      // Prefer walkerUid (new schema); fall back to ownerUid for legacy
      // docs migrated from the pre-family era.
      const uid = (w.walkerUid as string) || (w.ownerUid as string);
      if (!uid) continue;
      const min = Number(w.durationMin) || 0;
      minutesByUid.set(uid, (minutesByUid.get(uid) ?? 0) + min);
    }

    // Iterate every user — we have to read pushPrefs + a pet name per
    // user anyway, so a single `users` scan is fine. Realistic user
    // counts (low thousands) easily fit in memory.
    const usersSnap = await db.collection("users").get();
    let sent = 0;
    let skippedNoToken = 0;
    let skippedOptOut = 0;
    let skippedAlreadyHit = 0;
    let skippedNoPet = 0;
    let failed = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const u = userDoc.data();
      const tokens = ((u.fcmTokens ?? []) as string[]).filter(Boolean);
      if (tokens.length === 0) {
        skippedNoToken++;
        continue;
      }
      const optOut = (u.pushPrefs?.engagementOptOut ?? []) as string[];
      if (optOut.includes(EVENING_WALK_REMINDER_TYPE)) {
        skippedOptOut++;
        continue;
      }

      // Per per-pet-walk-goal spec: threshold = primary pet's goal.
      // Pet lookup happens BEFORE the threshold check now (it used to
      // run after, gated on the user not having hit the hardcoded 30)
      // because each user's threshold depends on their own pet's
      // walkGoal. The extra read fan-out is one getDocs per user with
      // FCM tokens that hasn't opted out — still trivial at our scale.
      // Multi-pet user: we deliberately use the *primary* pet's goal
      // only (avoid sending N pushes — one per pet — and overwhelming
      // the user). Per-pet pushes are out of scope per spec.
      const petsSnap = await db
        .collection("pets")
        .where("ownerUid", "==", uid)
        .get();
      if (petsSnap.empty) {
        skippedNoPet++;
        continue;
      }
      const earliestPet = petsSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .sort((a, b) => {
          const ax = (a.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
          const bx = (b.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
          return ax - bx;
        })[0];
      const petName = (earliestPet?.name as string) || "Pet";
      const goalMin = getPetWalkGoalMinutes(earliestPet);

      const todayMin = minutesByUid.get(uid) ?? 0;
      if (todayMin >= goalMin) {
        skippedAlreadyHit++;
        continue;
      }

      const copy = pushCopy(
        u.locale as string | undefined,
        { petName, goalMin },
        { title: "晚上遛狗提醒", body: "{petName} 今天還沒走滿 {goalMin} 分鐘 🐶" },
        { title: "Time to walk", body: "{petName} hasn't hit {goalMin} min today 🐶" },
      );

      try {
        const res = await sendEngagementPush({
          uid,
          tokens,
          body: copy,
          data: { type: EVENING_WALK_REMINDER_TYPE },
          link: "/app/walks",
        });
        if (res.ok) sent++;
        else failed++;
      } catch (err) {
        failed++;
        logger.error(
          `eveningWalkReminder: send failed for uid=${uid}`,
          err,
        );
      }
    }

    // Audit doc — flat path under engagementPushes/{type}/waves/{ISO}.
    const isoNow = now.toISOString();
    await db
      .doc(`engagementPushes/${EVENING_WALK_REMINDER_TYPE}/waves/${isoNow}`)
      .set({
        type: EVENING_WALK_REMINDER_TYPE,
        ranAt: Timestamp.now(),
        sentCount: sent,
        failedCount: failed,
        skippedNoToken,
        skippedOptOut,
        skippedAlreadyHit,
        skippedNoPet,
        userCount: usersSnap.size,
      });

    logger.info(
      `eveningWalkReminder done — sent=${sent} failed=${failed} ` +
        `optOut=${skippedOptOut} alreadyHit=${skippedAlreadyHit} ` +
        `noPet=${skippedNoPet} noToken=${skippedNoToken}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// streakBreakWarning — Phase 1.5 A2
// Cron 22:00 Asia/Taipei. For each user with streak ≥ 3 days (as of
// yesterday) AND zero walks today: nudge them with "你 X 天 streak
// 即將斷". Uses Taipei-aligned day buckets so a user walking at Taipei
// 23:00 still counts as "today" instead of leaking into the next UTC
// day.
// ─────────────────────────────────────────────────────────────────────

const STREAK_WARNING_TYPE = "streak-warning";
const STREAK_MIN_DAYS = 3;
/** Trailing window we pull walks from to compute streak. A 30-day
 *  window covers the longest realistic streak — users with 30+ day
 *  streaks are vanishingly rare and the worst-case wrong answer is
 *  "we under-counted your streak", which only ever makes the nudge
 *  LESS likely to fire. Cheap enough to not bother widening. */
const STREAK_LOOKBACK_DAYS = 30;

/** Day bucket aligned to Asia/Taipei wall-clock days. +08:00 offset
 *  is constant (no DST) so a simple shift works. */
function taipeiDayIdx(ms: number): number {
  return Math.floor((ms + 8 * 3_600_000) / 86_400_000);
}

/** Counts consecutive walk-days ending at `lastIdx` (inclusive), going
 *  backwards through the supplied set of day indices. Returns 0 if
 *  `lastIdx` itself isn't a walk-day — used by A2 to read "streak as
 *  of yesterday", which is 0 when the user didn't actually walk
 *  yesterday either. */
function streakEndingAt(lastIdx: number, walkDays: Set<number>): number {
  if (!walkDays.has(lastIdx)) return 0;
  let streak = 1;
  let day = lastIdx - 1;
  while (walkDays.has(day)) {
    streak++;
    day--;
  }
  return streak;
}

export const streakBreakWarning = onSchedule(
  {
    schedule: "0 22 * * *",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 1,
    memory: "256MiB",
  },
  async () => {
    const now = new Date();
    const todayIdx = taipeiDayIdx(now.getTime());
    const yesterdayIdx = todayIdx - 1;
    const since = new Date(
      now.getTime() - STREAK_LOOKBACK_DAYS * 86_400_000,
    );

    // Pre-aggregate walk days per uid — once per uid, regardless of
    // walk count. We index by Taipei day-bucket so per-user `walkDays`
    // sets feed both checks cleanly: "did they walk today?" and
    // "streak as of yesterday".
    const walksSnap = await db
      .collectionGroup("walks")
      .where("startedAt", ">=", Timestamp.fromMillis(since.getTime()))
      .get();
    const daysByUid = new Map<string, Set<number>>();
    for (const d of walksSnap.docs) {
      const w = d.data();
      const uid = (w.walkerUid as string) || (w.ownerUid as string);
      if (!uid) continue;
      const startedMs = (w.startedAt as Timestamp).toMillis();
      const idx = taipeiDayIdx(startedMs);
      let set = daysByUid.get(uid);
      if (!set) {
        set = new Set();
        daysByUid.set(uid, set);
      }
      set.add(idx);
    }

    const usersSnap = await db.collection("users").get();
    let sent = 0;
    let failed = 0;
    let skippedNoToken = 0;
    let skippedOptOut = 0;
    let skippedAlreadyWalkedToday = 0;
    let skippedShortStreak = 0;
    let skippedNoPet = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const u = userDoc.data();
      const tokens = ((u.fcmTokens ?? []) as string[]).filter(Boolean);
      if (tokens.length === 0) {
        skippedNoToken++;
        continue;
      }
      const optOut = (u.pushPrefs?.engagementOptOut ?? []) as string[];
      if (optOut.includes(STREAK_WARNING_TYPE)) {
        skippedOptOut++;
        continue;
      }
      const days = daysByUid.get(uid);
      if (days && days.has(todayIdx)) {
        // They've already walked today — streak isn't about to break.
        skippedAlreadyWalkedToday++;
        continue;
      }
      const streak = days ? streakEndingAt(yesterdayIdx, days) : 0;
      if (streak < STREAK_MIN_DAYS) {
        skippedShortStreak++;
        continue;
      }

      const petsSnap = await db
        .collection("pets")
        .where("ownerUid", "==", uid)
        .get();
      if (petsSnap.empty) {
        skippedNoPet++;
        continue;
      }
      const earliestPet = petsSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .sort((a, b) => {
          const ax = (a.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
          const bx = (b.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
          return ax - bx;
        })[0];
      const petName = (earliestPet?.name as string) || "Pet";

      const copy = pushCopy(
        u.locale as string | undefined,
        { petName, streak },
        {
          title: "別斷掉 streak 🔥",
          body: "再不遛 {petName} 就斷 {streak} 天紀錄了",
        },
        {
          title: "Don't break your streak 🔥",
          body: "Walk {petName} now or lose your {streak}-day streak",
        },
      );

      try {
        const res = await sendEngagementPush({
          uid,
          tokens,
          body: copy,
          data: { type: STREAK_WARNING_TYPE, streak: String(streak) },
          link: "/app/walks",
        });
        if (res.ok) sent++;
        else failed++;
      } catch (err) {
        failed++;
        logger.error(`streakBreakWarning: send failed for uid=${uid}`, err);
      }
    }

    const isoNow = now.toISOString();
    await db
      .doc(`engagementPushes/${STREAK_WARNING_TYPE}/waves/${isoNow}`)
      .set({
        type: STREAK_WARNING_TYPE,
        ranAt: Timestamp.now(),
        sentCount: sent,
        failedCount: failed,
        skippedNoToken,
        skippedOptOut,
        skippedAlreadyWalkedToday,
        skippedShortStreak,
        skippedNoPet,
        userCount: usersSnap.size,
      });

    logger.info(
      `streakBreakWarning done — sent=${sent} failed=${failed} ` +
        `optOut=${skippedOptOut} walkedToday=${skippedAlreadyWalkedToday} ` +
        `shortStreak=${skippedShortStreak} noPet=${skippedNoPet} ` +
        `noToken=${skippedNoToken}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// familyGoalMilestone — Phase 2.5 B2
// onCreate(walks/{walkId}) trigger. When the walking user's today
// minutes first crosses the 30-min daily goal AND they're in a
// multi-member family, push a 🎉 to every OTHER family member.
// Dedupe: userDailyStats/{uid}_{YYYY-MM-DD}.goalHitNotifiedAt — set
// inside a transaction so a flurry of walks racing across the threshold
// only ever fires one push wave.
// ─────────────────────────────────────────────────────────────────────

const FAMILY_MILESTONE_TYPE = "family-milestone";
// FAMILY_MILESTONE_GOAL_MIN constant removed per per-pet-walk-goal
// spec — threshold now reads from the walker's primary pet's
// walkGoal via getPetWalkGoalMinutes(). Multi-pet walker still uses
// only the primary pet's goal (avoid N pushes per walk).

/** YYYY-MM-DD in Asia/Taipei wall-clock. Used as the daily-stats doc
 *  id suffix; matches the Hero "today" semantics walk-tracking.ts uses
 *  on the client. */
function taipeiDateStamp(now: Date): string {
  const TPE_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taipei = new Date(now.getTime() + TPE_OFFSET_MS);
  // toISOString gives a UTC YYYY-MM-DD; after the offset shift, the
  // UTC date matches the Taipei wall-clock date.
  return taipei.toISOString().slice(0, 10);
}

export const familyGoalMilestone = onDocumentCreated(
  {
    document: "walks/{walkId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const walk = event.data?.data();
    if (!walk) return;
    const achieverUid = (walk.walkerUid as string) || (walk.ownerUid as string);
    if (!achieverUid) return;
    const familyId = walk.familyId as string | null | undefined;
    // Spec: skip personal-mode walks outright (no family to notify).
    if (!familyId) return;

    // 1. Pet lookup BEFORE today's minutes — per per-pet-walk-goal
    //    spec, threshold depends on the walker's primary pet's
    //    walkGoal. Multi-pet walker still uses only the primary pet's
    //    goal (avoid N pushes per walk).
    const petsSnap = await db
      .collection("pets")
      .where("ownerUid", "==", achieverUid)
      .get();
    const earliestPet = petsSnap.empty
      ? null
      : petsSnap.docs
          .map((d) => d.data() as Record<string, unknown>)
          .sort((a, b) => {
            const ax =
              (a.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
            const bx =
              (b.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
            return ax - bx;
          })[0];
    const petName = (earliestPet?.name as string) || "Pet";
    const goalMin = getPetWalkGoalMinutes(earliestPet);

    // 2. Sum today's minutes for this user across all walks. Done
    //    inside the trigger so we know whether the just-written walk
    //    is the one that crossed the line.
    const now = new Date();
    const startOfToday = startOfTaipeiDay(now);
    const todaysWalksSnap = await db
      .collection("walks")
      .where("walkerUid", "==", achieverUid)
      .where("startedAt", ">=", Timestamp.fromMillis(startOfToday.getTime()))
      .get();
    let todayMin = 0;
    for (const d of todaysWalksSnap.docs) {
      todayMin += Number(d.data().durationMin) || 0;
    }
    if (todayMin < goalMin) return;

    // 3. Family membership lookup — bail if we're the only member.
    const famSnap = await db.doc(`families/${familyId}`).get();
    if (!famSnap.exists) return;
    const memberUids =
      ((famSnap.data()?.memberUids ?? []) as string[]).filter(Boolean);
    const recipients = memberUids.filter((m) => m !== achieverUid);
    if (recipients.length === 0) return;

    // 4. Dedupe in a transaction — first writer wins, everyone else
    //    bails before sending push. Doc id format matches the spec
    //    (`{uid}_{YYYY-MM-DD}`) so a daily-stats client read is one
    //    getDoc by id.
    const statId = `${achieverUid}_${taipeiDateStamp(now)}`;
    const statRef = db.doc(`userDailyStats/${statId}`);
    const claimed = await db.runTransaction(async (tx) => {
      const s = await tx.get(statRef);
      if (s.exists && s.data()?.goalHitNotifiedAt) return false;
      tx.set(
        statRef,
        { goalHitNotifiedAt: Timestamp.now(), achieverUid },
        { merge: true },
      );
      return true;
    });
    if (!claimed) return;

    // 5. Achiever profile (display name) — pet already loaded above.
    const achieverDoc = await db.doc(`users/${achieverUid}`).get();
    const achieverName =
      (achieverDoc.data()?.displayName as string | undefined) || "Someone";

    // 5. Push to each recipient (with per-recipient opt-out + token
    //    cleanup).
    let sent = 0;
    let failed = 0;
    let skippedNoToken = 0;
    let skippedOptOut = 0;
    const sentTo: string[] = [];

    for (const recipientUid of recipients) {
      const rDoc = await db.doc(`users/${recipientUid}`).get();
      if (!rDoc.exists) continue;
      const r = rDoc.data() ?? {};
      const tokens = ((r.fcmTokens ?? []) as string[]).filter(Boolean);
      if (tokens.length === 0) {
        skippedNoToken++;
        continue;
      }
      const optOut = (r.pushPrefs?.engagementOptOut ?? []) as string[];
      if (optOut.includes(FAMILY_MILESTONE_TYPE)) {
        skippedOptOut++;
        continue;
      }
      const copy = pushCopy(
        r.locale as string | undefined,
        { achieverName, petName },
        {
          title: "家人達成今日目標 🎉",
          body: "{achieverName} 完成 {petName} 今日目標了",
        },
        {
          title: "Family hit today's goal 🎉",
          body: "{achieverName} just hit today's goal for {petName}",
        },
      );
      try {
        const res = await sendEngagementPush({
          uid: recipientUid,
          tokens,
          body: copy,
          data: {
            type: FAMILY_MILESTONE_TYPE,
            achieverUid,
            familyId,
          },
          link: "/app/leaderboard",
        });
        if (res.ok) {
          sent++;
          sentTo.push(recipientUid);
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        logger.error(
          `familyGoalMilestone: send failed for recipient=${recipientUid}`,
          err,
        );
      }
    }

    const isoNow = now.toISOString();
    await db
      .doc(`engagementPushes/${FAMILY_MILESTONE_TYPE}/waves/${isoNow}`)
      .set({
        type: FAMILY_MILESTONE_TYPE,
        ranAt: Timestamp.now(),
        achieverUid,
        familyId,
        recipientCount: recipients.length,
        sentTo,
        sentCount: sent,
        failedCount: failed,
        skippedNoToken,
        skippedOptOut,
      });

    logger.info(
      `familyGoalMilestone done — achiever=${achieverUid} family=${familyId} ` +
        `recipients=${recipients.length} sent=${sent} failed=${failed} ` +
        `optOut=${skippedOptOut} noToken=${skippedNoToken}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// autoFriendFamilyMembers — onWrite(families/{familyId})
// Spec: docs/features/auto-friend-family-members.md
//
// When a new uid lands in family.memberUids (joinFamilyByCode /
// addFamilyMember), batch-create mutual friendships between the
// new member and every other existing member. Idempotent via the
// createMutualFriendship helper — repeated trigger fires (Eventarc
// at-least-once delivery) write the same docs and the audit log
// counts every fire so we can spot abuse / runaway loops.
//
// Member removal is INTENTIONALLY a no-op (spec D1 — friendships
// outlive family membership; social and family lifecycles decoupled).
// Bail before any reads if the delta is empty or shrinking.
// ─────────────────────────────────────────────────────────────────────

export const autoFriendFamilyMembers = onDocumentWritten(
  {
    document: "families/{familyId}",
    region: FUNCTION_REGION,
    retry: false,
    memory: "256MiB",
  },
  async (event) => {
    const familyId = event.params.familyId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    // Doc deleted entirely — no friendships to create.
    if (!after) return;

    const beforeMembers = new Set<string>(
      Array.isArray(before?.memberUids) ? (before!.memberUids as string[]) : [],
    );
    const afterMembers = ((after.memberUids ?? []) as string[]).filter(Boolean);

    const newMembers = afterMembers.filter((uid) => !beforeMembers.has(uid));
    if (newMembers.length === 0) {
      // Membership shrunk, or some other field changed (name, inviteCode).
      // Either way, nothing to do — spec D1 keeps friendships on removal.
      return;
    }

    // Build the work-list: every (newMember, otherMember) pair, where
    // "otherMember" is any other final-state member (this also covers
    // new ↔ new when N people are added in one write). Deduplicate by
    // sorted pairId so we don't issue the same write twice when both
    // sides of a pair are new.
    const newMemberSet = new Set(newMembers);
    const pairsToTry = new Map<string, [string, string]>();
    for (const a of newMembers) {
      for (const b of afterMembers) {
        if (a === b) continue;
        // Skip (newA, newB) where newA > newB — the reciprocal pass
        // (newB, newA) would re-emit the same pairId. Comparing strings
        // breaks ties deterministically and keeps the audit log clean.
        if (newMemberSet.has(b) && a > b) continue;
        const id = pairId(a, b);
        if (!pairsToTry.has(id)) pairsToTry.set(id, [a, b]);
      }
    }

    let created = 0;
    let skippedExists = 0;
    let skippedSelf = 0;
    let skippedMissingProfile = 0;
    let failed = 0;
    const createdPairs: string[] = [];
    const skippedPairs: { pairId: string; reason: string }[] = [];

    for (const [id, [a, b]] of pairsToTry) {
      let result: CreateFriendshipResult;
      try {
        result = await createMutualFriendship(a, b, db);
      } catch (err) {
        failed++;
        logger.error(`autoFriendFamilyMembers: pair ${id} failed`, err);
        continue;
      }
      if (result.created) {
        created++;
        createdPairs.push(id);
      } else {
        if (result.reason === "exists") skippedExists++;
        else if (result.reason === "self") skippedSelf++;
        else if (result.reason === "missing-profile") skippedMissingProfile++;
        skippedPairs.push({ pairId: id, reason: result.reason ?? "unknown" });
      }
    }

    // Audit doc — one per trigger fire, keyed by {familyId}_{ISO} so
    // rapid back-to-back joins each leave a record. Mirrors the
    // engagementPushes/{type}/waves/{ISO} + realtimeLeaderboardUpdates
    // patterns; rules lock the collection to admin-only read/write.
    const isoNow = new Date().toISOString();
    await db.doc(`autoFriendEvents/${familyId}_${isoNow}`).set({
      familyId,
      ranAt: Timestamp.now(),
      newMembers,
      afterMemberCount: afterMembers.length,
      pairAttemptCount: pairsToTry.size,
      created,
      skippedExists,
      skippedSelf,
      skippedMissingProfile,
      failed,
      createdPairs,
      skippedPairs,
    });

    logger.info(
      `autoFriendFamilyMembers done — family=${familyId} ` +
        `new=${newMembers.length} attempted=${pairsToTry.size} ` +
        `created=${created} exists=${skippedExists} ` +
        `missingProfile=${skippedMissingProfile} failed=${failed}`,
    );
  },
);

// ═════════════════════════════════════════════════════════════════════
// gcAnonymousUsers — guest (anonymous-auth) account garbage collection
// Spec: docs/features/guest-login.md §F
//
// Anonymous accounts proliferate (one uid per device) and the ones that
// never upgrade leave orphan user/pets/walks/etc. behind — Firestore bloat
// + (already excluded from, but still scanned by) the leaderboard cron.
// This reaps anonymous Auth users that are BOTH:
//   - still anonymous (providerData empty → never linked/upgraded), and
//   - inactive for ≥ GC_INACTIVE_DAYS (by users/{uid}.lastSeenAt, falling
//     back to the Auth user's lastRefreshTime / creationTime).
// For each reaped user it hard-deletes their personal-mode data (pets +
// healthRecords, walks, reminders, expenses), the user doc, and the Auth
// user — the same scope deleteUserAccount covers, minus the community
// branches a guest can't have (no families / friends / posts / reactions /
// reviews — all blocked by rules).
//
// ⚠️ SHIPS IN DRY-RUN BY DEFAULT (GC_DRY_RUN = true): it logs + writes an
// audit doc listing exactly what it WOULD delete, but deletes nothing.
// Flip GC_DRY_RUN to false (separate reviewed commit) to arm it, after the
// first few dry-run audit docs confirm the candidate set looks right.
// Conservative N per spec (30–60d) → 60d.
// ═════════════════════════════════════════════════════════════════════

/** Inactivity threshold before an un-upgraded guest is eligible for GC.
 *  Conservative end of the spec's 30–60d range. */
const GC_INACTIVE_DAYS = 60;
/** Safety: when true, the GC only reports (audit + logs), never deletes.
 *  Ships true; flip to false in a separate commit once dry-run output is
 *  vetted. */
const GC_DRY_RUN = true;
/** Cap deletions per run so an unexpectedly large backlog can't blow the
 *  function timeout or rack up a surprise write bill in one pass. The next
 *  weekly run picks up the remainder. */
const GC_MAX_DELETES_PER_RUN = 500;

/** Hard-delete one guest's personal-mode data + user doc. Mirrors the
 *  relevant subset of deleteUserAccount (guests have no family/community
 *  data). Returns per-collection counts. No-op on `dryRun` (counts only).
 *  Idempotent: re-running after a partial failure just re-deletes whatever
 *  remains. */
async function reapGuestData(
  uid: string,
  dryRun: boolean,
): Promise<{ pets: number; walks: number; reminders: number; expenses: number; healthRecords: number }> {
  const counts = { pets: 0, walks: 0, reminders: 0, expenses: 0, healthRecords: 0 };

  // Pets the guest created (always personal-mode for a guest) + their
  // healthRecords subcollection.
  const petsSnap = await db.collection("pets").where("ownerUid", "==", uid).get();
  for (const petDoc of petsSnap.docs) {
    const hrSnap = await petDoc.ref.collection("healthRecords").get();
    counts.healthRecords += hrSnap.size;
    if (!dryRun && hrSnap.size > 0) {
      await deleteIdsInBatches(hrSnap.docs, (b, d) => b.delete(d.ref));
    }
  }
  counts.pets = petsSnap.size;
  if (!dryRun && petsSnap.size > 0) {
    await deleteIdsInBatches(petsSnap.docs, (b, d) => b.delete(d.ref));
  }

  // Top-level collections keyed by the guest's owner field.
  for (const [col, field] of [
    ["walks", "walkerUid"],
    ["reminders", "createdByUid"],
    ["expenses", "payerUid"],
  ] as const) {
    const snap = await db.collection(col).where(field, "==", uid).get();
    (counts as Record<string, number>)[col] = snap.size;
    if (!dryRun && snap.size > 0) {
      await deleteIdsInBatches(snap.docs, (b, d) => b.delete(d.ref));
    }
  }

  // User profile doc.
  if (!dryRun) {
    await db.doc(`users/${uid}`).delete().catch(() => {});
  }
  return counts;
}

export const gcAnonymousUsers = onSchedule(
  {
    // Weekly, Monday 03:30 Asia/Taipei — off-peak, low cadence (cost).
    schedule: "30 3 * * 1",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 0,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const nowMs = Date.now();
    const cutoffMs = nowMs - GC_INACTIVE_DAYS * 86_400_000;

    let scanned = 0;
    let anonymous = 0;
    let eligible = 0;
    let reaped = 0;
    let skippedActive = 0;
    let skippedUpgraded = 0;
    const reapedSample: Array<{ uid: string; lastActiveISO: string | null; counts: unknown }> = [];

    // Page through all Auth users. listUsers returns up to 1000/page.
    let pageToken: string | undefined = undefined;
    do {
      const page = await getAuth().listUsers(1000, pageToken);
      pageToken = page.pageToken;
      for (const u of page.users) {
        scanned++;
        // Anonymous = no linked providers. An upgraded ex-guest has ≥1
        // providerData entry → skip (their data is real now).
        if (u.providerData.length > 0) {
          skippedUpgraded++;
          continue;
        }
        anonymous++;

        // Determine last activity: prefer the Firestore profile's lastSeenAt
        // (app-level activity), fall back to Auth metadata.
        const profileSnap = await db.doc(`users/${u.uid}`).get();
        const p = profileSnap.data();
        // Defensive: if a non-guest profile somehow has no providers, don't
        // touch it (only reap docs that are absent or explicitly isGuest).
        if (p && p.isGuest !== true) {
          skippedUpgraded++;
          continue;
        }
        const lastSeenMs =
          (p?.lastSeenAt as Timestamp | undefined)?.toMillis?.() ??
          (u.metadata.lastRefreshTime
            ? new Date(u.metadata.lastRefreshTime).getTime()
            : new Date(u.metadata.creationTime).getTime());

        if (lastSeenMs > cutoffMs) {
          skippedActive++;
          continue;
        }
        eligible++;
        if (reaped >= GC_MAX_DELETES_PER_RUN) continue;

        const counts = await reapGuestData(u.uid, GC_DRY_RUN);
        if (!GC_DRY_RUN) {
          await getAuth().deleteUser(u.uid).catch((err) =>
            logger.error(`gcAnonymousUsers: auth delete failed uid=${u.uid}`, err),
          );
        }
        reaped++;
        if (reapedSample.length < 50) {
          reapedSample.push({
            uid: u.uid,
            lastActiveISO: new Date(lastSeenMs).toISOString(),
            counts,
          });
        }
      }
    } while (pageToken);

    const isoNow = new Date(nowMs).toISOString();
    await db.doc(`anonymousGc/${isoNow}`).set({
      ranAt: Timestamp.now(),
      dryRun: GC_DRY_RUN,
      inactiveDays: GC_INACTIVE_DAYS,
      cutoffISO: new Date(cutoffMs).toISOString(),
      scanned,
      anonymous,
      eligible,
      reaped,
      skippedActive,
      skippedUpgraded,
      cappedPerRun: GC_MAX_DELETES_PER_RUN,
      reapedSample,
    });

    logger.info(
      `gcAnonymousUsers done — dryRun=${GC_DRY_RUN} scanned=${scanned} ` +
        `anon=${anonymous} eligible=${eligible} reaped=${reaped} ` +
        `active=${skippedActive} upgraded=${skippedUpgraded}`,
    );
  },
);

// ═════════════════════════════════════════════════════════════════════
// backfillAchievements — one-shot admin callable
// Spec: docs/features/achievements-badges.md §F open-question #4 + task 7.
//
// Grants existing users the badges they ALREADY qualify for, so the
// achievements page isn't empty on launch. For each user: rebuild the
// lifetime stats doc from their walks (idempotent recompute), derive
// petCount / postCount / familyJoined / best ranks, then run the SAME
// evaluateAchievements path the live triggers use (so grants + the merged
// unlock push are identical to organic unlocks).
//
// Conservative ops posture (mirrors cleanupLegacyPaths / gcAnonymousUsers):
//   - admin custom claim required
//   - DRY-RUN by default — must pass { dryRun: false } to actually write
//   - optional { targetUid } to test on one user first
//   - audit doc achievementsBackfills/{ISO}
//   - dry-run does NOT send pushes (evaluate dryRun short-circuits before
//     any write/push)
// ═════════════════════════════════════════════════════════════════════

/** Recompute a user's lifetime stats doc from ALL their walks (family +
 *  personal). Idempotent — overwrites the doc with the derived truth. Used
 *  by the backfill; the live path maintains it incrementally instead. */
async function rebuildLifetimeStats(
  uid: string,
  write: boolean,
): Promise<{
  walkCount: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  currentStreak: number;
  longestStreak: number;
}> {
  const snap = await db.collection("walks").where("walkerUid", "==", uid).get();
  let walkCount = 0;
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  const dayIdxSet = new Set<number>();
  for (const d of snap.docs) {
    const w = d.data();
    walkCount += 1;
    totalDistanceKm += Number(w.distanceKm) || 0;
    totalDurationMin += Number(w.durationMin) || 0;
    const ms = (w.startedAt as Timestamp | undefined)?.toMillis?.();
    if (ms != null) dayIdxSet.add(taipeiDayIndexLocal(ms));
  }
  totalDistanceKm = Math.round(totalDistanceKm * 100) / 100;

  // Longest + current streak from the set of distinct walk-days.
  const days = Array.from(dayIdxSet).sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  let lastDay: number | null = null;
  for (const day of days) {
    if (lastDay != null && day === lastDay + 1) run += 1;
    else run = 1;
    if (run > longestStreak) longestStreak = run;
    lastDay = day;
  }
  // currentStreak = run ending at the most recent walk-day (today or
  // yesterday in Taipei, else broken → but we keep the trailing run length
  // for the doc; streak BADGES use longestStreak so this is informational).
  const todayIdx = taipeiDayIndexLocal(Date.now());
  let currentStreak = 0;
  if (lastDay != null && (lastDay === todayIdx || lastDay === todayIdx - 1)) {
    currentStreak = run;
  }

  if (write) {
    await db.doc(`users/${uid}/stats/lifetime`).set(
      {
        walkCount,
        totalDistanceKm,
        totalDurationMin,
        currentStreak,
        longestStreak,
        lastWalkDayIdx: lastDay ?? 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return { walkCount, totalDistanceKm, totalDurationMin, currentStreak, longestStreak };
}

/** Local copy of taipeiDayIndex (achievements.ts) — index.ts already has
 *  taipeiDayIdx but it's defined later in the file scope; reuse that one. */
function taipeiDayIndexLocal(ms: number): number {
  return taipeiDayIdx(ms);
}

export const backfillAchievements = onCall(
  {
    region: FUNCTION_REGION,
    cors: true,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (req) => {
    if (req.auth?.token?.admin !== true) {
      throw new HttpsError("permission-denied", "admin custom claim required");
    }
    const dryRun = req.data?.dryRun !== false; // default true
    const targetUid =
      (req.data?.targetUid as string | undefined)?.trim() || undefined;

    const weekKey = isoWeekLabel(new Date());
    const monthKey = monthLabel(new Date());

    // Precompute rank maps once (shared across all users).
    const [weeklyWalker, monthlyWalker, weeklyDog] = await Promise.all([
      db.collection(`leaderboards/${weekKey}/entries`).get(),
      db.collection(`leaderboards/${monthKey}/entries`).get(),
      db.collection(`dogLeaderboards/${weekKey}/entries`).get(),
    ]);
    const rankMap = (
      docs: FirebaseFirestore.QueryDocumentSnapshot[],
      ownerKey: (d: FirebaseFirestore.DocumentData) => string | undefined,
    ): Map<string, number> => {
      const rows = docs
        .map((d) => ({ uid: ownerKey(d.data()), score: Number(d.data().totalScore) || 0 }))
        .filter((r): r is { uid: string; score: number } => !!r.uid)
        .sort((a, b) => b.score - a.score);
      const out = new Map<string, number>();
      rows.forEach((r, i) => {
        const rank = i + 1;
        if (!out.has(r.uid) || rank < (out.get(r.uid) as number)) out.set(r.uid, rank);
      });
      return out;
    };
    const weeklyWalkerRanks = rankMap(weeklyWalker.docs, (d) => d.uid as string);
    const monthlyWalkerRanks = rankMap(monthlyWalker.docs, (d) => d.uid as string);
    const weeklyDogRanks = rankMap(weeklyDog.docs, (d) => d.ownerUid as string);

    const uids = targetUid
      ? [targetUid]
      : (await db.collection("users").get()).docs.map((d) => d.id);

    let processed = 0;
    let usersWithNewGrants = 0;
    let totalGranted = 0;
    const sample: Array<{ uid: string; granted: string[] }> = [];

    for (const uid of uids) {
      processed++;
      const userSnap = await db.doc(`users/${uid}`).get();
      const u = userSnap.data() ?? {};
      const isGuest = u.isGuest === true;

      const stats = await rebuildLifetimeStats(uid, !dryRun);

      const [petsSnap, postsSnap] = await Promise.all([
        db.collection("pets").where("ownerUid", "==", uid).get(),
        db.collection("posts").where("authorUid", "==", uid).get(),
      ]);
      const familyJoined =
        ((u.familyIds as string[] | undefined) ?? []).length > 0;

      const weeklyRank = (() => {
        const a = weeklyWalkerRanks.get(uid);
        const b = weeklyDogRanks.get(uid);
        if (a == null) return b;
        if (b == null) return a;
        return Math.min(a, b);
      })();

      const metrics: AchievementMetrics = {
        walkCount: stats.walkCount,
        totalDistanceKm: stats.totalDistanceKm,
        totalDurationMin: stats.totalDurationMin,
        longestStreak: stats.longestStreak,
        petCount: petsSnap.size,
        postCount: postsSnap.size,
        familyJoined,
        weeklyRank,
        monthlyRank: monthlyWalkerRanks.get(uid),
      };

      const res = await evaluateAchievements(db, uid, metrics, {
        isGuest,
        // Backfill stays silent — don't spam every existing user with a
        // push for badges they earned long ago.
        sendPush: undefined,
        dryRun,
      });
      if (res.newlyGranted.length > 0) {
        usersWithNewGrants++;
        totalGranted += res.newlyGranted.length;
        if (sample.length < 50) sample.push({ uid, granted: res.newlyGranted });
      }
    }

    const isoNow = new Date().toISOString();
    const summary = {
      ranAt: Timestamp.now(),
      dryRun,
      targetUid: targetUid ?? null,
      processed,
      usersWithNewGrants,
      totalGranted,
      sample,
    };
    if (!dryRun) {
      await db.doc(`achievementsBackfills/${isoNow}`).set(summary);
    }
    logger.info(
      `backfillAchievements done — dryRun=${dryRun} processed=${processed} ` +
        `usersWithNewGrants=${usersWithNewGrants} totalGranted=${totalGranted}`,
    );
    return {
      ok: true,
      dryRun,
      processed,
      usersWithNewGrants,
      totalGranted,
      sample,
    };
  },
);
