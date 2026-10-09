/**
 * Guest upgrade card (SETTINGS-18) — 1:1 with the web settings entry
 * (apps/web/src/app/app/settings/page.tsx "Persistent guest-upgrade entry"):
 * Sparkles + Guest.settings.title, the body line and a primary
 * Guest.upgradeCta button that opens the shared bind dialog
 * (GuestUpgradeProvider in app/_layout.tsx). The link / conflict / error
 * handling lives in the provider so the nudge banner and the locked notices
 * behave identically. Render only for anonymous users (settings.tsx gates it).
 */
import { StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { Button } from "@/components/ui";
import { useGuestUpgrade } from "@/components/auth/guest-upgrade";
import { withAlpha } from "@/components/auth/color";
import { t, useLocale } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function GuestUpgradeSection() {
  useLocale();
  const { openUpgrade } = useGuestUpgrade();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Sparkles size={20} color={colors.brandDeep} strokeWidth={2} />
        <Text style={styles.title}>{t("Guest.settings.title")}</Text>
      </View>
      <Text style={styles.body}>{t("Guest.settings.body")}</Text>
      <Button label={t("Guest.upgradeCta")} onPress={openUpgrade} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  // web: flex flex-col gap-3 rounded-[var(--radius-xl)] border
  // border-mango-brand/40 bg-mango-brand-tint/50 p-6
  card: {
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.4),
    backgroundColor: withAlpha(colors.brandTint, 0.5),
    padding: spacing.lg,
  },
  // web: flex items-center gap-3
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  // web: font-semibold text-mango-ink
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  // web: text-sm text-mango-ink-2
  body: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  // web: <Button className="self-start">
  cta: { alignSelf: "flex-start" },
});
