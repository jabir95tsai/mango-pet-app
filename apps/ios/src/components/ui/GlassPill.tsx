/**
 * GlassPill — small thin-glass chip for stats / tags / toggles. Pill radius,
 * thin blur. Becomes a button when `onPress` is set (≥pill tap area via hitSlop
 * on the row). Reduce-transparency → opaque warm chip (via GlassSurface).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { GlassSurface } from "./GlassSurface";
import { colors, glassRadius, spacing } from "@/theme/theme";

export function GlassPill({
  label,
  icon,
  onPress,
  selected = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <GlassSurface
      level="thin"
      radius={glassRadius.pill}
      shadow={false}
      contentStyle={[styles.body, selected && styles.selected]}
    >
      {icon != null ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </GlassSurface>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected }}
        onPress={onPress}
        hitSlop={8}
        style={[styles.wrap, style]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.wrap, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start" },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minHeight: 30,
  },
  selected: { backgroundColor: "rgba(243,152,0,0.22)" },
  icon: { marginRight: 1 },
  label: { fontSize: 12, fontWeight: "700", color: colors.ink },
  labelSelected: { color: colors.brandDeep },
});
