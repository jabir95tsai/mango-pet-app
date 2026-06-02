/**
 * Home top bar (P3a) — compact: family name (or user display name in personal
 * mode) on the left, a notification bell on the right. The unread-count badge is
 * intentionally not wired (no notification-center system yet — same as web v3).
 * Mirrors apps/web/src/components/home/home-top-bar.tsx.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme/theme";

export function HomeTopBar({
  familyName,
  userDisplayName,
  onOpenPhotos,
}: {
  familyName?: string | null;
  userDisplayName?: string | null;
  onOpenPhotos?: () => void;
}) {
  const title = familyName ?? userDisplayName ?? "Mango Pet";
  return (
    <View style={styles.bar}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        {onOpenPhotos ? (
          <Pressable
            accessibilityLabel="照片圖庫"
            onPress={onOpenPhotos}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.icon}>🖼️</Text>
          </Pressable>
        ) : null}
        <Text style={styles.icon} accessibilityLabel="通知">
          🔔
        </Text>
      </View>
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
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginLeft: spacing.md },
  icon: { fontSize: 20 },
  pressed: { opacity: 0.6 },
});
