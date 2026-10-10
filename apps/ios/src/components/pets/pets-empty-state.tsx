/**
 * 0-pet hero — 1:1 with apps/web/src/components/pets/pets-empty-state.tsx:
 * top-aligned column (pt 48, gap 14): a 140pt disc filled with a radial
 * gradient (brand-tint at 50%/35% → bg-alt at 70%) holding a 96pt white card
 * (radius 34, shadow-card, rotated −6°) with the 56pt paw, plus a 38pt "+"
 * badge (top 6 / right −2); then title 22/800, body 13.5/500 ink2 (max 280),
 * the btn-mango 50pt pill CTA (Plus 18, white 16/800) and the hint.
 * Kept separate from the shared EmptyState so Home's empty state is unchanged.
 */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { Plus } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { PawIcon } from "@/components/walks/paw-icon";
import { t } from "@/lib/i18n";
import { colors, shadows, spacing } from "@/theme/theme";

const DISC = 140;

export function PetsEmptyState({ onAddPet }: { onAddPet?: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.column}>
      <View style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={DISC} height={DISC} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="petsEmptyDisc" cx="50%" cy="35%" r="70%" fx="50%" fy="35%">
              <Stop offset="0%" stopColor={colors.brandTint} />
              <Stop offset="100%" stopColor={colors.bgAlt} />
            </RadialGradient>
          </Defs>
          <Circle cx={DISC / 2} cy={DISC / 2} r={DISC / 2} fill="url(#petsEmptyDisc)" />
        </Svg>
        <View style={styles.card}>
          <PawIcon size={56} color={colors.brandDeep} />
        </View>
        <View style={styles.badge}>
          <Plus size={20} color={colors.brandDeep} strokeWidth={2.5} />
        </View>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {t("PetsPage.empty.title")}
      </Text>
      <Text style={styles.body}>{t("PetsPage.empty.body")}</Text>

      {onAddPet ? (
        <Button
          label={t("PetsPage.empty.cta")}
          icon={<Plus size={18} color="#ffffff" strokeWidth={2.5} />}
          pill
          size="lg"
          onPress={onAddPet}
          style={styles.cta}
          labelStyle={styles.ctaLabel}
        />
      ) : null}

      <Text style={styles.hint}>{t("PetsPage.empty.hint")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
    gap: 14,
    paddingTop: 48,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  disc: {
    width: DISC,
    height: DISC,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: 96,
    height: 96,
    borderRadius: 34,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-6deg" }],
    ...shadows.card,
  },
  // web: absolute -right-0.5 top-1.5 size-[38px] rounded-full border bg-card
  badge: {
    position: "absolute",
    top: 6,
    right: -2,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#50320a",
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: "center",
  },
  body: {
    maxWidth: 280,
    fontSize: 13.5,
    lineHeight: 22,
    fontWeight: "500",
    color: colors.ink2,
    textAlign: "center",
  },
  cta: { marginTop: spacing.lg, height: 50, paddingHorizontal: spacing.xl },
  ctaLabel: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  hint: { marginTop: spacing.xl, fontSize: 12, color: colors.ink3, textAlign: "center" },
});
