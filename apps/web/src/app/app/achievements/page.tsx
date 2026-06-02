"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { useGuestUpgrade } from "@/components/auth/guest-upgrade";
import { RouteHeader } from "@/components/nav/route-header";
import { BadgeCard } from "@/components/achievements/badge-card";
import {
  getAchievementCounts,
  getLifetimeStats,
  listEarnedAchievements,
} from "@/lib/firebase/achievements";
import { groupAchievements, type AchievementMetricValues } from "@/lib/achievements";
import type { AchievementGrant, LifetimeStats } from "@/lib/types";

export default function AchievementsPage() {
  const t = useTranslations("Achievements");
  const tCommon = useTranslations("Common");
  const { user, isGuest } = useAuth();
  const { families } = useFamily();
  const { openUpgrade } = useGuestUpgrade();

  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [grants, setGrants] = useState<AchievementGrant[]>([]);
  const [counts, setCounts] = useState({ petCount: 0, postCount: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // allSettled — a single failed read (e.g. no lifetime doc yet) must not
    // blank the whole page; each source degrades to its empty default.
    const [statsR, grantsR, countsR] = await Promise.allSettled([
      getLifetimeStats(user.uid),
      listEarnedAchievements(user.uid),
      // Guests can't earn social badges, so skip the posts count for them.
      getAchievementCounts(user.uid, { includePosts: !isGuest }),
    ]);
    setStats(statsR.status === "fulfilled" ? statsR.value : null);
    setGrants(grantsR.status === "fulfilled" ? grantsR.value : []);
    setCounts(
      countsR.status === "fulfilled"
        ? countsR.value
        : { petCount: 0, postCount: 0 },
    );
    setLoading(false);
  }, [user, isGuest]);

  useEffect(() => {
    load();
  }, [load]);

  const { groups, totalEarned, total } = useMemo(() => {
    const grantMap = new Map(grants.map((g) => [g.achievementId, g]));
    const values: AchievementMetricValues = {
      lifetime: stats,
      petCount: counts.petCount,
      postCount: counts.postCount,
      familyJoined: families?.length ?? 0,
    };
    return groupAchievements({ isGuest, grants: grantMap, values });
  }, [grants, stats, counts, families, isGuest]);

  return (
    <>
      <RouteHeader
        title={t("pageTitle")}
        subtitle={t("summary", { earned: totalEarned, total })}
      />

      {loading ? (
        <p className="text-sm text-zinc-500">{tCommon("loading")}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {isGuest && (
            <button
              type="button"
              onClick={openUpgrade}
              className="flex items-start gap-3 rounded-lg border border-mango-brand/40 bg-mango-brand-tint/50 p-4 text-left transition-colors hover:border-mango-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:bg-mango-brand/10"
            >
              <Sparkles className="mt-0.5 size-5 shrink-0 text-mango-brand-deep" />
              <span className="text-sm text-mango-ink-2">{t("guestHint")}</span>
            </button>
          )}

          {groups.map((g) => (
            <section key={g.category}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-mango-ink">
                  {t(`categories.${g.category}`)}
                </h2>
                <span className="shrink-0 text-xs font-medium tabular-nums text-mango-ink-3">
                  {g.earnedCount}/{g.badges.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {g.badges.map((b) => (
                  <BadgeCard
                    key={b.achievement.id}
                    state={b}
                    onUpgrade={openUpgrade}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
