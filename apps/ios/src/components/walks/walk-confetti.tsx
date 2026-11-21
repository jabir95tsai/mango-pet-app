/**
 * Goal-hit confetti for the walk done screen — 1:1 with web
 * `.walk-confetti` (apps/web/src/app/globals.css + walk-tracking-view.tsx):
 * 20 slivers of 8×14, radius 2, left = (i·53 % 100)%, delay (i % 5)·120ms,
 * 2.4s ease-in fall to 110% of the viewport height with a 720° turn, fading in
 * over the first 10% and out at the end. The layer is clipped to its parent
 * (web: absolute inset-0 overflow-hidden inside the headline block).
 * iOS differences: mango + celebration palette (no green), optional `count`,
 * wider stagger, and the done screen mounts it over the whole screen.
 *
 * Reduced motion (docs/design-system.md §5, hard rule): web hides the whole
 * layer (`display: none`), so we render nothing — no static slivers.
 *
 * Also exports `StreakPop` — the web `.walk-streak-pop` (0.6s scale
 * 1 → 1.25 → 1 on mount), skipped under reduced motion.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useReducedMotion } from "@/lib/use-reduced-motion";

// Gold / mango + celebration colours (design-system §1: peach / pink / sky only as
// confetti decoration). No green: it clashed with the warm done screen.
const PALETTE = ["#d6a03a", "#f3d27a", "#f39800", "#ffb4a2", "#f7a8c8", "#9fd3f5"];
const COUNT = 20;
const DURATION_MS = 2400;

export function WalkConfetti({ width, count = COUNT }: { width?: number; count?: number } = {}) {
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const progress = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion) return;
    const anims = progress.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: DURATION_MS,
        delay: (i % 8) * 140,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [progress, reduceMotion]);

  if (reduceMotion) return null;

  const layerWidth = width ?? measured;
  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={width === undefined ? onLayout : undefined}
    >
      {layerWidth > 0
        ? progress.map((v, i) => {
            const translateY = v.interpolate({
              inputRange: [0, 1],
              outputRange: [0, windowHeight * 1.1],
            });
            const rotate = v.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "720deg"],
            });
            const opacity = v.interpolate({
              inputRange: [0, 0.1, 1],
              outputRange: [0, 1, 0],
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.piece,
                  {
                    left: (((i * 53) % 100) / 100) * layerWidth,
                    width: i % 3 === 0 ? 6 : 8,
                    height: i % 3 === 0 ? 18 : 14,
                    backgroundColor: PALETTE[i % PALETTE.length],
                    opacity,
                    transform: [{ translateY }, { rotate }],
                  },
                ]}
              />
            );
          })
        : null}
    </View>
  );
}

/** Web `.walk-streak-pop`: scale 1 → 1.25 (40%) → 1 over 0.6s, once. */
export function StreakPop({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.25,
        duration: 240,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, scale]);

  return (
    <Animated.View style={[style, reduceMotion ? null : { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  piece: {
    position: "absolute",
    // web top: -10% of the layer — pieces enter from just above it.
    top: -14,
    width: 8,
    height: 14,
    borderRadius: 2,
  },
});
