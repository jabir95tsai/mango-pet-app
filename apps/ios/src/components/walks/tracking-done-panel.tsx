/**
 * Done phase — 1:1 with the web walk-tracking-view `phase === "done"` subtree
 * (apps/web/src/components/walks/walk-tracking-view.tsx), in mango tokens
 * (docs/design-system.md §1; leaf/success green stays for "goal hit"):
 *
 *   gradient wash (success-tint → white when saved & goal hit, card-soft →
 *   white otherwise), column max-w-md, gap-6, px-6 py-8:
 *   headline — !saved: 正在儲存散步… / 散步已停止，紀錄尚未儲存
 *              saved & goal hit: confetti + Trophy circle + 完成今日目標！ +
 *                                🔥 streak (pop)
 *              saved & missed: 今天完成 N% + 再 N 分鐘就達標
 *   3h auto-stop notice → ONE 2-col stat card (km | min) + recap list
 *   (vs weekly avg, calories) → no-path warning → photo grid → 加備註
 *   disclosure → save error + Retry / Discard draft → status line →
 *   回到遛狗 (primary) / 查看排行榜 (secondary), disabled until saved.
 */
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle, ChevronDown, Trophy } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { StreakPop, WalkConfetti } from "@/components/walks/walk-confetti";
import { blendTodayProgress } from "@/components/walks/tracking-active-panel";
import { t } from "@/lib/i18n";
import { estimatePetCalories } from "@/lib/walk-stats";
import type { WalkTrackingState } from "@/lib/walk-tracking-service";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  final: WalkTrackingState;
  petName: string;
  petWeightKg: number | null;
  streakDays: number;
  storedTodayMin: number;
  goalMin: number;
  weeklyAvgMin: number;
  saved: boolean;
  saving: boolean;
  discarding: boolean;
  uploading: boolean;
  saveError: string | null;
  /** TrackingPhotoGrid (renders nothing without photos). */
  photoGrid: ReactNode;
  notes: string;
  onNotesChange: (v: string) => void;
  onNotesBlur: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  /** iOS: leave while the walk waits in a local draft (shown on failure). */
  onSaveLater?: () => void;
  onBack: () => void;
  onLeaderboard: () => void;
};

