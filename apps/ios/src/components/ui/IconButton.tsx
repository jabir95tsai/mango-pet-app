/**
 * IconButton — icon-only round button (web's recurring
 * `grid size-9/size-10 place-items-center rounded-full|rounded-lg` + lucide
 * `size-5` pattern, e.g. dialog X, drawer close, friends QR, feed compose).
 *
 * `accessibilityLabel` is REQUIRED (icon-only control; XCUT-16). The visual
 * box defaults to 40pt; a hitSlop always tops the touch target up to 44pt.
 *
 * Tones:
 *  - neutral → card fill + 1px hairline border, ink icon
 *  - brand   → brandTint fill, brandDeep icon
 *  - danger  → transparent, danger icon (pressed: peachTint)
 *  - ghost   → transparent, ink2 icon (pressed: bgAlt)   ← default
 *
 * Press feedback: background/opacity only, plus scale .97 unless Reduce Motion.
 */
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius } from "@/theme/theme";

export type IconButtonTone = "neutral" | "brand" | "danger" | "ghost";

export type IconButtonProps = {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Visual box size (default 40). The touch target is always ≥ 44. */
  size?: number;
  /** Glyph size (default round(size × 0.5) → 20 for 40). */
  iconSize?: number;
  tone?: IconButtonTone;
  /** Overrides the tone's icon colour. */
  color?: string;
  /** Fill the glyph (e.g. a solid heart / paw). */
  filled?: boolean;
  shape?: "circle" | "rounded";
  disabled?: boolean;
  /** Toggle buttons: announced as selected. */
  selected?: boolean;
  /** Small dot badge at the top-right (e.g. unread). */
  badge?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const TONE: Record<
  IconButtonTone,
  { bg: string; pressedBg: string; fg: string; border?: ViewStyle }
> = {
  neutral: {
    bg: colors.card,
    pressedBg: colors.cardSoft,
    fg: colors.ink,
    border: { borderWidth: 1, borderColor: colors.hairline },
  },
  brand: { bg: colors.brandTint, pressedBg: colors.bellTint, fg: colors.brandDeep },
  danger: { bg: "transparent", pressedBg: colors.peachTint, fg: colors.danger },
  ghost: { bg: "transparent", pressedBg: colors.bgAlt, fg: colors.ink2 },
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 40,
  iconSize,
  tone = "ghost",
  color,
  filled = false,
  shape = "circle",
  disabled = false,
  selected,
  badge = false,
  testID,
  style,
}: IconButtonProps) {
  const reduceMotion = useReducedMotion();
  const t = TONE[tone];
  const fg = color ?? t.fg;
  const glyph = iconSize ?? Math.round(size * 0.5);
  const slop = Math.max(0, Math.ceil((44 - size) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={slop}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : radius.sm,
          backgroundColor: pressed && !disabled ? t.pressedBg : t.bg,
        },
        t.border,
        pressed && !disabled && !reduceMotion && styles.pressedScale,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon size={glyph} color={fg} strokeWidth={2} fill={filled ? fg : "none"} />
      {badge ? <View style={styles.badge} pointerEvents="none" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  pressedScale: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
});
