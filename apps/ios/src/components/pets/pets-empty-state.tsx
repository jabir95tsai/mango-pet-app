/**
 * 0-pet empty state — hero paw disc + title/body + "新增寵物" CTA + hint.
 * P2a ships a flat version; P2c upgrades the disc to an expo-linear-gradient
 * radial (the dep lands in that sub-phase). Mirrors web pets-empty-state.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");

export function PetsEmptyState({ onAddPet }: { onAddPet?: () => void }) {
  return (
    <View style={styles.box}>
      <View style={styles.disc}>
        <Text style={styles.paw}>🐾</Text>
      </View>
      <Text style={styles.title}>{tPP("empty.title")}</Text>
      <Text style={styles.body}>{tPP("empty.body")}</Text>
      <Pressable
        onPress={onAddPet}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{tPP("empty.cta")}</Text>
      </Pressable>
      <Text style={styles.hint}>{tPP("empty.hint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  disc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  paw: { fontSize: 44 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  body: {
    fontSize: 14,
    color: colors.ink2,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  cta: {
    marginTop: spacing.md,
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
  hint: { fontSize: 12, color: colors.ink3, marginTop: spacing.xs },
});
