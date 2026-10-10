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
// web: size-16 ring, p-[2.5px] gradient → p-[2px] cream pad → 54 avatar
const STROKE = 2.5;
const R = (SIZE - STROKE) / 2;
const PAD = SIZE - STROKE * 2;
const INNER = 54;

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

  // web conic stops: done brand→leaf→leaf-tint→brand; tracking brand→cookie→brand
  const ringStops =
    status === "tracking"
      ? [colors.brand, colors.cookie, colors.brand]
      : [colors.brand, colors.leaf, colors.leafTint, colors.brand];

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
                  {ringStops.map((c, i) => (
                    <Stop key={i} offset={i / (ringStops.length - 1)} stopColor={c} />
                  ))}
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
        <View style={styles.pad} />
        <View style={styles.avatarHole}>
          <PetAvatar name={name} photoURL={photoURL} size={INNER} />
        </View>
      </View>
      <Text style={[styles.label, status === "done" ? styles.labelDone : styles.labelTodo]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: 68 },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // Cream pad between ring and avatar so the ring floats on any surface.
  pad: {
    position: "absolute",
    width: PAD,
    height: PAD,
    borderRadius: PAD / 2,
    backgroundColor: colors.bg,
  },
  avatarHole: {
    position: "absolute",
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    overflow: "hidden",
  },
  // web: max-w-[68px] text-[11.5px] tracking-[-0.1px]; done 600 ink-2, else 700 ink
  label: { marginTop: 6, maxWidth: 68, fontSize: 11.5, letterSpacing: -0.1 },
  labelDone: { fontWeight: "600", color: colors.ink2 },
  labelTodo: { fontWeight: "700", color: colors.ink },
});
