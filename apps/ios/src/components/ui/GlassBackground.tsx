/**
 * GlassBackground — the warm mango gradient page canvas (cream → soft amber)
 * that gives the glass surfaces something to refract. Fills the screen behind
 * content. Safe under Reduce Transparency (it's an opaque gradient, not blur).
 */
import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { glassBgGradient } from "@/theme/theme";

export function GlassBackground({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={glassBgGradient.colors}
      locations={glassBgGradient.locations}
      start={glassBgGradient.start}
      end={glassBgGradient.end}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
