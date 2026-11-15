/**
 * Circular-arrows refresh button — 1:1 with the web boards' RefreshCw icon
 * button (size-11 round, brand-deep, spins while refreshing). Sits at the
 * right of each board's title. The spin respects reduced-motion.
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import { RefreshCw } from "lucide-react-native";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { t } from "@/lib/i18n";
import { colors, radius } from "@/theme/theme";
import { WarmGlass } from "@/components/ui/WarmCanvas";

export function RefreshIconButton({
  refreshing,
  onPress,
}: {
  refreshing: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (refreshing && !reduceMotion) {
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => {
        loop.stop();
        spin.setValue(0);
      };
    }
    spin.setValue(0);
  }, [refreshing, reduceMotion, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <WarmGlass style={styles.glass}>
    <Pressable
      onPress={onPress}
      disabled={refreshing}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={t("Leaderboard.refreshButton")}
      style={({ pressed }) => [styles.btn, (pressed || refreshing) && styles.dim]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={17} color={colors.brandDeep} strokeWidth={2} />
      </Animated.View>
    </Pressable>
    </WarmGlass>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  // same glass control as the Home bell
  glass: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" },
  dim: { opacity: 0.6 },
  icon: { fontSize: 22, fontWeight: "700", color: colors.brandDeep },
});
