/**
 * EmptyState — the shared "nothing here yet" surface (UX-0): emoji/illustration
 * hero + title + body + optional CTA, centred. Mirrors the web empty-state tone
 * (encouraging copy + single CTA). `gradientHero` swaps the plain emoji disc for
 * the mango gradient paw disc used on the 0-pet hero.
 */
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { colors, spacing, type } from "@/theme/theme";

const MANGO_GRADIENT = [colors.amber, colors.brand, colors.brandDeep] as const;

type Props = {
  emoji: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  gradientHero?: boolean;
  hint?: string;
};

export function EmptyState({
  emoji,
  title,
  body,
  ctaLabel,
  onPressCta,
  gradientHero = false,
  hint,
}: Props) {
  return (
    <View style={styles.box}>
      {gradientHero ? (
        <LinearGradient
          colors={MANGO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.disc}
        >
          <Text style={styles.discEmoji}>{emoji}</Text>
        </LinearGradient>
      ) : (
        <Text style={styles.emoji}>{emoji}</Text>
      )}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onPressCta ? (
        <Button label={ctaLabel} onPress={onPressCta} size="lg" pill style={styles.cta} />
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
  emoji: { fontSize: 56 },
  disc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  discEmoji: { fontSize: 44 },
  title: { ...type.h2, color: colors.ink, textAlign: "center" },
  body: {
    ...type.body,
    color: colors.ink2,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  cta: { marginTop: spacing.md },
  hint: { fontSize: 12, color: colors.ink3, marginTop: spacing.xs },
});
