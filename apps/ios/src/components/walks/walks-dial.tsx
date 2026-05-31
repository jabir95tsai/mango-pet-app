/**
 * Radial walk dial — today's progress as a segmented ring (no SVG so we add no
 * native dependency; spec ios-p1-walks forbids new deps without a backend
 * branch+gate). 60 tick segments sweep clockwise from 12 o'clock; the filled
 * count is proportional to percent. The exact arc-fill / Reanimated walking-dog
 * animation is an iOS UI/UX follow-up (ship note); P1a is function-first.
 *
 * Center: the 走路狗 (static for P1a) + a {done}/{goal} 分 pill.
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/theme/theme";

const SIZE = 232;
const SEGMENTS = 60;
const BAR_W = 4;
const BAR_H = 16;

type Props = {
  percent: number;
  complete: boolean;
  doneMin: number;
  goalMin: number;
};

function WalksDialBase({ percent, complete, doneMin, goalMin }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filledCount = Math.round((clamped / 100) * SEGMENTS);
  const fillColor = complete ? colors.leaf : colors.brand;

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={`今日進度 ${clamped}%`}>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const angle = i * (360 / SEGMENTS);
        const filled = i < filledCount;
        return (
          <View
            key={i}
            style={[styles.segmentWrap, { transform: [{ rotate: `${angle}deg` }] }]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.bar,
                { backgroundColor: filled ? fillColor : colors.hairline },
              ]}
            />
          </View>
        );
      })}

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.dog}>🐕</Text>
        <View
          style={[
            styles.pill,
            complete && { backgroundColor: colors.leafTint },
          ]}
        >
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
  segmentWrap: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    alignItems: "center",
  },
  bar: {
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_W / 2,
    marginTop: 2,
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
