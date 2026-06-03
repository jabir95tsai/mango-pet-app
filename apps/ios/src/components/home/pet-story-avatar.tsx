/**
 * Pet story slot (S2 polish) — pet avatar with a walk-status ring:
 *   done     → brand→leaf gradient stroke ring (goal met today)
 *   pending  → grey hairline track ring (needs walk)
 *   tracking → brand→cookie gradient stroke ring, pulsing (live session)
 *
 * Upgraded from a flat linear-gradient disc-behind-a-hole to a crisp SVG
 * stroked ring (react-native-svg, already a dep), matching the dial/donut SVG
 * convention and reading closer to the web conic ring. Tracking pulse respects
 * reduce-motion. Tap is a no-op for v1 (future: filter feed by pet).
 */
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import type { WalkStatus } from "@mango/shared-business";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { t } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const SIZE = 64;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const INNER = SIZE - 12;

const STATUS_HINT: Record<WalkStatus, string> = {
  done: "Home.stories.doneWalk",
  pending: "Home.stories.pendingWalk",
  tracking: "Home.stories.tracking",
};

export function PetStoryAvatar({
  name,
  photoURL,
  status,
}: {
  name: string;
  photoURL?: string;
  status: WalkStatus;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (status !== "tracking" || reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, reduceMotion, pulse]);

  const ringStops =
    status === "tracking"
      ? [colors.brand, colors.cookie]
      : [colors.brand, colors.leaf];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} · ${t(STATUS_HINT[status])}. ${t("Home.stories.filterFutureHint")}`}
      style={styles.wrap}
    >
      <View style={styles.ring}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            status === "tracking" ? { opacity: pulse } : null,
          ]}
        >
          <Svg width={SIZE} height={SIZE}>
            {status !== "pending" ? (
              <Defs>
                <LinearGradient id={`ring-${status}`} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={ringStops[0]} />
                  <Stop offset="1" stopColor={ringStops[1]} />
                </LinearGradient>
              </Defs>
            ) : null}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={status === "pending" ? colors.hairline : `url(#ring-${status})`}
              strokeWidth={STROKE}
            />
          </Svg>
        </Animated.View>
        <View style={styles.avatarHole}>
          <PetAvatar name={name} photoURL={photoURL} size={INNER} />
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: SIZE + 12 },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHole: {
    position: "absolute",
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    overflow: "hidden",
  },
  label: { marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink2 },
});
