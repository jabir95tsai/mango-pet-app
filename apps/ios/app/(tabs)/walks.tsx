/**
 * WalksHome — iOS parity of apps/web/src/app/app/walks/page.tsx (P1a core loop).
 * dial + week strip + walking dog + active-pet pill/picker + streak + sticky
 * 「開始遛狗」CTA → foreground GPS tracking → createWalk → leaderboard fires.
 *
 * Strings are inline zh-TW for P1a (shared-i18n not built yet — see ship note
 * handoff). Walk score / goal / GPS math all come from @mango/shared-business.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useWalksData } from "@/lib/use-walks-data";
import { WalksDial } from "@/components/walks/walks-dial";
import { WalksWeekStrip } from "@/components/walks/walks-week-strip";
import { PetPill } from "@/components/walks/pet-pill";
import { WalkRow } from "@/components/walks/walk-row";
import { WalkTrackingView } from "@/components/walks/walk-tracking-view";
import { ManualWalkDialog } from "@/components/walks/manual-walk-dialog";
import { colors, radius, spacing } from "@/theme/theme";

const WEEK_GOAL_COUNT = 5;
const RECENT_LIMIT = 5;

export default function WalksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useWalksData();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [showAllWalks, setShowAllWalks] = useState(false);

  const {
    loading,
    pets,
    walks,
    familyId,
    activePet,
    hasMultiplePets,
    selectPet,
    goalMin,
    todayProgress,
    streakDays,
    weekDayFlags,
    weekKm,
    weekCount,
    weeklyAvgMin,
    todayIdx,
  } = data;

  // 0 pets → empty state (no dial), same gate as web.
  if (!loading && pets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🐾</Text>
          <Text style={styles.emptyTitle}>先新增一隻寵物</Text>
          <Text style={styles.emptyBody}>
            建立寵物後就能開始記錄每天的遛狗進度。
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/pets")}
            style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
          >
            <Text style={styles.emptyCtaText}>去新增寵物</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const goalHit = todayProgress.percent >= 100;
  const doneMin = Math.round(todayProgress.minutes);
  const remainingMin = Math.max(0, goalMin - doneMin);
  const heroTitle = goalHit ? "達標了 🎉" : `再走 ${remainingMin} 分鐘`;
  const heroSub = activePet
    ? `${activePet.name} 今天走了 ${doneMin} 分 · 連續 ${streakDays} 天`
    : `今天走了 ${doneMin} 分 · 連續 ${streakDays} 天`;
  const canToggleAllWalks = walks.length > RECENT_LIMIT;
  const visibleWalks = showAllWalks ? walks : walks.slice(0, RECENT_LIMIT);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.h1}>遛狗</Text>
          {activePet ? (
            <PetPill
              activePet={activePet}
              pets={pets}
              hasMultiplePets={hasMultiplePets}
              onSelect={selectPet}
            />
          ) : null}
          <View style={styles.flex} />
          <View style={styles.streakChip}>
            <Text style={styles.streakText}>{`🔥 ${streakDays} 天`}</Text>
          </View>
        </View>

        {/* Hero copy */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroSub}>{heroSub}</Text>
        </View>

        {/* Dial */}
        <View style={styles.dialWrap}>
          <WalksDial
            percent={todayProgress.percent}
            complete={goalHit}
            doneMin={todayProgress.minutes}
            goalMin={goalMin}
          />
        </View>

        {/* Week strip */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>本週</Text>
            <Text style={styles.sectionMeta}>
              <Text style={styles.sectionMetaStrong}>{weekCount}</Text>
              {` / ${WEEK_GOAL_COUNT} · ${weekKm.toFixed(1)} km`}
            </Text>
          </View>
          <WalksWeekStrip
            days={weekDayFlags}
            todayIdx={todayIdx}
            complete={goalHit}
          />
        </View>

        {/* Recent walks */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>最近遛狗</Text>
            {canToggleAllWalks ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showAllWalks }}
                onPress={() => setShowAllWalks((v) => !v)}
                hitSlop={8}
              >
                <Text style={styles.toggleAll}>
                  {showAllWalks ? "顯示較少" : "全部"}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
          ) : walks.length === 0 ? (
            <Text style={styles.emptyWalks}>還沒有遛狗紀錄，開始第一趟吧！</Text>
          ) : (
            <View style={styles.walkList}>
              {visibleWalks.map((w) => (
                <WalkRow key={w.walkId} walk={w} />
              ))}
            </View>
          )}
        </View>

        {/* Manual log — secondary action */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="手動補登遛狗"
          disabled={pets.length === 0}
          onPress={() => setManualOpen(true)}
          style={({ pressed }) => [styles.manualBtn, pressed && styles.pressed]}
        >
          <Text style={styles.manualText}>✍️  手動補登</Text>
        </Pressable>
      </ScrollView>

      {/* Sticky CTA — floats above the bottom tab bar */}
      {!sessionOpen ? (
        <View style={[styles.ctaDock, { bottom: insets.bottom + 76 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="開始遛狗"
            disabled={pets.length === 0}
            onPress={() => setSessionOpen(true)}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.pressed,
              pets.length === 0 && styles.disabled,
            ]}
          >
            <Text style={styles.ctaText}>▶  開始遛狗</Text>
          </Pressable>
        </View>
      ) : null}

      <WalkTrackingView
        visible={sessionOpen}
        pet={activePet}
        streakDays={streakDays}
        familyId={familyId}
        goalMin={goalMin}
        todayMinBefore={todayProgress.minutes}
        weeklyAvgMin={weeklyAvgMin}
        onClose={() => setSessionOpen(false)}
        onSaved={data.refresh}
      />

      <ManualWalkDialog
        visible={manualOpen}
        pets={pets}
        streakDays={streakDays}
        familyId={familyId}
        onClose={() => setManualOpen(false)}
        onSaved={data.refresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  streakChip: {
    backgroundColor: colors.bellTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  streakText: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  hero: { marginBottom: spacing.md, paddingHorizontal: spacing.xs },
  heroTitle: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  heroSub: { marginTop: 4, fontSize: 13, fontWeight: "500", color: colors.ink2 },
  dialWrap: { marginBottom: spacing.xl, paddingVertical: spacing.sm },
  section: { marginBottom: spacing.xl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  sectionMeta: { fontSize: 12, color: colors.ink3 },
  sectionMetaStrong: { fontWeight: "800", color: colors.ink },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, paddingHorizontal: spacing.xs },
  toggleAll: { fontSize: 13, fontWeight: "700", color: colors.brandDeep },
  walkList: { gap: spacing.sm },
  emptyWalks: { fontSize: 13, color: colors.ink3, paddingHorizontal: spacing.xs },
  manualBtn: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  manualText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  ctaDock: { position: "absolute", left: 0, right: 0, paddingHorizontal: spacing.lg },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandDeep,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  emptyBody: { fontSize: 14, color: colors.ink2, textAlign: "center", lineHeight: 20 },
  emptyCta: {
    marginTop: spacing.md,
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: { fontSize: 16, fontWeight: "800", color: colors.card },
});