export function TrackingDonePanel({
  final,
  petName,
  petWeightKg,
  streakDays,
  storedTodayMin,
  goalMin,
  weeklyAvgMin,
  saved,
  saving,
  discarding,
  uploading,
  saveError,
  photoGrid,
  notes,
  onNotesChange,
  onNotesBlur,
  onRetry,
  onDiscard,
  onSaveLater,
  onBack,
  onLeaderboard,
}: Props) {
  const [notesOpen, setNotesOpen] = useState(false);

  const blended = blendTodayProgress(storedTodayMin, final.durationMin, goalMin);
  const goalHit = blended.percent >= 100;
  const min = final.durationMin;
  const diff = Math.round(min - weeklyAvgMin);
  const showAvg = weeklyAvgMin > 0;
  const kcal = estimatePetCalories(final.totalDistanceKm, petWeightKg);
  const ctaDisabled = saving || uploading || !saved;
  const statusLine = uploading
    ? t("Walks.photo.uploading")
    : saving
      ? t("Walks.core.savingWalk")
      : saved && !saveError
        ? t("Walks.core.walkSaved")
        : "";

  return (
    <LinearGradient
      colors={saved && goalHit ? [colors.successTint, colors.card] : [colors.cardSoft, colors.card]}
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
            {/* Completion headline */}
            {!saved ? (
              <Text style={styles.pendingTitle} accessibilityLiveRegion="polite">
                {saving ? t("Walks.core.savingWalk") : t("Walks.core.walkNotSaved")}
              </Text>
            ) : goalHit ? (
              <View style={styles.celebrate}>
                <WalkConfetti />
                <View style={styles.trophy}>
                  <Trophy size={32} color={colors.leaf} strokeWidth={2} />
                </View>
                <Text style={styles.goalHitTitle} accessibilityRole="header">
                  {t("Walks.core.goalHitTitle")}
                </Text>
                {streakDays >= 1 ? (
                  <StreakPop>
                    <Text style={styles.streak}>
                      {`🔥 ${t("Walks.core.streakDaysCount", { days: streakDays })}`}
                    </Text>
                  </StreakPop>
                ) : null}
              </View>
            ) : (
              <View style={styles.missed}>
                <Text style={styles.missedTitle} accessibilityRole="header">
                  {t("Walks.celebration.goalMissedTitle", { percent: blended.percent })}
                </Text>
                <Text style={styles.missedHint}>
                  {t("Walks.celebration.goalMissedHint", {
                    min: Math.max(0, goalMin - Math.round(blended.minutes)),
                  })}
                </Text>
              </View>
            )}

            {/* §B runaway safeguard notice */}
            {final.autoStopped ? (
              <View style={styles.notice}>
                <AlertTriangle size={16} color={colors.brandDeep} strokeWidth={2} />
                <Text style={styles.noticeText}>{t("Walks.core.autoStoppedNotice")}</Text>
              </View>
            ) : null}

            {/* This-session recap */}
            <View style={styles.recapBlock}>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>km</Text>
                  <Text style={styles.statValue}>{final.totalDistanceKm.toFixed(2)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>min</Text>
                  <Text style={styles.statValue}>{min.toFixed(1)}</Text>
                </View>
              </View>
              {showAvg || kcal > 0 ? (
                <View style={styles.recapList}>
                  {showAvg ? (
                    <Text style={styles.recapLine}>
                      {diff > 0
                        ? t("Walks.celebration.vsAvgLonger", { min: diff })
                        : diff < 0
                          ? t("Walks.celebration.vsAvgShorter", { min: Math.abs(diff) })
                          : t("Walks.celebration.vsAvgSame")}
                    </Text>
                  ) : null}
                  {kcal > 0 ? (
                    <Text style={styles.recapLine}>
                      {t("Walks.celebration.calories", { name: petName, kcal })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            {final.path.length === 0 ? (
              <View style={styles.notice}>
                <AlertTriangle size={16} color={colors.brandDeep} strokeWidth={2} />
                <Text style={styles.noticeText}>{t("Walks.core.noPathWarning")}</Text>
              </View>
            ) : null}

            {photoGrid}

            {/* Notes — persisted on blur / before leaving the recap */}
            <View style={styles.notes}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: notesOpen }}
                onPress={() => setNotesOpen((v) => !v)}
                style={({ pressed }) => [styles.notesToggle, pressed && styles.notesTogglePressed]}
              >
                {/* Static flip (web rotate-180); no transition to gate. */}
                <View style={notesOpen ? styles.chevronOpen : undefined}>
                  <ChevronDown size={16} color={colors.ink3} strokeWidth={2} />
                </View>
                <Text style={styles.notesToggleText}>{t("Walks.core.addNote")}</Text>
              </Pressable>
              {notesOpen ? (
                <Textarea
                  value={notes}
                  onChangeText={onNotesChange}
                  onBlur={onNotesBlur}
                  accessibilityLabel={t("Walks.core.noteOptional")}
                  maxLength={500}
                  containerStyle={styles.notesInput}
                />
              ) : null}
            </View>

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
                onPress={onBack}
                disabled={ctaDisabled}
              />
              <Button
                label={t("Walks.core.viewLeaderboard")}
                variant="secondary"
                size="lg"
                fullWidth
                onPress={onLeaderboard}
                disabled={ctaDisabled}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // web: flex-1 flex-col items-center justify-center gap-6 px-6 py-8 sm:max-w-md
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
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
  // web: relative flex flex-col items-center gap-2 (+ confetti absolute inset-0)
  celebrate: { alignItems: "center", gap: spacing.sm },
  // web: grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700
  trophy: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.leafTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // web: text-2xl font-bold text-emerald-700
  goalHitTitle: { fontSize: 24, fontWeight: "700", color: colors.leaf, textAlign: "center" },
  // web: text-sm font-semibold tabular-nums text-amber-700
  streak: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandDeep,
    fontVariant: ["tabular-nums"],
  },
  missed: { alignItems: "center", gap: 4 },
  missedTitle: { fontSize: 24, fontWeight: "700", color: colors.ink, textAlign: "center" },
  missedHint: { fontSize: 12, color: colors.ink3, textAlign: "center" },
  // web: flex w-full max-w-xs items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs
  notice: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bellTint,
    padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.ink2 },
  // web: flex w-full max-w-xs flex-col gap-3
  recapBlock: { width: "100%", maxWidth: 320, gap: spacing.md },
  // web: grid grid-cols-2 gap-3 rounded-xl border bg-zinc-50 p-4 text-center
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSoft,
    padding: spacing.lg,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: colors.ink3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  // web: flex flex-col gap-1.5 rounded-lg border bg-white p-3 text-xs
  recapList: {
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  recapLine: { fontSize: 12, lineHeight: 17, color: colors.ink2 },
  notes: { width: "100%", maxWidth: 320 },
  // web summary: centered gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-500
  notesToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  notesTogglePressed: { backgroundColor: colors.bgAlt },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  notesToggleText: { fontSize: 14, color: colors.ink3 },
  notesInput: { marginTop: spacing.sm },
  // web: text-center text-sm text-red-600
  error: { fontSize: 14, color: colors.danger, textAlign: "center" },
  // web: flex w-full max-w-xs flex-col gap-2
  ctas: { width: "100%", maxWidth: 320, gap: spacing.sm },
  status: { minHeight: 16, fontSize: 12, color: colors.ink2, textAlign: "center" },
});
