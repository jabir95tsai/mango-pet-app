/**
 * GlassTopBar — a thin frosted bar for screen headers. Sits above the page
 * gradient; content scrolls under it. Flat (no radius), with a bottom hairline.
 * Reduce-transparency → opaque warm bar (via GlassSurface).
 */
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { GlassSurface } from "./GlassSurface";
import { colors, spacing } from "@/theme/theme";

export function GlassTopBar({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface level="thin" radius={0} shadow={false} edge={false} style={style} contentStyle={styles.bar}>
      <View style={styles.hairline} pointerEvents="none" />
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
