/**
 * Home 0-pet hero — 1:1 with apps/web/src/components/home/home-empty-state.tsx:
 * top-aligned column (pt 24, gap 12): a 168pt radial halo (brand-tint at
 * 50%/35% → bg-alt 70% → transparent) with a 120pt white tile (radius 36,
 * shadow-card) holding a lucide PawPrint 64 and three confetti bits; title
 * 24/800; body 14/500 (max 290); a 280pt CTA stack (btn-mango "新增寵物" with
 * Plus 18, then an outlined "加入家庭" with Users 14); then the 3-step strip
 * of numbered cards.
 *
 * Guests never see "join family" (family is guest-locked).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { PawPrint, Plus, Users } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const HALO = 168;

export function HomeEmptyState({
  onAddPet,
  onJoinFamily,
}: {
  onAddPet: () => void;
  /** Omit to hide the secondary CTA (guests). */
  onJoinFamily?: () => void;
}) {
  return (
    <View style={styles.box}>
      <View style={styles.halo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={HALO} height={HALO} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="homeHalo" cx="50%" cy="35%" r="65%" fx="50%" fy="35%">
              <Stop offset="0%" stopColor={colors.brandTint} />
              <Stop offset="70%" stopColor={colors.bgAlt} />
              <Stop offset="100%" stopColor={colors.bgAlt} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#homeHalo)" />
        </Svg>
        <View style={styles.tile}>
          <PawPrint size={64} color={colors.brandDeep} strokeWidth={1.6} />
        </View>
        <View style={[styles.bit, styles.bitBrand]} />
        <View style={[styles.bit, styles.bitLeaf]} />
        <View style={[styles.bit, styles.bitPeach]} />
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {t("Home.empty.title")}
      </Text>
      <Text style={styles.body}>{t("Home.empty.body")}</Text>

      <View style={styles.ctas}>
        <Button
          label={t("Home.empty.cta")}
          size="lg"
          pill
          fullWidth
          icon={<Plus size={18} color="#ffffff" strokeWidth={2.5} />}
          onPress={onAddPet}
          style={styles.primary}
          labelStyle={styles.primaryLabel}
        />
        {onJoinFamily ? (
          <Pressable
            accessibilityRole="button"
            onPress={onJoinFamily}
            style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
          >
            <Users size={14} color={colors.ink} strokeWidth={2} />
            <Text style={styles.secondaryText}>{t("Home.empty.joinFamily")}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.steps}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={styles.step}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{n}</Text>
            </View>
            <Text style={styles.stepTitle}>{t(`Home.empty.step${n}.title`)}</Text>
            <Text style={styles.stepSub}>{t(`Home.empty.step${n}.sub`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: flex flex-col items-center gap-3 pt-6 text-center
  box: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xl },
  halo: { width: HALO, height: HALO, alignItems: "center", justifyContent: "center" },
  tile: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  bit: { position: "absolute", borderRadius: 2 },
  bitBrand: { left: 18, top: 8, width: 8, height: 8, backgroundColor: colors.brand, transform: [{ rotate: "20deg" }] },
  bitLeaf: { right: 14, bottom: 18, width: 6, height: 12, backgroundColor: colors.leaf, transform: [{ rotate: "-15deg" }] },
  bitPeach: { right: 6, top: 30, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.peach },
  title: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: "center",
  },
  body: {
    maxWidth: 290,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: colors.ink2,
    textAlign: "center",
  },
  // web: mt-3 flex w-full max-w-[280px] flex-col gap-2.5
  ctas: { marginTop: spacing.md, width: "100%", maxWidth: 280, gap: 10 },
  primary: { height: 52 },
  primaryLabel: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  // web: h-12 rounded-full border-[1.5px] border-hairline text-[14.5px] font-bold
  secondary: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  secondaryPressed: { backgroundColor: colors.bgAlt },
  secondaryText: { fontSize: 14.5, fontWeight: "700", letterSpacing: -0.1, color: colors.ink },
  // web: mt-5 grid w-full grid-cols-3 gap-2 text-left
  steps: { marginTop: 20, width: "100%", flexDirection: "row", gap: spacing.sm },
  step: {
    flex: 1,
    alignItems: "flex-start",
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: 10,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "800", color: colors.brandDeep },
  stepTitle: { fontSize: 12.5, fontWeight: "800", letterSpacing: -0.1, color: colors.ink },
  stepSub: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.2, color: colors.ink3 },
});
