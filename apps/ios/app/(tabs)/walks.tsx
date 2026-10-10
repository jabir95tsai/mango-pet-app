/**
 * WalksHome — 1:1 with apps/web/src/app/app/walks/page.tsx:
 * top bar (title + active-pet pill/picker + streak chip) → hero copy → dial →
 * week strip → recent walks (rows with delete / walker / photo) → manual log,
 * plus the sticky 「開始遛狗」 CTA, the pending-draft recovery notice and the
 * brief goal-hit confetti. Every string comes from the shared catalog.
 *
 * Data (useWalksData) refetches on focus when stale and after writes; the
 * screen adds pull-to-refresh. Walk score / goal / GPS math all come from
 * @mango/shared-business.
 *
 * Tree shape: the root SafeAreaView and the WalkSessionOverlays position are
 * identical in the 0-pet and the normal branch, so a pets-list change mid-walk
 * (e.g. a recovered session with 0 pets) never remounts the tracking overlay.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Footprints, Hand, Plus } from "lucide-react-native";
import type { Walk } from "@mango/shared-types";

import { useWalksData } from "@/lib/use-walks-data";
import { WalksDial } from "@/components/walks/walks-dial";
import { WalksWeekStrip } from "@/components/walks/walks-week-strip";
import { WalksStreakChip } from "@/components/walks/walks-streak-chip";
import { WalksStartCta } from "@/components/walks/walks-start-cta";
import { PetPill } from "@/components/walks/pet-pill";
import { WalkRow } from "@/components/walks/walk-row";
import { ManualWalkDialog } from "@/components/walks/manual-walk-dialog";
import { WalkConfetti } from "@/components/walks/walk-confetti";
import {
  useWalkSessionController,
  WalkSessionOverlays,
} from "@/components/walks/tracking-session-controller";
import { WalkDraftRecoveryNotice } from "@/components/walks/walk-draft-recovery";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { alertError, confirm } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { deleteWalk } from "@/lib/walks";
import { colors, CONTENT_MAX_WIDTH, spacing } from "@/theme/theme";

const WEEK_GOAL_COUNT = 5;
const RECENT_LIMIT = 5;
/** Web: the goal-hit confetti auto-hides after 4 s (user feedback). */
const CONFETTI_MS = 4000;

