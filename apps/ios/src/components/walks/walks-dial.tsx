/**
 * Radial walk dial (S1 polish) — today's progress as a smooth SVG arc.
 *
 * Upgraded from the 60-tick segmented ring to a single stroked circle whose
 * strokeDashoffset animates to the goal percentage (react-native-svg, already a
 * dep). The arc is a brand→amber gradient that turns leaf→success green on
 * goal-hit ("達標 leaf 綠漸層"). Center: a Reanimated walking 🐕 (bob + tail-ish
 * tilt) over a {done}/{goal} 分 pill.
 *
 * Reduced-motion: the arc snaps to its value and the dog holds a static frame.
 */
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Stop } from "react-native-svg";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius } from "@/theme/theme";

const SIZE = 232;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

type Props = {
  percent: number;
  complete: boolean;
  doneMin: number;
  goalMin: number;
};

function WalksDialBase({ percent, complete, doneMin, goalMin }: Props) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent));

  // Arc sweep: progress shared value in [0,1] drives strokeDashoffset.
  const progress = useSharedValue(0);
  // Walking dog: a single looping driver in [0,1] for bob + tilt.
  const step = useSharedValue(0);

  useEffect(() => {
    const target = clamped / 100;
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [clamped, reduceMotion, progress]);

  useEffect(() => {
    if (reduceMotion) {
      step.value = 0.5;
      return;
    }
    step.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 360, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 360, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, step]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - progress.value),
  }));

  const dogStyle = useAnimatedStyle(() => {
    // step 0→1 maps to a small up-bob and a gentle fore/aft tilt.
    const lift = -6 * Math.sin(step.value * Math.PI);
    const tilt = (step.value - 0.5) * 10;
    return {
      transform: [{ translateY: lift }, { rotate: `${tilt}deg` }],
    };
  });

  const stops = complete
    ? [colors.leaf, colors.success]
    : [colors.amber, colors.brand];

  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`今日進度 ${Math.round(clamped)}%`}
    >
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <LinearGradient id="dialArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="1" stopColor={stops[1]} />
          </LinearGradient>
        </Defs>
        <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
          {/* track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.hairline}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* progress arc */}
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="url(#dialArc)"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            animatedProps={arcProps}
          />
        </G>
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Reanimated.Text style={[styles.dog, dogStyle]}>🐕</Reanimated.Text>
        <View style={[styles.pill, complete && { backgroundColor: colors.leafTint }]}>
          <Text style={[styles.pillDone, complete && { color: colors.leaf }]}>
            {Math.round(doneMin)}
          </Text>
          <Text style={styles.pillGoal}>{` / ${goalMin} 分`}</Text>
        </View>
      </View>
    </View>
  );
}

export const WalksDial = memo(WalksDialBase);

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dog: { fontSize: 64 },
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.brandTint,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pillDone: { fontSize: 22, fontWeight: "800", color: colors.brandDeep },
  pillGoal: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
});
