/**
 * Done phase — 1:1 with the web walk-tracking-view `phase === "done"` subtree
 * (apps/web/src/components/walks/walk-tracking-view.tsx), in mango tokens
 * (docs/design-system.md §1; the done screen stays in one warm mango palette):
 *
 *   gradient wash (success-tint → white when saved & goal hit, card-soft →
 *   white otherwise), column max-w-md, gap-6, px-6 py-8:
 *   iOS design 4B (docs/features/ios-walk-map-redesign.md):
 *   headline — !saved: 正在儲存散步… / 散步已停止，紀錄尚未儲存
 *              saved: gold Trophy medal (hit) + 完成今日目標！/ 今天完成 N% + 再 N 分鐘就達標
 *   3h auto-stop notice → antique-gold achievement card, white type (avatar, pet, date/time,
 *   streak chip; route map; km + min; today % · min / goal · Mango Pet);
 *   full-screen confetti on hit
 *   回到遛狗 (primary) / 查看排行榜 (secondary), disabled until saved.
 */
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle, Flame, Trophy } from "lucide-react-native";

import type { WalkRoutePoint } from "@mango/shared-types";

import { Button } from "@/components/ui/Button";
import { RouteMap } from "@/components/walks/route-map";
import { WalkConfetti } from "@/components/walks/walk-confetti";
import { blendTodayProgress } from "@/components/walks/tracking-active-panel";
import { t } from "@/lib/i18n";
import type { WalkTrackingState } from "@/lib/walk-tracking-service";
import { colors, gold, radius, shadows, spacing } from "@/theme/theme";

type Props = {
  final: WalkTrackingState;
  petName: string;
  streakDays: number;
  storedTodayMin: number;
  goalMin: number;
  saved: boolean;
  saving: boolean;
  discarding: boolean;
  uploading: boolean;
  saveError: string | null;
  /** TrackingPhotoGrid (renders nothing without photos). */
  photoGrid: ReactNode;
  onRetry: () => void;
  onDiscard: () => void;
  /** iOS: leave while the walk waits in a local draft (shown on failure). */
  onSaveLater?: () => void;
  onBack: () => void;
  onLeaderboard: () => void;
};

const ACHIEVEMENT_GRADIENT = gold.antique;
const MEDAL_GRADIENT = gold.medal;
const GOLD_DEEP = gold.deep;

