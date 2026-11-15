import { StyleSheet, Text, View } from "react-native";
import { WarmGlass } from "@/components/ui/WarmCanvas";
import { Bell, Home } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

export function HomeTopBar({
  familyName,
  userDisplayName,
}: {
  familyName?: string | null;
  userDisplayName?: string | null;
}) {
  const label = familyName ?? userDisplayName ?? null;
  return (
    <View style={styles.bar}>
      {/* Brand: 🥭 + locale-aware App.name ("芒果寵物") — the mango emoji is
          the visual hook, matching web. */}
      <Text style={styles.brand} numberOfLines={1}>
        <Text aria-hidden>🥭</Text> {t("App.name")}
      </Text>
      {label ? (
        <WarmGlass style={styles.pill}>
          <Home size={11} color={colors.brandDeep} strokeWidth={2.4} />
          <Text style={styles.pillLabel} numberOfLines={1}>
            {label}
          </Text>
        </WarmGlass>
      ) : null}
      <View style={styles.spacer} />
      <WarmGlass style={styles.bell}>
        <Bell accessibilityLabel={t("Home.notifications")} size={16} color={colors.ink2} strokeWidth={1.8} />
      </WarmGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44 + 10 + 18, // title row 44 like the other tabs
    paddingTop: 10,
    paddingBottom: 18,
    // iPad: aligned with the centred content column.
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  brand: {
    fontSize: 25,
    flexShrink: 1,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.ink,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 140,
    flexShrink: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillLabel: { flexShrink: 1, maxWidth: 140, fontSize: 12.5, fontWeight: "700", color: colors.ink2 },
  spacer: { flex: 1 },
  bell: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
