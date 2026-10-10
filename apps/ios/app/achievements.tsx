/**
 * Achievements — 1:1 with apps/web/src/app/app/achievements/page.tsx:
 * RouteHeader (back) → progress hero (brand ring around 🏆 + "已解鎖 x / y",
 * empty hint at 0) → guest hint (opens the upgrade sheet) → one section per
 * category (title, earned/total, 4pt bar, 2-column BadgeCard grid).
 *
 * Reads (allSettled, each degrades to its empty default like web): lifetime
 * stats, earned grants, pet / post counts (posts skipped for guests). Reloads
 * on focus (a badge granted after a walk shows up on return) and on
 * pull-to-refresh.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { Sparkles } from "lucide-react-native";
import type { AchievementGrant, LifetimeStats } from "@mango/shared-types";

import { RouteHeader } from "@/components/ui";
import { BadgeCard } from "@/components/achievements/badge-card";
import { useGuestUpgrade } from "@/components/auth/guest-upgrade";
import { withAlpha } from "@/components/auth/color";
import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import {
  getAchievementCounts,
  getLifetimeStats,
  groupAchievements,
  listEarnedAchievements,
} from "@/lib/achievements";
import { t } from "@/lib/i18n";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

const GRID_GAP = spacing.md;

function ProgressRing({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? value / max : 0;
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={68} height={68} viewBox="0 0 64 64" style={styles.ringSvg}>
        <Circle cx={32} cy={32} r={r} fill="none" stroke={colors.bgAlt} strokeWidth={6} />
        <Circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={colors.brand}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </Svg>
      <Text style={styles.trophy}>🏆</Text>
    </View>
  );
}

export default function AchievementsScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { families } = useFamily();
  const { openUpgrade } = useGuestUpgrade();
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [grants, setGrants] = useState<AchievementGrant[]>([]);
  const [counts, setCounts] = useState({ petCount: 0, postCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const [statsR, grantsR, countsR] = await Promise.allSettled([
      getLifetimeStats(user.uid),
      listEarnedAchievements(user.uid),
      getAchievementCounts(user.uid, { includePosts: !isGuest }),
    ]);
    setStats(statsR.status === "fulfilled" ? statsR.value : null);
    setGrants(grantsR.status === "fulfilled" ? grantsR.value : []);
    setCounts(countsR.status === "fulfilled" ? countsR.value : { petCount: 0, postCount: 0 });
    setLoading(false);
  }, [user, isGuest]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const { groups, totalEarned, total } = useMemo(() => {
    const grantMap = new Map(grants.map((g) => [g.achievementId, g]));
    return groupAchievements({
      isGuest,
      grants: grantMap,
      values: {
        lifetime: stats,
        petCount: counts.petCount,
        postCount: counts.postCount,
        familyJoined: families?.length ?? 0,
      },
    });
  }, [grants, stats, counts, families, isGuest]);

  const tile = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP) / 2) : 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.brand} />
        }
      >
        <RouteHeader title={t("Achievements.pageTitle")} onBack={() => router.back()} />

        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <View style={styles.stack}>
            {/* Progress hero (web: rounded-2xl border-brand/30 bg-card-soft p-5) */}
            <View style={styles.hero}>
              <ProgressRing value={totalEarned} max={total} />
              <View style={styles.heroText}>
                <Text style={styles.heroTitle} accessibilityRole="header">
                  {t("Achievements.summary", { earned: totalEarned, total })}
                </Text>
                {totalEarned === 0 ? (
                  <Text style={styles.heroHint}>{t("Achievements.emptyHint")}</Text>
                ) : null}
              </View>
            </View>

            {isGuest ? (
              <Pressable
                onPress={openUpgrade}
                accessibilityRole="button"
                style={({ pressed }) => [styles.guestHint, pressed && styles.guestHintPressed]}
              >
                <Sparkles size={20} color={colors.brandDeep} strokeWidth={2} style={styles.guestIcon} />
                <Text style={styles.guestText}>{t("Achievements.guestHint")}</Text>
              </Pressable>
            ) : null}

            {groups.map((g) => (
              <View key={g.category}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle} accessibilityRole="header">
                      {t(`Achievements.categories.${g.category}`)}
                    </Text>
                    <Text style={styles.sectionCount}>{`${g.earnedCount}/${g.badges.length}`}</Text>
                  </View>
                  <View style={styles.bar}>
                    <View
                      style={[styles.barFill, { width: `${(g.earnedCount / g.badges.length) * 100}%` }]}
                    />
                  </View>
                </View>
                <View
                  style={styles.grid}
                  onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}
                >
                  {tile > 0
                    ? g.badges.map((b) => (
                        <BadgeCard
                          key={b.achievement.id}
                          state={b}
                          onUpgrade={openUpgrade}
                          style={{ width: tile }}
                        />
                      ))
                    : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  loading: { marginTop: spacing.xl },
  // web: flex flex-col gap-8
  stack: { gap: spacing.xxl },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.3),
    backgroundColor: colors.cardSoft,
  },
  ring: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  ringSvg: { position: "absolute", transform: [{ rotate: "-90deg" }] },
  trophy: { fontSize: 24 },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, color: colors.ink },
  heroHint: { marginTop: 2, fontSize: 14, fontWeight: "500", lineHeight: 20, color: colors.ink2 },
  // web: flex items-start gap-3 rounded-lg border-brand/40 bg-brand-tint/50 p-4
  guestHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.4),
    backgroundColor: withAlpha(colors.brandTint, 0.5),
  },
  guestHintPressed: { borderColor: withAlpha(colors.brand, 0.6) },
  guestIcon: { marginTop: 2 },
  guestText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  sectionHead: { marginBottom: spacing.md },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  sectionCount: { fontSize: 12, fontWeight: "600", color: colors.ink2, fontVariant: ["tabular-nums"] },
  bar: {
    marginTop: spacing.sm,
    height: 4,
    width: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: radius.pill, backgroundColor: withAlpha(colors.brand, 0.7) },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
});
