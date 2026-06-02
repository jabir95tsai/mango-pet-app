import type { Timestamp } from "firebase/firestore";
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementCategory,
  type AchievementGrant,
  type AchievementMetric,
  type LifetimeStats,
} from "@/lib/types";

/** Display order of the badge category sections on the achievements page. */
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

/** Everything the client needs to compute live progress for un-earned
 *  badges. `lifetime` may be null for a user who hasn't walked yet. */
export type AchievementMetricValues = {
  lifetime: LifetimeStats | null;
  petCount: number;
  postCount: number;
  /** Number of families the user belongs to (familyIds.length). */
  familyJoined: number;
};

/** Current value for a metric, or `null` when it can't be computed on the
 *  client — `singlePostReactions` / `leaderboardRank` are evaluated and
 *  granted server-side, so for those we only ever show earned vs not (no
 *  live progress bar). Spec §D 資料來源備註 + Backend handoff #4. */
export function metricValue(
  metric: AchievementMetric,
  v: AchievementMetricValues,
): number | null {
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

export type BadgeState = {
  achievement: Achievement;
  earned: boolean;
  earnedAt: Timestamp | null;
  /** True when a guest views a guest-locked (community/rank) badge — render
   *  locked + an upgrade CTA, aligned with guest-login gating. */
  locked: boolean;
  /** Live metric value (for the "47/50" label); null when not computable. */
  current: number | null;
  /** 0..1 fill; 1 when earned; null when neither earned nor computable. */
  progress: number | null;
};

export function computeBadgeState(
  achievement: Achievement,
  opts: {
    isGuest: boolean;
    grants: Map<string, AchievementGrant>;
    values: AchievementMetricValues;
  },
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
    earnedAt: grant?.earnedAt ?? null,
    locked,
    // Prefer the grant's snapshot for earned badges ("earned at 52 walks").
    current: earned ? grant?.progressSnapshot ?? live : live,
    progress,
  };
}

export type CategoryGroup = {
  category: AchievementCategory;
  badges: BadgeState[];
  earnedCount: number;
};

/** Build the per-category sections (in display order) plus the headline
 *  earned/total counts. Categories with no badges are omitted. */
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
    groups.push({
      category: cat,
      badges,
      earnedCount: badges.filter((b) => b.earned).length,
    });
  }

  return {
    groups,
    totalEarned: states.filter((s) => s.earned).length,
    total: states.length,
  };
}

/** Compact value formatter for the progress label — keeps integers clean
 *  (walks/minutes) and trims distance to one decimal. */
export function formatMetricValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
