/**
 * Button — the one CTA primitive for the iOS app (UX-0).
 *
 * Variants mirror the web button family:
 *  - primary   → mango.brand fill, ink label (white-on-orange fails AA — the
 *                visual-redesign spec uses ink #231B14 on brand, 5.2:1), shadow-mango.
 *  - secondary → brandTint fill, brandDeep label (light chip CTA).
 *  - ghost     → transparent, ink2 label (tertiary / cancel actions).
 *  - danger    → destructive red, used for delete/stop affordances.
 *
 * Guarantees the UX-0 a11y baseline: min 44pt tap target, button role, and a
 * pressed-state scale/opacity. No haptics — expo-haptics isn't installed and
 * the spec says skip it rather than add a dep.
 */
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radius, shadows, spacing } from "@/theme/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Leading glyph (emoji / single char), rendered before the label. */
  icon?: ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
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
  accessibilityLabel,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const v = VARIANT[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "lg" ? styles.lg : styles.md,
        { backgroundColor: v.bg },
        variant === "primary" && shadows.mango,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon != null ? <Text style={[styles.icon, { color: v.fg }]}>{icon}</Text> : null}
          <Text
            style={[styles.label, size === "lg" ? styles.labelLg : null, { color: v.fg }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const VARIANT: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.brand, fg: colors.ink },
  secondary: { bg: colors.brandTint, fg: colors.brandDeep },
  ghost: { bg: "transparent", fg: colors.ink2 },
  danger: { bg: "#e5484d", fg: colors.card },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
  },
  md: { minHeight: 44 },
  lg: { minHeight: 52, paddingHorizontal: spacing.xxl },
  fullWidth: { alignSelf: "stretch" },
  label: { fontSize: 15, fontWeight: "800" },
  labelLg: { fontSize: 16 },
  icon: { fontSize: 16 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
});
