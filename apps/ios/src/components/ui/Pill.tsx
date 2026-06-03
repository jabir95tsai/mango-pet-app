/**
 * Pill — small rounded-full chip for tags, stats, and filter toggles (UX-0).
 * Tones map to the mango accent tints. When `onPress` is set it becomes a
 * button (selectable filter chip); otherwise it's a static label.
 */
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "@/theme/theme";

export type PillTone =
  | "brand"
  | "neutral"
  | "leaf"
  | "peach"
  | "bell"
  | "cookie";

type Props = {
  label: string;
  tone?: PillTone;
  /** Filled = solid accent bg; soft (default) = tint bg. */
  filled?: boolean;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const TONE: Record<PillTone, { tint: string; solid: string; fg: string; fgOn: string }> = {
  brand: { tint: colors.brandTint, solid: colors.brand, fg: colors.brandDeep, fgOn: colors.ink },
  neutral: { tint: colors.bgAlt, solid: colors.ink2, fg: colors.ink2, fgOn: colors.card },
  leaf: { tint: colors.leafTint, solid: colors.leaf, fg: "#3f7a39", fgOn: colors.card },
  peach: { tint: colors.peachTint, solid: colors.peach, fg: colors.cookie, fgOn: colors.ink },
  bell: { tint: colors.bellTint, solid: colors.amber, fg: colors.ink2, fgOn: colors.ink },
  cookie: { tint: colors.cookieTint, solid: colors.cookie, fg: colors.cookie, fgOn: colors.card },
};

export function Pill({
  label,
  tone = "brand",
  filled = false,
  selected = false,
  onPress,
  icon,
  accessibilityLabel,
  style,
}: Props) {
  const t = TONE[tone];
  const on = filled || selected;
  const content = (
    <>
      {icon != null ? <Text style={[styles.icon, { color: on ? t.fgOn : t.fg }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: on ? t.fgOn : t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const boxStyle = [
    styles.base,
    { backgroundColor: on ? t.solid : t.tint },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected }}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [boxStyle, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={boxStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  label: { fontSize: 12, fontWeight: "700" },
  icon: { fontSize: 12 },
  pressed: { opacity: 0.8 },
});