export function TrackingDonePanel({
  final,
  petName,
  streakDays,
  storedTodayMin,
  goalMin,
  saved,
  saving,
  discarding,
  uploading,
  saveError,
  photoGrid,
  onRetry,
  onDiscard,
  onSaveLater,
  onBack,
  onLeaderboard,
}: Props) {
  const blended = blendTodayProgress(storedTodayMin, final.durationMin, goalMin);
  const goalHit = blended.percent >= 100;
  // Uncapped, so an over-achiever sees e.g. 107%.
  const rawPercent = Math.round((blended.minutes / blended.goalMin) * 100);
  const min = final.durationMin;
  const started = final.startedAt ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const whenLabel = `${started.getMonth() + 1}/${started.getDate()} ${pad(started.getHours())}:${pad(started.getMinutes())}`;
  const ctaDisabled = saving || uploading || !saved;
  // No "saved" line: enabled buttons already say it (less small text).
  const statusLine = uploading ? t("Walks.photo.uploading") : saving ? t("Walks.core.savingWalk") : "";

  return (
    <LinearGradient
      colors={[colors.cardSoft, colors.card]}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.column}>
            {/* Completion headline (design 4B): title only, the card carries the rest */}
            {!saved ? (
              <Text style={styles.pendingTitle} accessibilityLiveRegion="polite">
                {saving ? t("Walks.core.savingWalk") : t("Walks.core.walkNotSaved")}
              </Text>
            ) : (
              <View style={styles.celebrate}>
                {goalHit ? (
                  <LinearGradient
                    colors={MEDAL_GRADIENT}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.medal}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <View style={styles.medalInner}>
                      <Trophy size={48} color="#ffffff" fill="rgba(255,255,255,0.28)" strokeWidth={2} />
                    </View>
                  </LinearGradient>
                ) : null}
                <Text style={styles.heroTitle} accessibilityRole="header">
                  {goalHit
                    ? t("Walks.core.goalHitTitle")
                    : t("Walks.celebration.goalMissedTitle", { percent: blended.percent })}
                </Text>
                {!goalHit ? (
                  <Text style={styles.heroSub}>
                    {t("Walks.celebration.goalMissedHint", {
                      min: Math.max(0, goalMin - Math.round(blended.minutes)),
                    })}
                  </Text>
                ) : null}
              </View>
            )}

            {/* §B runaway safeguard notice */}
            {final.autoStopped ? (
              <View style={styles.notice}>
                <AlertTriangle size={16} color={colors.brandDeep} strokeWidth={2} />
                <Text style={styles.noticeText}>{t("WalkRecorder.autoStopped")}</Text>
              </View>
            ) : null}

            {/* Achievement card (design 4B): who / when / streak, route, km + min, today */}
            <LinearGradient colors={ACHIEVEMENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              {/* Soft metallic highlight; decorative. */}
              <View style={styles.cardShine} pointerEvents="none" />
              <View style={styles.cardHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{petName.slice(0, 1)}</Text>
                </View>
                <View style={styles.cardWho}>
                  <Text style={styles.cardName} numberOfLines={1}>{petName}</Text>
                  <Text style={styles.cardWhen}>{whenLabel}</Text>
                </View>
                {streakDays >= 1 ? (
                  <View style={styles.streakChip} accessibilityLabel={`${t("Walks.core.streakLabel")} ${streakDays}`}>
                    <Flame size={14} color={GOLD_DEEP} fill={colors.amber} strokeWidth={1.8} />
                    <Text style={styles.streakChipText}>{t("Walks.core.streakDaysCount", { days: streakDays })}</Text>
                  </View>
                ) : null}
              </View>
              {final.path.length > 0 ? (
                <View style={styles.route}>
                  {/* Runtime path is the segmented accumulator path (acc.path). */}
                  <RouteMap points={final.path as WalkRoutePoint[]} style={styles.routeMap} />
                </View>
              ) : null}
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{final.totalDistanceKm.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={[styles.stat, styles.statRight]}>
                  <Text style={styles.statValue}>{min.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>min</Text>
                </View>
              </View>
              <View style={styles.cardFoot}>
                <Text style={styles.cardFootText}>
                  {`${t("Walks.core.todayPercent", { percent: rawPercent })} · ${Math.round(blended.minutes)} / ${goalMin} min`}
                </Text>
                <Text style={styles.cardBrand}>{t("App.name")}</Text>
              </View>
            </LinearGradient>

            {final.path.length === 0 ? (
              <View style={styles.notice}>
                <AlertTriangle size={16} color={colors.brandDeep} strokeWidth={2} />
                <Text style={styles.noticeText}>{t("Walks.core.noPathWarning")}</Text>
              </View>
            ) : null}

            {photoGrid}

            {saveError ? (
              <Text style={styles.error} accessibilityRole="alert">
                {saveError}
              </Text>
            ) : null}

            <View style={styles.ctas}>
              {saveError ? (
                <Button
                  label={t("Common.retry")}
                  pill
                  onPress={onRetry}
                  disabled={saving || discarding}
                />
              ) : null}
              {saveError && !saved ? (
                <Button
                  label={t("Walks.core.discardDraft")}
                  variant="secondary"
                  pill
                  onPress={onDiscard}
                  disabled={saving || discarding}
                />
              ) : null}
              {saveError && !saved && onSaveLater ? (
                <Button
                  label={t("Ios.walks.saveLater")}
                  variant="ghost"
                  pill
                  onPress={onSaveLater}
                  disabled={saving || discarding || uploading}
                />
              ) : null}
              <Text style={styles.status} accessibilityLiveRegion="polite">
                {statusLine}
              </Text>
              <Button
                label={t("Walks.core.backToWalking")}
                size="lg"
                fullWidth
                labelStyle={styles.ctaLabel}
                onPress={onBack}
                disabled={ctaDisabled}
              />
              <Button
                label={t("Walks.core.viewLeaderboard")}
                variant="secondary"
                size="lg"
                fullWidth
                labelStyle={styles.ctaLabel}
                onPress={onLeaderboard}
                disabled={ctaDisabled}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
      {/* Above everything, never blocks touches; nothing under Reduce Motion. */}
      {saved && goalHit ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <WalkConfetti count={48} />
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // web: flex-1 flex-col items-center justify-center gap-6 px-6 py-8 sm:max-w-md
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  column: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    alignItems: "center",
    gap: spacing.xl,
  },
  // web: text-center text-lg font-semibold text-mango-ink
  pendingTitle: { fontSize: 18, fontWeight: "600", color: colors.ink, textAlign: "center" },
  celebrate: { alignItems: "center", gap: spacing.sm },
  heroTitle: { fontSize: 28, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5, color: colors.ink, textAlign: "center" },
  heroSub: { fontSize: 15, color: colors.ink2, textAlign: "center" },
  // web: flex w-full max-w-xs items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs
  notice: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bellTint,
    padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.ink2 },
  // Achievement card (4G): amber → brand, ink type.
  card: {
    width: "100%",
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: "hidden",
    ...shadows.elevated,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: GOLD_DEEP },
  cardWho: { flex: 1, gap: 2 },
  cardName: { fontSize: 17, fontWeight: "800", color: "#ffffff" },
  cardWhen: { fontSize: 13, color: "#ffffff", fontVariant: ["tabular-nums"] },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  streakChipText: { fontSize: 13, fontWeight: "800", color: GOLD_DEEP },
  route: { borderRadius: radius.xl, overflow: "hidden" },
  routeMap: { height: 260 },
  stats: { flexDirection: "row" },
  stat: { flex: 1, gap: 0 },
  statRight: { alignItems: "flex-end" },
  statValue: { fontSize: 44, lineHeight: 50, letterSpacing: -1, fontWeight: "800", color: "#ffffff", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.35)",
  },
  cardFootText: { flexShrink: 1, fontSize: 13, fontWeight: "600", color: "#ffffff", fontVariant: ["tabular-nums"] },
  cardBrand: { fontSize: 13, fontWeight: "800", color: "#ffffff" },
  cardShine: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: radius.pill,
    backgroundColor: "rgba(243,210,122,0.22)",
  },
  medal: { width: 104, height: 104, borderRadius: radius.pill, padding: 6, marginBottom: spacing.xs, ...shadows.elevated },
  medalInner: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  // web: text-center text-sm text-red-600
  error: { fontSize: 14, color: colors.danger, textAlign: "center" },
  // web: flex w-full max-w-xs flex-col gap-2
  ctas: { width: "100%", maxWidth: 320, gap: spacing.sm },
  ctaLabel: { fontWeight: "700" },
  status: { minHeight: 16, fontSize: 12, color: colors.ink2, textAlign: "center" },
});
