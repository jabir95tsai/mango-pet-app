/**
 * Achievements — iOS port of apps/web/src/lib/achievements.ts (pure badge
 * logic, copied verbatim) + apps/web/src/lib/firebase/achievements.ts (the
 * three reads, on RN Firebase). Grants are written only by Cloud Functions;
 * the client only reads. Rules already let the owner read both subcollections.
 *
 * TODO(shared): the pure helpers belong in packages/shared-business once web
 * imports them from there too.
 */
import firestore from "@react-native-firebase/firestore";
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementCategory,
  type AchievementGrant,
  type AchievementMetric,
  type LifetimeStats,
} from "@mango/shared-types";

import { getActiveLocale } from "./i18n";

// ── Pure badge logic (web parity) ─────────────────────────────────────────

/** Display order of the badge category sections. */
export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  "walks",
  "streak",
  "distance",
  "duration",
  "pets",
  "family",
  "social",
  "rank",
];

export type AchievementMetricValues = {
  lifetime: LifetimeStats | null;
  petCount: number;
  postCount: number;
  /** Number of families the user belongs to. */
  familyJoined: number;
};

/** Current value for a metric, or null when only the server can evaluate it
 *  (singlePostReactions / leaderboardRank → earned vs not, no progress bar). */
export function metricValue(metric: AchievementMetric, v: AchievementMetricValues): number | null {
  switch (metric) {
    case "walkCount":
      return v.lifetime?.walkCount ?? 0;
    case "totalDistanceKm":
      return v.lifetime?.totalDistanceKm ?? 0;
    case "totalDurationMin":
      return v.lifetime?.totalDurationMin ?? 0;
    case "longestStreak":
      return v.lifetime?.longestStreak ?? 0;
    case "petCount":
      return v.petCount;
    case "postCount":
      return v.postCount;
    case "familyJoined":
      return v.familyJoined;
    case "singlePostReactions":
    case "leaderboardRank":
      return null;
  }
}

type TimestampLike = { toMillis(): number };

export type BadgeState = {
  achievement: Achievement;
  earned: boolean;
  earnedAt: TimestampLike | null;
  /** A guest viewing a guest-locked (community / rank) badge. */
  locked: boolean;
  current: number | null;
  /** 0..1; 1 when earned; null when neither earned nor computable. */
  progress: number | null;
};

export function computeBadgeState(
  achievement: Achievement,
  opts: { isGuest: boolean; grants: Map<string, AchievementGrant>; values: AchievementMetricValues },
): BadgeState {
  const grant = opts.grants.get(achievement.id);
  const earned = !!grant;
  const locked = opts.isGuest && !achievement.guest;
  const live = metricValue(achievement.metric, opts.values);

  let progress: number | null;
  if (earned) progress = 1;
  else if (live == null) progress = null;
  else progress = Math.max(0, Math.min(1, live / achievement.threshold));

  return {
    achievement,
    earned,
    earnedAt: (grant?.earnedAt as unknown as TimestampLike | undefined) ?? null,
    locked,
    // Prefer the grant's snapshot for earned badges ("earned at 52 walks").
    current: earned ? (grant?.progressSnapshot ?? live) : live,
    progress,
  };
}

export type CategoryGroup = {
  category: AchievementCategory;
  badges: BadgeState[];
  earnedCount: number;
};

export function groupAchievements(opts: {
  isGuest: boolean;
  grants: Map<string, AchievementGrant>;
  values: AchievementMetricValues;
}): { groups: CategoryGroup[]; totalEarned: number; total: number } {
  const states = ACHIEVEMENTS.map((a) => computeBadgeState(a, opts));
  const byCat = new Map<AchievementCategory, BadgeState[]>();
  for (const s of states) {
    const list = byCat.get(s.achievement.category) ?? [];
    list.push(s);
    byCat.set(s.achievement.category, list);
  }
  const groups: CategoryGroup[] = [];
  for (const cat of ACHIEVEMENT_CATEGORY_ORDER) {
    const badges = byCat.get(cat);
    if (!badges || badges.length === 0) continue;
    groups.push({ category: cat, badges, earnedCount: badges.filter((b) => b.earned).length });
  }
  return {
    groups,
    totalEarned: states.filter((s) => s.earned).length,
    total: states.length,
  };
}

/** Integers stay clean (walks / minutes); distance trims to one decimal. */
export function formatMetricValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** web toLocaleDateString({ year, month: "short", day }) without relying on
 *  Hermes Intl: zh-TW "2026年6月2日", en "Jun 2, 2026". */
export function formatEarnedDate(ts: TimestampLike): string {
  const d = new Date(ts.toMillis());
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return getActiveLocale() === "en" ? `${EN_MONTHS[m]} ${day}, ${y}` : `${y}年${m + 1}月${day}日`;
}

// ── Reads (web lib/firebase/achievements.ts) ──────────────────────────────

/** users/{uid}/stats/lifetime — absent for a user who hasn't walked yet. */
export async function getLifetimeStats(uid: string): Promise<LifetimeStats | null> {
  const snap = await firestore()
    .collection("users")
    .doc(uid)
    .collection("stats")
    .doc("lifetime")
    .get();
  return snap.exists() ? (snap.data() as LifetimeStats) : null;
}

/** users/{uid}/achievements — one doc per earned badge (id = achievement id). */
export async function listEarnedAchievements(uid: string): Promise<AchievementGrant[]> {
  const snap = await firestore().collection("users").doc(uid).collection("achievements").get();
  return snap.docs.map((d) => d.data() as AchievementGrant);
}

/**
 * Live counts for metrics not in the lifetime doc (1 aggregation read each).
 * Pets are constrained to familyId == null — the only rules-allowed shape
 * (web note); posts are skipped for guests (social badges are guest-locked).
 */
export async function getAchievementCounts(
  uid: string,
  opts: { includePosts: boolean },
): Promise<{ petCount: number; postCount: number }> {
  const db = firestore();
  const petP = db
    .collection("pets")
    .where("ownerUid", "==", uid)
    .where("familyId", "==", null)
    .count()
    .get();
  const postP = opts.includePosts
    ? db.collection("posts").where("authorUid", "==", uid).count().get()
    : null;
  const [pets, posts] = await Promise.all([petP, postP]);
  return { petCount: pets.data().count, postCount: posts ? posts.data().count : 0 };
}
