/**
 * Streak chip (S1 polish) — "🔥 N 天". At a ≥7-day streak it switches to the
 * leaf milestone variant and the flame flickers (subtle opacity + scale pulse).
 * Reduced-motion holds a static flame. Decorative flame is a11y-hidden; the
 * label carries the count.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius } from "@/theme/theme";

const MILESTONE = 7;

export function WalksStreakChip({ streakDays }: { streakDays: number }) {
  const reduceMotion = useReducedMotion();
  const milestone = streakDays >= MILESTONE;
  const flicker = useSharedValue(0);

  useEffect(() => {
    if (!milestone || reduceMotion) {
      flicker.value = 0;
      return;
    }
    flicker.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 280, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 280, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [milestone, reduceMotion, flicker]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + flicker.value * 0.25,
    transform: [{ scale: 1 + flicker.value * 0.18 }],
  }));

  return (
    <View style={[styles.chip, milestone && styles.chipMilestone]}>
      <Reanimated.Text
        style={[styles.flame, flameStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        🔥
      </Reanimated.Text>
      <Text style={[styles.text, milestone && styles.textMilestone]}>
        {`${streakDays} 天`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bellTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  chipMilestone: { backgroundColor: colors.leafTint },
  flame: { fontSize: 12 },
  text: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  textMilestone: { color: "#3f7a39" },
});
