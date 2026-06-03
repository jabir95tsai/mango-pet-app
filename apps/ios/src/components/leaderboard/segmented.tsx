/**
 * Pill segmented control (P4a) — used for the dimension / scope / period tabs.
 * Self-contained, no dep. Generic over the option value. S4 polish: the active
 * white pill is a single sliding indicator that animates between segments
 * (Reanimated), reduced-motion snaps. Active segments now meet the 44pt tap
 * height (non-compact).
 */
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, spacing } from "@/theme/theme";

const PAD = 3;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [trackW, setTrackW] = useState(0);
  const x = useSharedValue(0);

  const cellW = trackW > 0 ? (trackW - PAD * 2) / options.length : 0;
  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  useEffect(() => {
    if (cellW <= 0) return;
    const target = PAD + activeIdx * cellW;
    x.value = reduceMotion
      ? target
      : withTiming(target, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [activeIdx, cellW, reduceMotion, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: cellW,
  }));

  return (
    <View style={styles.track} onLayout={onLayout}>
      {cellW > 0 ? (
        <Reanimated.View
          style={[
            styles.indicator,
            compact ? styles.indicatorCompact : styles.indicatorFull,
            indicatorStyle,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.seg, compact && styles.segCompact]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
    padding: PAD,
  },
  indicator: {
    position: "absolute",
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  indicatorFull: { top: PAD, height: 44 },
  indicatorCompact: { top: PAD, height: 30 },
  seg: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segCompact: { height: 30 },
  text: { fontSize: 13, fontWeight: "700", color: colors.ink3 },
  textOn: { color: colors.brandDeep },
});