export default function WalksScreen() {
  const router = useRouter();
  const data = useWalksData();
  // Tracking session: start (guest-gated photo prompt), recap, local-draft
  // and killed-app recovery — see tracking-session-controller.tsx.
  const session = useWalkSessionController(data);
  const { sessionOpen } = session;
  const [manualOpen, setManualOpen] = useState(false);
  const [showAllWalks, setShowAllWalks] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const {
    loading,
    refreshing,
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
    todayIdx,
    scopeReady,
    walksComplete,
    loadAllWalks,
    refresh,
  } = data;

  const goalHit = todayProgress.percent >= 100;

  // Above the 0-pet branch on purpose (web React #300 lesson: hook order).
  useEffect(() => {
    if (!goalHit) {
      setShowConfetti(false);
      return;
    }
    setShowConfetti(true);
    const id = setTimeout(() => setShowConfetti(false), CONFETTI_MS);
    return () => clearTimeout(id);
  }, [goalHit]);

  const handleDelete = useCallback(
    async (walk: Walk) => {
      const ok = await confirm({
        title: t("Common.delete"),
        message: `${walk.distanceKm.toFixed(2)} km · ${walk.durationMin.toFixed(0)} min`,
        confirmLabel: t("Common.delete"),
        cancelLabel: t("Common.cancel"),
        destructive: true,
      });
      if (!ok) return;
      try {
        await deleteWalk(walk.walkId);
        data.reloadAfterWrite();
      } catch (err) {
        if (__DEV__) console.warn("[walks] delete failed", err);
        alertError(t("Error.title"));
      }
    },
    [data],
  );

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      tintColor={colors.brand}
    />
  );

  const noPets = !loading && pets.length === 0;

  let content;
  if (noPets) {
    // 0 pets → no dial (web short circuit): recovery notice + EmptyState.
    content = (
      <ScrollView
        contentContainerStyle={[styles.scroll, styles.scrollEmpty]}
        refreshControl={refreshControl}
      >
        <WalkDraftRecoveryNotice recovery={session.drafts} uid={session.uid} />
        <EmptyState
          icon={Footprints}
          title={t("Walks.core.needPetTitle")}
          description={t("Walks.core.needPetDescription")}
          action={{
            label: t("Walks.core.needPetCta"),
            icon: Plus,
            onPress: () => router.push("/(tabs)/pets"),
          }}
        />
      </ScrollView>
    );
  } else {
    const doneMin = Math.round(todayProgress.minutes);
    const remainingMin = Math.max(0, goalMin - doneMin);
    const heroTitle = goalHit
      ? t("Walks.page.heroComplete")
      : t("Walks.page.heroIncomplete", { min: remainingMin });
    const heroSub = activePet
      ? t("Walks.page.heroSub", { pet: activePet.name, done: doneMin, streak: streakDays })
      : t("Walks.page.heroSubNoPet", { done: doneMin, streak: streakDays });
    const canToggleAllWalks = walks.length > RECENT_LIMIT;
    const visibleWalks = showAllWalks ? walks : walks.slice(0, RECENT_LIMIT);

    content = (
      <ScrollView
        contentContainerStyle={[styles.scroll, styles.scrollWithCta]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* Stopped walks still waiting for their server save (web recoveryNotice) */}
        <WalkDraftRecoveryNotice recovery={session.drafts} uid={session.uid} />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.h1} accessibilityRole="header">
            {t("Nav.walks")}
          </Text>
          {activePet ? (
            <PetPill
              activePet={activePet}
              pets={pets}
              hasMultiplePets={hasMultiplePets}
              onSelect={selectPet}
            />
          ) : null}
          <View style={styles.flex} />
          <WalksStreakChip streakDays={streakDays} />
        </View>

        {/* Hero copy */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle} accessibilityLiveRegion="polite">
            {heroTitle}
          </Text>
          <Text style={styles.heroSub}>{heroSub}</Text>
        </View>

        {/* Dial (web: relative mb-6 pt-2 pb-6) */}
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
            <Text style={styles.sectionLabel}>{t("Walks.page.weekLabel")}</Text>
            <Text style={styles.sectionMeta}>
              <Text style={styles.sectionMetaStrong}>{weekCount}</Text>
              {` / ${WEEK_GOAL_COUNT} · ${weekKm.toFixed(1)} km`}
            </Text>
          </View>
          <WalksWeekStrip days={weekDayFlags} todayIdx={todayIdx} complete={goalHit} />
        </View>

        {/* Recent walks — or the empty state in place of the whole section */}
        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : walks.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title={t("Walks.core.emptyWalksTitle")}
            description={t("Walks.core.emptyWalksDescription")}
          />
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t("Walks.page.recentTitle")}
              </Text>
              {canToggleAllWalks ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllWalks }}
                  hitSlop={8}
                  onPress={() => {
                    // "View all" needs the full history (WALKS-12).
                    if (!showAllWalks && !walksComplete) void loadAllWalks();
                    setShowAllWalks((v) => !v);
                  }}
                  // web: rounded-full px-2 py-1 text-xs semibold brand-deep, hover brand-tint
                  style={({ pressed }) => [styles.toggleAllBtn, pressed && styles.toggleAllPressed]}
                >
                  <Text style={styles.toggleAll}>
                    {showAllWalks ? t("Walks.page.showRecent") : t("Walks.page.viewAll")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.walkList}>
              {visibleWalks.map((w) => (
                <WalkRow key={w.walkId} walk={w} onDelete={handleDelete} />
              ))}
            </View>
          </View>
        )}

        {/* Manual log — secondary action, never competes with the CTA */}
        <Button
          label={t("Walks.core.manualLog")}
          variant="ghost"
          size="sm"
          icon={<Hand size={16} color={colors.ink2} strokeWidth={2} />}
          disabled={pets.length === 0 || !scopeReady}
          onPress={() => setManualOpen(true)}
          style={styles.manualBtn}
          labelStyle={styles.manualText}
        />
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {content}

      {/* Goal-hit celebration — brief, decorative, never blocks touches.
          WalkConfetti renders nothing under Reduce Motion. */}
      {showConfetti && !noPets ? (
        <View pointerEvents="none" style={styles.confetti}>
          <WalkConfetti />
        </View>
      ) : null}

      {/* Sticky CTA — floats above the bottom tab bar */}
      {!sessionOpen && !noPets ? (
        <View style={styles.ctaDock}>
          <View style={styles.ctaInner}>
            <WalksStartCta onPress={session.startWalking} disabled={pets.length === 0} />
          </View>
        </View>
      ) : null}

      {/* START photo prompt (guest-gated) + tracking overlay. Tracked saves
          refresh the home only when the overlay closes (TRACK-11). */}
      <WalkSessionOverlays session={session} data={data} />

      <ManualWalkDialog
        visible={manualOpen}
        pets={pets}
        streakDays={streakDays}
        familyId={familyId}
        defaultPetId={activePet?.petId ?? null}
        onClose={() => setManualOpen(false)}
        onSaved={data.reloadAfterWrite}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // iPad: phone-width centred column (CONTENT_MAX_WIDTH).
  scroll: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  // 62pt CTA + 32 above the bar + 24 breathing room.
  scrollWithCta: { paddingBottom: 118 },
  scrollEmpty: { flexGrow: 1, justifyContent: "center", paddingBottom: spacing.xxl },
  flex: { flex: 1 },
  // web: mb-3 flex items-center gap-2.5
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  // web: mb-3 px-1; h2 26/700 leading-tight tracking-tight
  hero: { marginBottom: spacing.md, paddingHorizontal: spacing.xs },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.65,
  },
  heroSub: { marginTop: 4, fontSize: 13, fontWeight: "500", color: colors.ink2 },
  dialWrap: { paddingTop: spacing.sm, paddingBottom: spacing.xl, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 28,
  },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  sectionMeta: { fontSize: 12, color: colors.ink3, fontVariant: ["tabular-nums"] },
  sectionMetaStrong: { fontWeight: "700", color: colors.ink },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  toggleAllBtn: { borderRadius: 9999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  toggleAllPressed: { backgroundColor: colors.brandTint },
  toggleAll: { fontSize: 12, fontWeight: "600", color: colors.brandDeep },
  walkList: { gap: spacing.sm },
  loading: { marginVertical: spacing.lg },
  // web: mt-6 flex justify-center, ghost sm, Hand size-4, ink-2
  manualBtn: { alignSelf: "center", marginTop: spacing.xl },
  manualText: { color: colors.ink2 },
  confetti: { position: "absolute", top: 0, left: 0, right: 0, height: 240 },
  // The tab bar is in-flow (this screen ends at its top edge). Web sits the
  // CTA 32px above its nav so the raised centre disc (20pt here) stays clear.
  ctaDock: { position: "absolute", left: 0, right: 0, bottom: 32, paddingHorizontal: spacing.lg },
  ctaInner: { width: "100%", maxWidth: CONTENT_MAX_WIDTH - spacing.lg * 2, alignSelf: "center" },
});
