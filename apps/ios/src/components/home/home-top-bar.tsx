/**
 * Home top bar — 1:1 with apps/web/src/components/home/home-top-bar.tsx.
 * Left cluster: 🥭 + brand title (App.name "芒果寵物") + a family/user pill
 * (home glyph + name). Right: a single notification bell inside a white
 * circle (the unread-count badge is intentionally not wired — no
 * notification-center system yet, same as web v3). The photo-frame icon the
 * iOS bar used to carry is gone — photos live in Settings (web parity).
 */
import { StyleSheet, Text, View } from "react-native";
import { Bell, Home } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

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
        <View style={styles.pill}>
          <Home size={13} color={colors.ink2} strokeWidth={2} />
          <Text style={styles.pillLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
      <View style={styles.spacer} />
      <View style={styles.bell} accessibilityLabel="通知" accessibilityRole="button">
        <Bell size={18} color={colors.ink2} strokeWidth={1.8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  brand: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.ink,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 168,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillIcon: { fontSize: 11 },
  pillLabel: { flexShrink: 1, fontSize: 12.5, fontWeight: "700", color: colors.ink2 },
  spacer: { flex: 1 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: { fontSize: 18 },
});
