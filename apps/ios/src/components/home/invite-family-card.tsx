/**
 * Invite-family card — personal-mode upsell between the stories and the feed,
 * 1:1 with apps/web/src/components/home/invite-family-card.tsx: the WHOLE card
 * is the link (radius 18, hairline, shadow-card, brand-tint → card-soft
 * 135° gradient, px 16 / py 14): a 44pt white tile (radius 14) with Users 20,
 * title 14/800 + body 12.5/500, and a brand-deep "invite" pill (36pt).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Users } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

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
    <Pressable
      accessibilityRole="button"
      onPress={onInvite}
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[colors.brandTint, colors.cardSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.tile}>
          <Users size={20} color={colors.brandDeep} strokeWidth={1.8} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{t("Home.inviteFamily.title")}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{t("Home.inviteFamily.cta")}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { marginTop: spacing.md, borderRadius: radius.xl, ...shadows.card },
  pressed: { opacity: 0.9 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800", letterSpacing: -0.1, color: colors.ink },
  body: { marginTop: 2, fontSize: 12.5, fontWeight: "500", color: colors.ink2 },
  // web: h-9 rounded-full bg-brand-deep px-3.5 text-[13px] font-extrabold white
  cta: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDeep,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandDeep,
    shadowOpacity: 0.5,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaText: { fontSize: 13, fontWeight: "800", color: "#ffffff" },
});
