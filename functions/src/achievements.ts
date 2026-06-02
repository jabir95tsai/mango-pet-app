/**
 * Achievements / badges — Cloud Functions side.
 * Spec: docs/features/achievements-badges.md
 *
 * The functions package can't import the @mango/shared-types workspace
 * package (standalone CommonJS build), so the badge catalogue is mirrored
 * here. ⚠️ KEEP IN SYNC with packages/shared-types/src/index.ts ACHIEVEMENTS.
 *
 * Central evaluator `evaluateAchievements` is idempotent + re-entrant: it
 * reads the user's lifetime stats + already-granted set, finds newly-met
 * badges, writes the grant docs once, and sends ONE merged unlock push.
 * Mounted on walk/pets/post onCreate + family join + the leaderboard cron.
 */

import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

export type AchievementMetric =
  | "walkCount"
  | "totalDistanceKm"
  | "totalDurationMin"
  | "longestStreak"
  | "petCount"
  | "familyJoined"
  | "postCount"
  | "singlePostReactions"
  | "leaderboardRank";

export type AchievementDef = {
  id: string;
  category: string;
  emoji: string;
  metric: AchievementMetric;
  threshold: number;
  rankPeriod?: "weekly" | "monthly";
  guest: boolean;
};

/** Mirror of packages/shared-types ACHIEVEMENTS (v1, 26 badges). */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "walk-1", category: "walks", emoji: "🐾", metric: "walkCount", threshold: 1, guest: true },
  { id: "walk-10", category: "walks", emoji: "🦴", metric: "walkCount", threshold: 10, guest: true },
  { id: "walk-50", category: "walks", emoji: "🦮", metric: "walkCount", threshold: 50, guest: true },
  { id: "walk-100", category: "walks", emoji: "🏅", metric: "walkCount", threshold: 100, guest: true },
  { id: "walk-365", category: "walks", emoji: "🏆", metric: "walkCount", threshold: 365, guest: true },
  { id: "streak-3", category: "streak", emoji: "🔥", metric: "longestStreak", threshold: 3, guest: true },
  { id: "streak-7", category: "streak", emoji: "🔥", metric: "longestStreak", threshold: 7, guest: true },
  { id: "streak-14", category: "streak", emoji: "🔥", metric: "longestStreak", threshold: 14, guest: true },
  { id: "streak-30", category: "streak", emoji: "🔥", metric: "longestStreak", threshold: 30, guest: true },
  { id: "streak-100", category: "streak", emoji: "💯", metric: "longestStreak", threshold: 100, guest: true },
  { id: "dist-5", category: "distance", emoji: "📏", metric: "totalDistanceKm", threshold: 5, guest: true },
  { id: "dist-25", category: "distance", emoji: "📏", metric: "totalDistanceKm", threshold: 25, guest: true },
  { id: "dist-50", category: "distance", emoji: "🥾", metric: "totalDistanceKm", threshold: 50, guest: true },
  { id: "dist-100", category: "distance", emoji: "🗺️", metric: "totalDistanceKm", threshold: 100, guest: true },
  { id: "dist-250", category: "distance", emoji: "🌍", metric: "totalDistanceKm", threshold: 250, guest: true },
  { id: "time-600", category: "duration", emoji: "⏱️", metric: "totalDurationMin", threshold: 600, guest: true },
  { id: "time-3000", category: "duration", emoji: "⏱️", metric: "totalDurationMin", threshold: 3000, guest: true },
  { id: "pet-1", category: "pets", emoji: "🐶", metric: "petCount", threshold: 1, guest: true },
  { id: "pet-3", category: "pets", emoji: "🏠", metric: "petCount", threshold: 3, guest: true },
  { id: "family-join", category: "family", emoji: "👨‍👩‍👧", metric: "familyJoined", threshold: 1, guest: false },
  { id: "post-1", category: "social", emoji: "📸", metric: "postCount", threshold: 1, guest: false },
  { id: "post-10", category: "social", emoji: "✍️", metric: "postCount", threshold: 10, guest: false },
  { id: "react-10", category: "social", emoji: "❤️", metric: "singlePostReactions", threshold: 10, guest: false },
  { id: "rank-top10", category: "rank", emoji: "📊", metric: "leaderboardRank", threshold: 10, rankPeriod: "weekly", guest: false },
  { id: "rank-1-week", category: "rank", emoji: "👑", metric: "leaderboardRank", threshold: 1, rankPeriod: "weekly", guest: false },
  { id: "rank-1-month", category: "rank", emoji: "🏆", metric: "leaderboardRank", threshold: 1, rankPeriod: "monthly", guest: false },
];

/** zh-TW / en titles for unlock-push copy. Mirrors the spec §D table; the
 *  client renders its own i18n from `Achievements.{id}.title`, this bank is
 *  only for the server-sent push notification body. */
