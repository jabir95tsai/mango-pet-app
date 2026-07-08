/**
 * Button — 1:1 with the web Button (apps/web/src/components/ui/button.tsx).
 *
 * Variants mirror web exactly:
 *  - primary   → `.btn-mango`: amber→brand→brandDeep gradient + WHITE text +
 *                lifted mango shadow (globals.css .btn-mango). NOT ink-on-flat.
 *  - secondary → white fill, ink text, hairline border.
 *  - ghost     → transparent, ink2 text.
 *  - danger    → red fill, white text.
 *
 * Web sizes: sm h-8, md h-10, lg h-12, rounded-lg, active:scale-[0.99]. We keep
 * the 44pt min tap target as a native floor (doesn't change the look at md/lg).
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
import { LinearGradient } from "expo-linear-gradient";

import { colors, mangoGradient, radius, shadows, spacing } from "@/theme/theme";

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
  /** Pill radius (rounded-full) instead of web's rounded-lg — for the big CTAs. */
  pill?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 48 };

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
  const br = pill ? radius.pill : radius.lg;

  const inner = (
    <>
      {loading ? (
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
      )}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        fullWidth && styles.fullWidth,
        variant === "primary" && !isDisabled && shadows.mango,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={mangoGradient.colors}
          locations={mangoGradient.locations}
          start={mangoGradient.start}
          end={mangoGradient.end}
          style={[styles.base, { minHeight, borderRadius: br }]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.base, { minHeight, borderRadius: br, backgroundColor: v.bg }, v.border]}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}

const VARIANT: Record<
  ButtonVariant,
  { bg: string; fg: string; border?: ViewStyle }
> = {
  primary: { bg: "transparent", fg: "#ffffff" },
  secondary: {
    bg: colors.card,
    fg: colors.ink,
    border: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  },
  ghost: { bg: "transparent", fg: colors.ink2 },
  danger: { bg: "#dc2626", fg: "#ffffff" },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  fullWidth: { alignSelf: "stretch" },
  label: { fontSize: 14, fontWeight: "700" },
  labelLg: { fontSize: 16 },
  icon: { fontSize: 16 },
  pressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.7 },
});
