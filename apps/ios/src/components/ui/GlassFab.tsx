/**
 * GlassFab — a floating circular action button: a thick-glass ring with a
 * mango-gradient core (the same btn-mango family) holding an icon. Mirrors the
 * raised walks disc / pets ＋ FAB but in the glass material. Reduce-transparency
 * → the glass ring becomes an opaque warm ring (the gradient core stays).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GlassSurface } from "./GlassSurface";
import { mangoGradient } from "@/theme/theme";

export function GlassFab({
  icon,
  onPress,
  size = 60,
  coreInset = 6,
  accessibilityLabel,
  style,
}: {
  icon: ReactNode;
  onPress?: () => void;
  size?: number;
  coreInset?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const coreSize = size - coreInset * 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed, style]}
    >
      <GlassSurface
        level="thick"
        radius={size / 2}
        contentStyle={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <LinearGradient
          colors={mangoGradient.colors}
          locations={mangoGradient.locations}
          start={mangoGradient.start}
          end={mangoGradient.end}
          style={[styles.core, { width: coreSize, height: coreSize, borderRadius: coreSize / 2 }]}
        >
          {icon}
        </LinearGradient>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center" },
  core: { alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
});
