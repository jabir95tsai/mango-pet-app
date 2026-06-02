/**
 * Pet story slot (P3a) — pet avatar with a walk-status ring:
 *   done     → brand→leaf linear-gradient ring (goal met today)
 *   pending  → grey hairline ring (needs walk)
 *   tracking → brand→cookie gradient ring, pulsing (live session)
 * (Web uses a conic gradient; a precise conic/SVG-stroke ring is a P3c polish.
 * The linear-gradient ring here uses an already-installed dep.)
 *
 * Tap is a no-op for v1 (future: filter feed by pet) with an aria hint, mirroring
 * apps/web/src/components/home/pet-story-avatar.tsx.
 */
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { WalkStatus } from "@mango/shared-business";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { t } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const SIZE = 64;
const INNER = SIZE - 8;

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
  const [reduceMotion, setReduceMotion] = useState(false);

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

  const ringInner =
    status === "pending" ? (
      <View style={styles.pendingRing} />
    ) : (
      <Animated.View style={{ opacity: status === "tracking" ? pulse : 1 }}>
        <LinearGradient
          colors={
            status === "tracking"
              ? [colors.brand, colors.cookie]
              : [colors.brand, colors.leaf]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientRing}
        />
      </Animated.View>
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} · ${t(STATUS_HINT[status])}. ${t("Home.stories.filterFutureHint")}`}
      style={styles.wrap}
    >
      <View style={styles.ring}>
        {ringInner}
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
  gradientRing: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  pendingRing: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.bgAlt,
  },
  avatarHole: {
    position: "absolute",
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    borderWidth: 2,
    borderColor: colors.card,
    overflow: "hidden",
  },
  label: { marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink2 },
});
