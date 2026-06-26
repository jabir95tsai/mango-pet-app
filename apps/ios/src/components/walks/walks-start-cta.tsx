/**
 * 「開始遛狗」sticky CTA — 1:1 with the web walks page mobile pill
 * (nav-cta-mango-v2 §2): a full-width 62px amber→brand→brandDeep gradient
 * capsule, a translucent-white Play badge, a white 19px extrabold label, and a
 * gloss band that sweeps the full width then parks ~2s (looping). Press
 * scale 0.97. Reduced-motion → no sweep.
 */
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play } from "lucide-react-native";
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { mangoGradient } from "@/theme/theme";

const BAND_W = 82;

export function WalksStartCta({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || width <= 0) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduceMotion, width, progress]);

  const sweepStyle = useAnimatedStyle(() => {
    // 0→0.52 sweeps left→right; 0.52→1 parks off the right edge (≈2s pause).
    const x = interpolate(
      progress.value,
      [0, 0.52, 1],
      [-BAND_W, width + BAND_W, width + BAND_W],
    );
    return { transform: [{ translateX: x }, { skewX: "-18deg" }] };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="開始遛狗"
      disabled={disabled}
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.shadow,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={mangoGradient.colors}
        locations={mangoGradient.locations}
        start={mangoGradient.start}
        end={mangoGradient.end}
        style={styles.pill}
      >
        {!reduceMotion && width > 0 ? (
          <Reanimated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.62)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Reanimated.View>
        ) : null}
        <View style={styles.badge}>
          <Play size={20} color="#ffffff" fill="#ffffff" />
        </View>
        <Text style={styles.label}>開始遛狗</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 31,
    shadowColor: "#f39800",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  pill: {
    height: 62,
    borderRadius: 31,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    overflow: "hidden",
  },
  sweep: {
    position: "absolute",
    top: -12,
    bottom: -12,
    width: BAND_W,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 19, fontWeight: "800", letterSpacing: 0.5, color: "#ffffff" },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.6 },
});
