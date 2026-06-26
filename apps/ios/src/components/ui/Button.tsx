/**
 * Button — Liquid Glass control. Per the 2026-06-26 direction call, the glass
 * material lives ONLY on buttons; every other surface stays solid mango. So the
 * button is a frosted glass pill (GlassSurface → BlurView + micro-light specular
 * edge) with a per-variant tint:
 *   primary → warm mango-amber tint, ink label (the brand CTA)
 *   secondary → clear glass, ink label
 *   ghost → no surface, ink-2 label (tertiary)
 *   danger → red tint, deep-red label
 *
 * GlassSurface handles the a11y / capability fallbacks: Reduce Transparency OR a
 * build without expo-blur native → an opaque warm panel (the tint still applies,
 * so primary still reads amber). 44pt min tap target kept.
 */
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { GlassSurface } from "./GlassSurface";
import { colors, glassRadius, radius as radii, spacing } from "@/theme/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Pill radius instead of the rounded-rect default — for the big CTAs. */
  pill?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 48 };

const VARIANT: Record<ButtonVariant, { tint: string; fg: string }> = {
  primary: { tint: "rgba(243,152,0,0.34)", fg: colors.ink },
  secondary: { tint: "transparent", fg: colors.ink },
  ghost: { tint: "transparent", fg: colors.ink2 },
  danger: { tint: "rgba(220,38,38,0.32)", fg: "#7f1d1d" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  pill = false,
  accessibilityLabel,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const v = VARIANT[variant];
  const minHeight = HEIGHT[size];
  const br = pill ? glassRadius.pill : radii.md;

  const inner = loading ? (
    <ActivityIndicator color={v.fg} />
  ) : (
    <>
      {icon != null ? <Text style={[styles.icon, { color: v.fg }]}>{icon}</Text> : null}
      <Text
        style={[styles.label, size === "lg" && styles.labelLg, { color: v.fg }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  const content = [styles.row, { minHeight }];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === "ghost" ? (
        <View style={[content, { borderRadius: br }]}>{inner}</View>
      ) : (
        <GlassSurface level="regular" radius={br} contentStyle={content}>
          {v.tint !== "transparent" ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: v.tint }]} />
          ) : null}
          {inner}
        </GlassSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  fullWidth: { alignSelf: "stretch" },
  label: { fontSize: 14, fontWeight: "800" },
  labelLg: { fontSize: 16 },
  icon: { fontSize: 16 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
});
