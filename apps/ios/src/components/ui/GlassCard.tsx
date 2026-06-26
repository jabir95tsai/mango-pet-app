/**
 * GlassCard — the glass content container (replaces Card on glassified screens).
 * Regular-level frosted pane, continuous 24-radius, padded by default. Falls
 * back to an opaque warm card under Reduce Transparency (via GlassSurface).
 */
import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { GlassSurface } from "./GlassSurface";
import { glassRadius, spacing, type GlassLevel } from "@/theme/theme";

export function GlassCard({
  children,
  level = "regular",
  padded = true,
  radius = glassRadius.card,
  style,
  contentStyle,
}: {
  children?: ReactNode;
  level?: GlassLevel;
  padded?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface
      level={level}
      radius={radius}
      style={style}
      contentStyle={[padded && styles.padded, contentStyle]}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  padded: { padding: spacing.lg },
});