export const ACHIEVEMENT_TITLES: Record<string, { zh: string; en: string }> = {
  "walk-1": { zh: "初次遛狗", en: "First Walk" },
  "walk-10": { zh: "遛狗新手", en: "Getting Started" },
  "walk-50": { zh: "遛狗達人", en: "Walk Pro" },
  "walk-100": { zh: "遛狗大師", en: "Walk Master" },
  "walk-365": { zh: "遛狗傳奇", en: "Walk Legend" },
  "streak-3": { zh: "三日有恆", en: "3-Day Streak" },
  "streak-7": { zh: "一週不輟", en: "Week Warrior" },
  "streak-14": { zh: "雙週堅持", en: "Two Weeks Strong" },
  "streak-30": { zh: "月度堅持", en: "Monthly Devotion" },
  "streak-100": { zh: "百日不間斷", en: "Century Streak" },
  "dist-5": { zh: "暖身 5 公里", en: "5 km" },
  "dist-25": { zh: "25 公里", en: "25 km" },
  "dist-50": { zh: "50 公里", en: "50 km" },
  "dist-100": { zh: "百里之行", en: "100 km" },
  "dist-250": { zh: "250 公里", en: "250 km" },
  "time-600": { zh: "遛滿 10 小時", en: "10 Hours" },
  "time-3000": { zh: "遛滿 50 小時", en: "50 Hours" },
  "pet-1": { zh: "第一隻毛孩", en: "First Pet" },
  "pet-3": { zh: "多寵之家", en: "Full House" },
  "family-join": { zh: "加入家庭", en: "Family Member" },
  "post-1": { zh: "第一篇動態", en: "First Post" },
  "post-10": { zh: "動態達人", en: "Storyteller" },
  "react-10": { zh: "廣受歡迎", en: "Crowd Pleaser" },
  "rank-top10": { zh: "登上排行榜", en: "On the Board" },
  "rank-1-week": { zh: "週榜第一", en: "Weekly Champion" },
  "rank-1-month": { zh: "月榜第一", en: "Monthly Champion" },
};

/** The metric values evaluateAchievements compares against thresholds.
 *  Callers supply only the metrics relevant to the trigger (e.g. the walk
 *  trigger passes walk/distance/duration/streak; pets trigger passes
 *  petCount). Absent metrics are simply never matched this pass — a later
 *  trigger (or the backfill) catches them. `leaderboardRank` is special:
 *  it's the BEST (lowest) rank achieved this evaluation, per rankPeriod. */
export type AchievementMetrics = {
  walkCount?: number;
  totalDistanceKm?: number;
  totalDurationMin?: number;
  longestStreak?: number;
  petCount?: number;
  familyJoined?: boolean;
  postCount?: number;
  singlePostReactions?: number;
  /** Best (lowest) weekly rank the user currently holds, if any. */
  weeklyRank?: number;
  /** Best (lowest) monthly rank the user currently holds, if any. */
  monthlyRank?: number;
};

function metricValue(
  def: AchievementDef,
  m: AchievementMetrics,
): number | undefined {
  switch (def.metric) {
    case "walkCount": return m.walkCount;
    case "totalDistanceKm": return m.totalDistanceKm;
    case "totalDurationMin": return m.totalDurationMin;
    case "longestStreak": return m.longestStreak;
    case "petCount": return m.petCount;
    case "postCount": return m.postCount;
    case "singlePostReactions": return m.singlePostReactions;
    case "familyJoined": return m.familyJoined ? 1 : undefined;
    case "leaderboardRank":
      return def.rankPeriod === "monthly" ? m.monthlyRank : m.weeklyRank;
  }
}

/** Does the supplied metric meet this badge's threshold? Rank badges invert
 *  (earned when rank <= threshold); everything else is value >= threshold. */
function isMet(def: AchievementDef, m: AchievementMetrics): boolean {
  const v = metricValue(def, m);
  if (v == null) return false;
  if (def.metric === "leaderboardRank") return v <= def.threshold;
  return v >= def.threshold;
}

export type EvaluateResult = {
  /** Newly-granted badge ids this pass (empty if nothing new). */
  newlyGranted: string[];
};

/** Hook signature for sending the merged unlock push. Injected so this
 *  module doesn't depend on the messaging singletons in index.ts. */
export type UnlockPushFn = (
  uid: string,
  newBadges: AchievementDef[],
) => Promise<void>;

/**
 * Central evaluator. Idempotent + re-entrant:
 *  1. honour guest gating (anonymous users skip non-guest badges),
 *  2. read already-granted ids,
 *  3. grant any newly-met badge (writes the doc once, merge-guarded),
 *  4. send ONE merged unlock push for the batch.
 *
 * Safe to call from multiple triggers for the same metric change — the
 * already-granted read + per-doc create:false-on-exists guard means a badge
 * is never double-written or double-pushed.
 */
