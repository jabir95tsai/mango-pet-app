/**
 * 0-pet empty state — gradient hero paw disc + title/body + gradient
 * "新增寵物" CTA + hint. The disc uses expo-linear-gradient (P2c). A true
 * radial would need Skia; a diagonal amber→brand→brandDeep gradient is the
 * lightweight stand-in. Mirrors web pets-empty-state.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");
const MANGO_GRADIENT = [colors.amber, colors.brand, colors.brandDeep] as const;

export function PetsEmptyState({ onAddPet }: { onAddPet?: () => void }) {
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
      <Text style={styles.title}>{tPP("empty.title")}</Text>
      <Text style={styles.body}>{tPP("empty.body")}</Text>
      <Pressable
        onPress={onAddPet}
        style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={MANGO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{tPP("empty.cta")}</Text>
        </LinearGradient>
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
  ctaWrap: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    overflow: "hidden",
    shadowColor: colors.brandDeep,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cta: {
    height: 48,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
  hint: { fontSize: 12, color: colors.ink3, marginTop: spacing.xs },
});
