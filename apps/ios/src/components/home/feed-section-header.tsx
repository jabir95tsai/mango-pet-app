/**
 * Feed section header (P3a) — "最新動態 · 家人 · 朋友" + a "查看更多" link that
 * pushes the full feed. Mirrors apps/web/src/components/home/feed-section-header.tsx.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

export function FeedSectionHeader({ onViewAll }: { onViewAll?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{t("Home.feed.title")}</Text>
        <Text style={styles.subtitle}>{t("Home.feed.subtitle")}</Text>
      </View>
      {onViewAll ? (
        <Pressable
          accessibilityRole="link"
          onPress={onViewAll}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.link}>{t("Home.feed.viewAll")} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleWrap: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 12, color: colors.ink3 },
  link: { fontSize: 14, fontWeight: "700", color: colors.brandDeep },
  pressed: { opacity: 0.6 },
});
