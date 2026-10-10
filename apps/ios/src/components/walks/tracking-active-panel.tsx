/**
 * Tracking phase body — 1:1 with the web walk-tracking-view tracking subtree
 * (apps/web/src/components/walks/walk-tracking-view.tsx, `phase === "tracking"`):
 * centered column gap-8 px-6 py-8 with
 *
 *   status pill (brand-tint, 6px pulsing brand dot, 追蹤中/已暫停 · 🐾 pet)
 *   → timer (72 bold ink tabular, mm:ss)
 *   → distance (30 semibold ink + 16 normal ink2 "km")
 *   → today progress (stored + session vs goal, amber → leaf at 100%)
 *   → GPS hint (AlertTriangle + 12/500 brand-deep; red when denied)
 *   → photo pill + thumbnails
 *   → secondary Pause/Resume pill + full-width red Stop (h-14).
 *
 * iOS addition (accepted platform difference): a small "recording in the
 * background" line under the pill when Always permission is on.
 * The whole column scrolls on short screens instead of clipping.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, Pause, Play, Square } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { WalkTrackingState } from "@/lib/walk-tracking-service";
import { colors, radius, spacing } from "@/theme/theme";

/** web fmtMmSs: floor to whole seconds; minutes may exceed 59. */
export function formatMmSs(durationMin: number): string {
  const total = Math.max(0, Math.floor(durationMin * 60));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** web WalkSession.blendTodayProgress. */
export function blendTodayProgress(storedTodayMin: number, sessionMin: number, goalMin: number) {
  const minutes = Math.round((storedTodayMin + sessionMin) * 10) / 10;
  const goal = goalMin > 0 ? goalMin : 30;
  return { minutes, goalMin: goal, percent: Math.min(100, Math.round((minutes / goal) * 100)) };
}

function hintKey(kind: WalkTrackingState["errorKind"]): string | null {
  switch (kind) {
    case "permission_denied":
      return "Ios.walks.locationNeededTitle";
    case "position_unavailable":
      return "Walks.core.errWeak";
    case "backgrounded":
      return "Walks.core.errBackground";
    default:
      return null;
  }
}

function PulseDot({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || reduceMotion) {
      opacity.setValue(1);
      return;
    }
    // Tailwind animate-pulse: opacity 1 → .5 → 1 over 2s.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, opacity]);
  return <Animated.View style={[styles.dot, { opacity }]} />;
}

export function TrackingActivePanel({
  state,
  petName,
  storedTodayMin,
  goalMin,
  photos,
  stopDisabled,
  onPauseResume,
  onStop,
}: {
  state: WalkTrackingState;
  petName: string;
  storedTodayMin: number;
  goalMin: number;
  /** The photo pill + thumbnails (TrackingPhotoControls). */
  photos: ReactNode;
  stopDisabled?: boolean;
  onPauseResume: () => void;
  onStop: () => void;
}) {
  const blended = blendTodayProgress(storedTodayMin, state.durationMin, goalMin);
  const key = hintKey(state.errorKind);
  const denied = state.errorKind === "permission_denied";
  const timer = formatMmSs(state.durationMin);

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Status pill — the dot doubles as the "still recording" signal */}
      <View style={styles.pillWrap}>
        <View
          style={styles.pill}
          accessible
          accessibilityLabel={`${state.isPaused ? t("Walks.core.paused") : t("Walks.core.tracking")} · ${petName}`}
          accessibilityLiveRegion="polite"
        >
          <PulseDot active={!state.isPaused} />
          <Text style={styles.pillText}>
            {state.isPaused ? t("Walks.core.paused") : t("Walks.core.tracking")}
          </Text>
          <Text style={styles.pillPet} numberOfLines={1}>
            {`· 🐾 ${petName}`}
          </Text>
        </View>
        {state.backgroundEnabled ? (
          <Text style={styles.bgLine}>{t("Ios.walks.backgroundOn")}</Text>
        ) : null}
      </View>

      <Text style={styles.timer} accessibilityRole="timer" accessibilityLabel={timer}>
        {timer}
      </Text>

      <Text style={styles.distance}>
        {state.totalDistanceKm.toFixed(2)}
        <Text style={styles.distanceUnit}> km</Text>
      </Text>

      <View style={styles.progress}>
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>
            {t("Walks.core.todayPercent", { percent: blended.percent })}
          </Text>
          <Text style={styles.progressValue}>
            {`${Math.round(blended.minutes)} / ${goalMin} min`}
          </Text>
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: blended.percent }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${blended.percent}%`,
                backgroundColor: blended.percent >= 100 ? colors.leaf : colors.amber,
              },
            ]}
          />
        </View>
      </View>

      {key ? (
        <View style={styles.hint} accessibilityLiveRegion="polite">
          <AlertTriangle size={14} color={denied ? colors.danger : colors.brandDeep} strokeWidth={2} />
          <Text style={[styles.hintText, denied && styles.hintDenied]}>{t(key)}</Text>
        </View>
      ) : null}

      {photos}

      {/* Pause/resume (secondary, smaller) above the dominant Stop */}
      <View style={styles.controls}>
        <Button
          variant="secondary"
          pill
          label={state.isPaused ? t("Walks.core.resume") : t("Walks.core.pause")}
          icon={state.isPaused ? Play : Pause}
          onPress={onPauseResume}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !!stopDisabled }}
          disabled={stopDisabled}
          onPress={onStop}
          style={({ pressed }) => [
            styles.stopBtn,
            pressed && styles.stopPressed,
            stopDisabled && styles.stopDisabled,
          ]}
        >
          <Square size={20} color="#ffffff" strokeWidth={2} />
          <Text style={styles.stopText}>{t("Walks.core.stop")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // web: flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  pillWrap: { alignItems: "center", gap: 6 },
  // web: rounded-full bg-mango-brand-tint px-3 py-1.5 text-xs font-medium text-mango-brand-deep gap-2
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  pillText: { fontSize: 12, fontWeight: "500", color: colors.brandDeep },
  pillPet: { fontSize: 12, fontWeight: "500", color: colors.ink2, flexShrink: 1 },
  bgLine: { fontSize: 12, color: colors.ink3 },
  // web: font-bold tabular-nums text-7xl text-mango-ink
  timer: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  // web: text-3xl font-semibold tabular-nums + ml-1 text-base font-normal ink-2 "km"
  distance: {
    fontSize: 30,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  distanceUnit: { fontSize: 16, fontWeight: "400", color: colors.ink2 },
  // web: w-full max-w-xs
  progress: { width: "100%", maxWidth: 320 },
  progressHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: colors.ink2 },
  progressValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 8,
    width: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 320 },
  hintText: { fontSize: 12, fontWeight: "500", color: colors.brandDeep, flexShrink: 1 },
  hintDenied: { color: colors.danger },
  // web: flex w-full max-w-xs flex-col items-center gap-3
  controls: { width: "100%", maxWidth: 320, alignItems: "center", gap: spacing.md },
  // web: Button danger h-14 w-full text-base font-semibold + Square size-5
  stopBtn: {
    width: "100%",
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  stopPressed: { opacity: 0.9 },
  stopDisabled: { opacity: 0.6 },
  stopText: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
});
