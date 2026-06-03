/**
 * 4-tab pill bar (概覽 / 提醒 / 開銷 / 健康) — hand-rolled, no react-native-
 * tab-view (D-tab decision: web is also a pill bar with no swipe). S3 polish:
 * the active white card pill is now a single sliding indicator that animates
 * between tabs (Reanimated), instead of toggling per-tab background. Reduced-
 * motion snaps without sliding. Mirrors web pet-tabs.
 */
import { useEffect, useState } from "react";
import {
  StyleSheet,
  Pressable,
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
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");
const PAD = 4;

export const PET_TABS = ["overview", "reminders", "expenses", "health"] as const;
export type PetTabKey = (typeof PET_TABS)[number];

export function PetTabs({
  active,
  onChange,
}: {
  active: PetTabKey;
  onChange: (tab: PetTabKey) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [barW, setBarW] = useState(0);
  const x = useSharedValue(0);

  const cellW = barW > 0 ? (barW - PAD * 2) / PET_TABS.length : 0;
  const activeIdx = PET_TABS.indexOf(active);

  const onLayout = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  // Keep the indicator under the active tab as width/active changes.
  useEffect(() => {
    if (cellW <= 0) return;
    const target = PAD + activeIdx * cellW;
    x.value = reduceMotion
      ? target
      : withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [activeIdx, cellW, reduceMotion, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: cellW,
  }));

  return (
    <View style={styles.bar} onLayout={onLayout}>
      {cellW > 0 ? (
        <Reanimated.View style={[styles.indicator, indicatorStyle]} />
      ) : null}
      {PET_TABS.map((key) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tPP(`tabs.${key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    padding: PAD,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
  },
  indicator: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    shadowColor: colors.paw,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    minHeight: 44,
    borderRadius: radius.pill,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink3 },
  labelActive: { color: colors.ink, fontWeight: "800" },
});
