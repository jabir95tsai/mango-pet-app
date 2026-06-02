/**
 * Home top bar (P3a) — compact: family name (or user display name in personal
 * mode) on the left, a notification bell on the right. The unread-count badge is
 * intentionally not wired (no notification-center system yet — same as web v3).
 * Mirrors apps/web/src/components/home/home-top-bar.tsx.
 */
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme/theme";

export function HomeTopBar({
  familyName,
  userDisplayName,
}: {
  familyName?: string | null;
  userDisplayName?: string | null;
}) {
  const title = familyName ?? userDisplayName ?? "Mango Pet";
  return (
    <View style={styles.bar}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.bell} accessibilityLabel="通知">
        🔔
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.ink },
  bell: { fontSize: 20, marginLeft: spacing.md },
});