export async function evaluateAchievements(
  db: Firestore,
  uid: string,
  metrics: AchievementMetrics,
  opts: { isGuest: boolean; sendPush?: UnlockPushFn; dryRun?: boolean },
): Promise<EvaluateResult> {
  // Candidate badges: those whose threshold is met AND (not guest-gated OR
  // the badge is guest-eligible).
  const candidates = ACHIEVEMENTS.filter(
    (def) => (!opts.isGuest || def.guest) && isMet(def, metrics),
  );
  if (candidates.length === 0) return { newlyGranted: [] };

  // Already-granted set.
  const grantedSnap = await db
    .collection(`users/${uid}/achievements`)
    .get();
  const already = new Set(grantedSnap.docs.map((d) => d.id));

  const fresh = candidates.filter((def) => !already.has(def.id));
  if (fresh.length === 0) return { newlyGranted: [] };

  if (opts.dryRun) {
    logger.info(
      `evaluateAchievements[dryRun]: uid=${uid} would grant ${fresh.map((f) => f.id).join(",")}`,
    );
    return { newlyGranted: fresh.map((f) => f.id) };
  }

  // Grant each via a transaction so a concurrent trigger evaluating the
  // same uid can't double-create (create only if absent).
  const granted: AchievementDef[] = [];
  const now = Timestamp.now();
  for (const def of fresh) {
    const ref = db.doc(`users/${uid}/achievements/${def.id}`);
    try {
      const didCreate = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        const snapshot = metricValue(def, metrics);
        tx.set(ref, {
          achievementId: def.id,
          earnedAt: now,
          ...(snapshot != null ? { progressSnapshot: snapshot } : {}),
        });
        return true;
      });
      if (didCreate) granted.push(def);
    } catch (err) {
      logger.error(`evaluateAchievements: grant failed uid=${uid} id=${def.id}`, err);
    }
  }

  if (granted.length > 0 && opts.sendPush) {
    try {
      await opts.sendPush(uid, granted);
    } catch (err) {
      logger.error(`evaluateAchievements: unlock push failed uid=${uid}`, err);
    }
  }

  logger.info(
    `evaluateAchievements: uid=${uid} granted=${granted.map((g) => g.id).join(",") || "(none)"}`,
  );
  return { newlyGranted: granted.map((g) => g.id) };
}

/** Taipei day-index (no DST → fixed +08:00). Mirrors taipeiDayIdx in
 *  index.ts; duplicated to keep this module standalone. */
export function taipeiDayIndex(ms: number): number {
  return Math.floor((ms + 8 * 3_600_000) / 86_400_000);
}

/** Incrementally fold one new walk into the lifetime stats doc inside a
 *  transaction, returning the post-update stats. O(1) streak update:
 *  same day → no streak change; next day → +1; gap → reset to 1.
 *  longestStreak is monotonic. Stats doc: users/{uid}/stats/lifetime. */
export async function applyWalkToLifetimeStats(
  db: Firestore,
  uid: string,
  walk: { distanceKm: number; durationMin: number; startedAtMs: number },
): Promise<{
  walkCount: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  currentStreak: number;
  longestStreak: number;
}> {
  const ref = db.doc(`users/${uid}/stats/lifetime`);
  const dayIdx = taipeiDayIndex(walk.startedAtMs);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.data() ?? {};
    const prevCount = Number(prev.walkCount) || 0;
    const prevDist = Number(prev.totalDistanceKm) || 0;
    const prevDur = Number(prev.totalDurationMin) || 0;
    const prevCurrent = Number(prev.currentStreak) || 0;
    const prevLongest = Number(prev.longestStreak) || 0;
    const prevDayIdx =
      prev.lastWalkDayIdx != null ? Number(prev.lastWalkDayIdx) : null;

    let currentStreak: number;
    if (prevDayIdx == null) {
      currentStreak = 1;
    } else if (dayIdx === prevDayIdx) {
      currentStreak = prevCurrent || 1; // same day, streak unchanged
    } else if (dayIdx === prevDayIdx + 1) {
      currentStreak = prevCurrent + 1; // consecutive day
    } else if (dayIdx > prevDayIdx + 1) {
      currentStreak = 1; // gap → reset
    } else {
      // Out-of-order (backdated walk earlier than last seen) — don't regress
      // the streak; keep current. Rare; manual/edited walks.
      currentStreak = prevCurrent || 1;
    }
    // lastWalkDayIdx only advances forward (ignore backdated walks for the
    // streak anchor, but still count them in totals).
    const nextDayIdx = prevDayIdx == null ? dayIdx : Math.max(prevDayIdx, dayIdx);
    const longestStreak = Math.max(prevLongest, currentStreak);

    const next = {
      walkCount: prevCount + 1,
      totalDistanceKm:
        Math.round((prevDist + (Number(walk.distanceKm) || 0)) * 100) / 100,
      totalDurationMin: prevDur + (Number(walk.durationMin) || 0),
      currentStreak,
      longestStreak,
      lastWalkDayIdx: nextDayIdx,
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, next, { merge: true });
    return {
      walkCount: next.walkCount,
      totalDistanceKm: next.totalDistanceKm,
      totalDurationMin: next.totalDurationMin,
      currentStreak,
      longestStreak,
    };
  });
}
