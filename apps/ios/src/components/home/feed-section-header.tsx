import { StyleSheet, Text } from "react-native";

import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

export function FeedSectionHeader() {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {t("Home.feed.title")}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.1,
    color: colors.ink,
    paddingTop: spacing.sm,
    paddingBottom: 10,
  },
});
