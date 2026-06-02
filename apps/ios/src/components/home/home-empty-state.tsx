/**
 * Home empty state (P3a) — 0-pet hero: gradient paw disc + welcome copy + a
 * 3-step onboarding strip + CTA to the pets tab (add pet). Mirrors
 * apps/web/src/components/home/home-empty-state.tsx; reuses the pets empty-state
 * gradient idiom. Uses existing Home.empty.* catalog keys.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const MANGO_GRADIENT = [colors.amber, colors.brand, colors.brandDeep] as const;

const STEPS = [
  { emoji: "🐶", title: "Home.empty.step1.title", sub: "Home.empty.step1.sub" },
  { emoji: "👨‍👩‍👧", title: "Home.empty.step2.title", sub: "Home.empty.step2.sub" },
  { emoji: "🦮", title: "Home.empty.step3.title", sub: "Home.empty.step3.sub" },
];

export function HomeEmptyState({ onAddPet }: { onAddPet: () => void }) {
  return (
    <View style={styles.box}>
      <LinearGradient
        colors={MANGO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.disc}
      >
        <Text style={styles.paw}>🐾</Text>
      </LinearGradient>
      <Text style={styles.title}>{t("Home.empty.title")}</Text>
      <Text style={styles.body}>{t("Home.empty.body")}</Text>

      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.step}>
            <Text style={styles.stepEmoji}>{s.emoji}</Text>
            <Text style={styles.stepTitle}>{t(s.title)}</Text>
            <Text style={styles.stepSub}>{t(s.sub)}</Text>
            {i < STEPS.length - 1 ? <Text style={styles.arrow}>›</Text> : null}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onAddPet}
        accessibilityRole="button"
        style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={MANGO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{t("Home.empty.cta")}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  disc: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandTint,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  paw: { fontSize: 44 },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.ink2, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.lg },
  steps: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.lg },
  step: { alignItems: "center", maxWidth: 92 },
  stepEmoji: { fontSize: 26 },
  stepTitle: { fontSize: 12, fontWeight: "700", color: colors.ink, marginTop: 2 },
  stepSub: { fontSize: 10, color: colors.ink3, textAlign: "center" },
  arrow: { position: "absolute", right: -10, top: 6, fontSize: 18, color: colors.ink3 },
  ctaWrap: {
    marginTop: spacing.xl, borderRadius: radius.pill, overflow: "hidden",
    shadowColor: colors.brandDeep, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  cta: { height: 48, paddingHorizontal: spacing.xxl, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 16, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
});
