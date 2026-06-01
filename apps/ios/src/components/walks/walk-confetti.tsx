/**
 * Hand-rolled confetti for the goal-hit done screen — NO animation library
 * (web's is pure-CSS slivers; we add no native dep). 20 slivers fall + rotate +
 * fade once. Respects reduce-motion (AccessibilityInfo) → static slivers.
 * Decorative only: accessibilityElementsHidden / importantForAccessibility.
 */
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";

const PALETTE = ["#f59e0b", "#10b981", "#fbbf24", "#34d399", "#fde68a"];
const COUNT = 20;
const FALL_HEIGHT = 360;

export function WalkConfetti({ width = 320 }: { width?: number }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(Array.from({ length: COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(v);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const anims = progress.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        delay: (i % 5) * 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    Animated.stagger(40, anims).start();
  }, [progress, reduceMotion]);

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {progress.map((v, i) => {
        const left = ((i * 53) % 100) / 100 * width;
        const color = PALETTE[i % PALETTE.length];
        const translateY = v.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, FALL_HEIGHT],
        });
        const rotate = v.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${(i % 2 ? 1 : -1) * 540}deg`],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left,
                backgroundColor: color,
                opacity: reduceMotion ? 0.9 : opacity,
                transform: reduceMotion ? [] : [{ translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  piece: {
    position: "absolute",
    top: 0,
    width: 7,
    height: 12,
    borderRadius: 2,
  },
});
