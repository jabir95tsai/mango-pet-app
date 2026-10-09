/**
 * Button — 1:1 with the web Button (apps/web/src/components/ui/button.tsx).
 *
 * Variants mirror web exactly:
 *  - primary   → `.btn-mango`: amber→brand→brandDeep gradient + WHITE text +
 *                lifted mango shadow (globals.css .btn-mango). NOT ink-on-flat.
 *  - secondary → white fill, ink text, 1px hairline border.
 *  - ghost     → transparent, ink2 text.
 *  - danger    → red fill, white text.
 *
 * Web sizes: sm `h-8 px-3 text-sm`, md `h-10 px-4 text-sm`, lg `h-12 px-6
 * text-base`, all `rounded-lg` (8px) + `font-medium` + `gap-2`. Horizontal
 * padding is per size like web; heights keep a native tap floor (sm 36 plus a
 * hitSlop that makes up the 44pt target, md 44, lg 48).
 *
 * Press feedback follows docs/design-system.md §4 (`active:scale-[.97]`) and is
 * dropped under Reduce Motion (§5 hard rule); only the opacity dip remains.
 *
 * `icon` accepts a lucide component (`icon={Plus}`, rendered at the label size
 * in the variant's text colour), an element (`icon={<Plus />}`; a colour is
 * injected unless the element sets one), or a string (emoji). It is rendered
 * in a View, never nested inside <Text>.
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { renderIconSlot, type IconSlot } from "./icon-slot";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, mangoGradient, radius, shadows, spacing } from "@/theme/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Lucide component, element, or emoji string (see file header). */
  icon?: IconSlot;
  /** Render the icon after the label instead of before it. */
  iconPosition?: "start" | "end";
  fullWidth?: boolean;
  /** Pill radius (rounded-full) instead of web's rounded-lg — for the big CTAs. */
  pill?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Escape hatch for bespoke CTAs (e.g. the 800-weight hero pill). */
  labelStyle?: StyleProp<TextStyle>;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 48 };
// web px-3 / px-4 / px-6
const PAD_X: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 24 };
// web text-sm / text-sm / text-base
const FONT: Record<ButtonSize, number> = { sm: 14, md: 14, lg: 16 };
// web icons inside buttons are `size-4` (16); lg CTAs use 18.
const ICON: Record<ButtonSize, number> = { sm: 16, md: 16, lg: 18 };
// sm is 36pt tall — extend the touch area to the 44pt floor.
const HIT_SLOP: Record<ButtonSize, Insets | undefined> = {
  sm: { top: 4, bottom: 4, left: 2, right: 2 },
  md: undefined,
  lg: undefined,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "start",
  fullWidth = false,
  pill = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  labelStyle,
}: ButtonProps) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;
  const v = VARIANT[variant];
  const box: ViewStyle = {
    minHeight: HEIGHT[size],
    paddingHorizontal: PAD_X[size],
    borderRadius: pill ? radius.pill : radius.sm,
  };

  const iconNode =
    icon != null ? <View style={styles.iconBox}>{renderIconSlot(icon, v.fg, ICON[size])}</View> : null;

  const inner = loading ? (
    <ActivityIndicator color={v.fg} />
  ) : (
    <>
      {iconPosition === "start" ? iconNode : null}
      <Text
        style={[styles.label, { fontSize: FONT[size], color: v.fg }, labelStyle]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {iconPosition === "end" ? iconNode : null}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={HIT_SLOP[size]}
      testID={testID}
      style={({ pressed }) => [
        fullWidth && styles.fullWidth,
        variant === "primary" && !isDisabled && shadows.mango,
        pressed && !isDisabled && (reduceMotion ? styles.pressedStatic : styles.pressed),
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
          style={[styles.base, box]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.base, box, { backgroundColor: v.bg }, v.border]}>{inner}</View>
      )}
    </Pressable>
  );
}

const VARIANT: Record<ButtonVariant, { bg: string; fg: string; border?: ViewStyle }> = {
  primary: { bg: "transparent", fg: "#ffffff" },
  secondary: {
    bg: colors.card,
    fg: colors.ink,
    border: { borderWidth: 1, borderColor: colors.hairline },
  },
  ghost: { bg: "transparent", fg: colors.ink2 },
  danger: { bg: colors.danger, fg: "#ffffff" },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    overflow: "hidden",
  },
  fullWidth: { alignSelf: "stretch" },
  // web font-medium
  label: { fontWeight: "500", flexShrink: 1 },
  iconBox: { alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  pressedStatic: { opacity: 0.85 },
  disabled: { opacity: 0.7 },
});
