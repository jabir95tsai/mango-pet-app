/**
 * Feed section header — 1:1 with apps/web/src/components/home/feed-section-header.tsx:
 * "最新動態" 15/800 + "家人 · 朋友" 12 ink3 on the left, an always-present
 * "查看全部 ›" link (12.5/700 brand-deep + ChevronRight 12) to the full feed.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

export function FeedSectionHeader({ onViewAll }: { onViewAll: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.titleWrap} numberOfLines={1}>
        <Text style={styles.title} accessibilityRole="header">
          {t("Home.feed.title")}
        </Text>
        <Text style={styles.subtitle}>{`  ${t("Home.feed.subtitle")}`}</Text>
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={onViewAll}
        hitSlop={10}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>{t("Home.feed.viewAll")}</Text>
        <ChevronRight size={12} color={colors.brandDeep} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: flex items-baseline justify-between gap-3 pt-2 pb-2.5
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 10,
  },
  titleWrap: { flexShrink: 1 },
  title: { fontSize: 15, fontWeight: "800", letterSpacing: -0.1, color: colors.ink },
  subtitle: { fontSize: 12, color: colors.ink3 },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 12.5, fontWeight: "700", color: colors.brandDeep },
  pressed: { opacity: 0.6 },
});
