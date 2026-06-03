/**
 * Top-bar streak chip — 1:1 with apps/web/src/components/walks/streak-chip.tsx.
 * Three tiers: 0-2 muted text only; 3-6 amber→brand-tint gradient + brand-deep
 * text; ≥7 leaf gradient + leaf-deep text. Gradient flame SVG flickers
 * (scale+rotate), paused under reduced-motion. Flame is a11y-hidden.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGrad, Path, Stop } from "react-native-svg";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors } from "@/theme/theme";

function Flame() {
  return (
    <Svg width={16} height={18} viewBox="0 0 24 28">
      <Defs>
        <SvgGrad id="streakFlame" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffd84a" />
          <Stop offset="0.55" stopColor="#ff8a1a" />
          <Stop offset="1" stopColor="#e63a1a" />
        </SvgGrad>
      </Defs>
      <Path
        d="M12 2C12 6 8 8 6 12c-2 4-2 9 2 12 1.5 1 3.5 1.7 4 1.7s2.5-.7 4-1.7c4-3 4-8 2-12-1-2-3-3-3-5 0 1.5-1 2.5-2 2.5C12 9.5 12 6 12 2z"
        fill="url(#streakFlame)"
      />
      <Path
        d="M12 14c-1 1.5-2 3-2 5 0 2 1 3.5 2 3.5s2-1.5 2-3.5c0-2-1-3.5-2-5z"
        fill="#ffec8a"
        opacity={0.8}
      />
    </Svg>
  );
}

export function WalksStreakChip({ streakDays }: { streakDays: number }) {
  const reduceMotion = useReducedMotion();
  const tier = streakDays >= 7 ? "leaf" : streakDays >= 3 ? "brand" : "muted";
  const flick = useSharedValue(0);

  useEffect(() => {
    if (tier === "muted" || reduceMotion) {
      flick.value = 0;
      return;
    }
    flick.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 550, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [tier, reduceMotion, flick]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + flick.value * 0.12 },
      { rotate: `${-2 + flick.value * 5}deg` },
    ],
  }));

  if (tier === "muted") {
    return (
      <View style={styles.muted}>
        <Text style={styles.mutedText}>{`${streakDays} 天`}</Text>
      </View>
    );
  }

  const isLeaf = tier === "leaf";
  return (
    <LinearGradient
      colors={isLeaf ? ["#e7f2dc", "#d8f2de"] : ["#ffdca0", "#ffe7bf"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.chip, isLeaf ? styles.shadowLeaf : styles.shadowBrand]}
    >
      <Reanimated.View style={flameStyle} accessibilityElementsHidden importantForAccessibility="no">
        <Flame />
      </Reanimated.View>
      <Text style={[styles.text, { color: isLeaf ? "#3f8a3a" : colors.brandDeep }]}>
        {`${streakDays} 天`}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  muted: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  mutedText: { fontSize: 12, fontWeight: "600", color: colors.ink2, fontVariant: ["tabular-nums"] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  shadowBrand: {
    shadowColor: colors.brand,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shadowLeaf: {
    shadowColor: "#3f8a3a",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
