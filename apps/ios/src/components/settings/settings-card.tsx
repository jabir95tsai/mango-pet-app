/**
 * SettingsCard — the web settings `<section>` shell: rounded-[var(--radius-xl)]
 * border-mango-hairline bg-mango-card p-6 shadow-card (settings/page.tsx).
 * Every settings section renders inside one so the stack reads uniformly.
 */
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadows, spacing } from "@/theme/theme";

export function SettingsCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** 36pt brand-tint icon tile used by section headers (web size-9 rounded-md). */
export function SettingsIconDisc({ children }: { children: ReactNode }) {
  return (
    <View
      style={styles.disc}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </View>
  );
}

export const settingsText = StyleSheet.create({
  // web: text-sm font-semibold
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  // web: font-semibold at the base size (privacy / danger headers)
  titleLg: { fontSize: 16, fontWeight: "600", color: colors.ink },
  // web: text-xs text-mango-ink-2
  sub: { fontSize: 12, lineHeight: 17, color: colors.ink2 },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  error: { fontSize: 12, color: colors.danger },
  // web: text-emerald-700
  success: { fontSize: 12, color: "#047857" },
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.xl,
    ...shadows.card,
  },
  disc: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
