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
 *
 * iOS map mode (docs/features/ios-walk-map-redesign.md, design 3B): when GPS
 * is on, the live map fills the whole screen; the status pill and hints float
 * at the top centre; a white bottom card holds timer, distance | today %, the
 * progress bar, photo thumbnails and three centred round buttons
 * (Pause · Stop · Photo). Timing-only / denied keeps the scrolling column.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, Camera, Pause, Play, Square } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WalkRoutePoint } from "@mango/shared-types";

import { Button } from "@/components/ui/Button";
import { WALK_PHOTO_LIMIT } from "@/components/walks/tracking-photos";
import { LiveWalkMap } from "@/components/walks/walk-maps";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { WalkTrackingState } from "@/lib/walk-tracking-service";
import { colors, radius, shadows, spacing } from "@/theme/theme";

/** web fmtMmSs: floor to whole seconds; minutes may exceed 59. */
export function formatMmSs(durationSec: number): string {
  const total = Math.max(0, Math.floor(durationSec));
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

/** Map mode (spec Q7/Q12); timing-only / no permission keeps the column. */
export function showsLiveMap(state: WalkTrackingState): boolean {
  return !state.timingOnly && state.errorKind !== "permission_denied";
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
  photoCount,
  onOpenCamera,
  stopDisabled,
  onPauseResume,
  onStop,
}: {
  state: WalkTrackingState;
  petName: string;
  storedTodayMin: number;
  goalMin: number;
  /** TrackingPhotoControls — in map mode rendered without its own button. */
  photos: ReactNode;
  photoCount: number;
  onOpenCamera: () => void;
  stopDisabled?: boolean;
  onPauseResume: () => void;
  onStop: () => void;
}) {
  const blended = blendTodayProgress(storedTodayMin, state.durationMin, goalMin);
  const key = hintKey(state.errorKind);
  const denied = state.errorKind === "permission_denied";
  const timer = formatMmSs(state.durationSec);
  const showMap = showsLiveMap(state);
  const insets = useSafeAreaInsets();
  const [cardH, setCardH] = useState(0);

  const reminder = state.reminderShown ? (
    <Text accessibilityRole="alert" style={showMap ? [styles.floatBar, styles.floatText] : styles.reminder}>
      {t("WalkRecorder.returnBody")}
    </Text>
  ) : null;
  const bgHint = !state.backgroundEnabled ? (
    <Text style={showMap ? [styles.floatBar, styles.floatHint] : styles.bgHint}>
      {t(state.timingOnly ? "WalkRecorder.timingOnlyHint" : "WalkRecorder.foregroundOnly")}
    </Text>
  ) : null;
  const gpsHint = key ? (
    <View style={[styles.hint, showMap && styles.floatBar]} accessibilityLiveRegion="polite">
      <AlertTriangle size={14} color={denied ? colors.danger : colors.brandDeep} strokeWidth={2} />
      <Text style={[styles.hintText, denied && styles.hintDenied]}>{t(key)}</Text>
    </View>
  ) : null;

  /* Status pill — the dot doubles as the "still recording" signal */
  const pill = (
    <View style={[styles.pillWrap, showMap && styles.floatPill]}>
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
  );

  const timerEl = (
    <Text
      style={styles.timer}
      accessibilityRole="timer"
      accessibilityLabel={timer}
    >
      {timer}
    </Text>
  );
  const distanceEl = (
    <Text style={styles.distance}>
      {state.totalDistanceKm.toFixed(2)}
      <Text style={styles.distanceUnit}> km</Text>
    </Text>
  );

  const progress = (
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
  );

  /* Pause/resume (secondary, smaller) above the dominant Stop */
  const controls = (
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
  );

  if (showMap) {
    const photoFull = photoCount >= WALK_PHOTO_LIMIT;
    // Panel sits inside the modal's safe-area padding; the map bleeds past it.
    const mapLayer = { top: -insets.top, bottom: -insets.bottom, left: -insets.left, right: -insets.right };
    return (
      <View style={styles.screen}>
        <View style={[styles.mapLayer, mapLayer]}>
          {/* Runtime path is the segmented accumulator path (acc.path). */}
          <LiveWalkMap
            path={state.path as WalkRoutePoint[]}
            padding={{ top: insets.top + 64, bottom: insets.bottom + spacing.md + cardH }}
          >
            {pill}
            {reminder}
            {bgHint}
            {gpsHint}
          </LiveWalkMap>
        </View>

        <View style={styles.card} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
          <Text style={styles.cardTimer} accessibilityRole="timer" accessibilityLabel={timer}>
            {timer}
          </Text>
          <View style={styles.stats}>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue}>
                {state.totalDistanceKm.toFixed(2)}
                <Text style={styles.statUnit}> km</Text>
              </Text>
              <Text style={styles.statLabel}>{t("Walks.map.distance")}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {blended.percent}
                <Text style={styles.statUnit}> %</Text>
              </Text>
              <Text style={styles.statLabel}>{`${Math.round(blended.minutes)} / ${goalMin} min`}</Text>
            </View>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel={t("Walks.core.todayPercent", { percent: blended.percent })}
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
          {photos}
          <View style={styles.roundRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onPauseResume}
              style={({ pressed }) => [styles.roundItem, pressed && styles.pressed]}
            >
              <View style={[styles.round, styles.roundSecondary]}>
                {state.isPaused ? (
                  <Play size={22} color={colors.ink} strokeWidth={2} />
                ) : (
                  <Pause size={22} color={colors.ink} strokeWidth={2} />
                )}
              </View>
              <Text style={styles.roundLabel}>
                {state.isPaused ? t("Walks.core.resume") : t("Walks.core.pause")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !!stopDisabled }}
              disabled={stopDisabled}
              onPress={onStop}
              style={({ pressed }) => [styles.roundItem, pressed && styles.pressed, stopDisabled && styles.stopDisabled]}
            >
              <View style={[styles.round, styles.roundStop]}>
                <Square size={24} color="#ffffff" fill="#ffffff" strokeWidth={2} />
              </View>
              <Text style={styles.roundLabel}>{t("Walks.core.stop")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: photoFull }}
              disabled={photoFull}
              onPress={onOpenCamera}
              style={({ pressed }) => [styles.roundItem, pressed && styles.pressed]}
            >
              <View style={[styles.round, photoFull ? styles.roundSecondary : styles.roundPhoto]}>
                <Camera size={22} color={photoFull ? colors.ink3 : colors.ink} strokeWidth={2} />
              </View>
              <Text style={styles.roundLabel} numberOfLines={1}>
                {photoFull
                  ? t("Walks.photo.limitReached")
                  : t("Walks.photo.button", { n: photoCount, max: WALK_PHOTO_LIMIT })}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {reminder}
      {bgHint}
      {pill}
      {timerEl}
      {distanceEl}
      {progress}
      {gpsHint}
      {photos}
      {controls}
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
  // Map mode (3B): full-bleed map layer + floating bottom card.
  screen: { flex: 1 },
  mapLayer: { position: "absolute" },
  card: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    ...shadows.elevated,
  },
  cardTimer: { fontSize: 56, lineHeight: 62, fontWeight: "700", letterSpacing: -1.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.hairline },
  statValue: { fontSize: 20, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
  statUnit: { fontSize: 13, fontWeight: "400", color: colors.ink2 },
  statLabel: { fontSize: 12, color: colors.ink2, fontVariant: ["tabular-nums"] },
  roundRow: { flexDirection: "row", alignSelf: "stretch", alignItems: "flex-end", marginTop: spacing.xs },
  roundItem: { flex: 1, alignItems: "center", gap: 6 },
  round: { width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  roundSecondary: { backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.hairline },
  roundPhoto: { backgroundColor: colors.brandTint, borderWidth: 1.5, borderColor: colors.brand },
  roundStop: { width: 72, height: 72, backgroundColor: colors.danger },
  roundLabel: { fontSize: 13, fontWeight: "600", color: colors.ink },
  pressed: { opacity: 0.85 },
  floatPill: {
    alignSelf: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadows.card,
  },
  reminder: { color: colors.ink, fontSize: 16 },
  bgHint: { color: colors.ink2, fontSize: 14 },
  floatBar: {
    alignSelf: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: "100%", // overrides the 320 cap of .hint
    ...shadows.card,
  },
  floatText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  floatHint: { color: colors.ink2, fontSize: 12 },
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
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  stopPressed: { opacity: 0.9 },
  stopDisabled: { opacity: 0.6 },
  stopText: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
});
