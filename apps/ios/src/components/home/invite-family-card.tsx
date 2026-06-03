/**
 * Invite-family card (P3a) — personal-mode upsell shown above the feed when the
 * user has no family. Gradient card + Users glyph + "邀請家人加入" copy + CTA.
 * The full family invite/share flow is P4; until then the CTA routes to the
 * settings tab (the future family-management home). Mirrors
 * apps/web/src/components/home/invite-family-card.tsx.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function InviteFamilyCard({
  petName,
  onInvite,
}: {
  petName?: string;
  onInvite: () => void;
}) {
  const body = petName
    ? t("Home.inviteFamily.body", { petName })
    : t("Home.inviteFamily.bodyGeneric");
  return (
    <LinearGradient
      colors={[colors.brandTint, colors.cardSoft]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>👨‍👩‍👧</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{t("Home.inviteFamily.title")}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {body}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onInvite}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <Text style={styles.ctaText}>{t("Home.inviteFamily.cta")}</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center",
  },
  icon: { fontSize: 22 },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  body: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  cta: {
    minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  ctaText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  pressed: { opacity: 0.85 },
});
