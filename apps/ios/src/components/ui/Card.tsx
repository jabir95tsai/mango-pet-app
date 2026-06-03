/**
 * Card — white surface on the cream bg, the standard content container (UX-0).
 * Mirrors the web `.card` (white fill, hairline border, soft warm drop shadow).
 * `tone="soft"` switches to the cardSoft cream variant used by docked bars.
 */
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadows, spacing } from "@/theme/theme";

type Props = {
  children: ReactNode;
  tone?: "card" | "soft";
  /** Apply the resting card drop shadow. Default true. */
  elevated?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  tone = "card",
  elevated = true,
  padded = true,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: tone === "soft" ? colors.cardSoft : colors.card },
        padded && styles.padded,
        elevated && shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  padded: { padding: spacing.lg },
});
