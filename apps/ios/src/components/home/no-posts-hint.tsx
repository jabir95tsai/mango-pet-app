/**
 * "No posts yet" — 1:1 with apps/web/src/components/home/no-posts-hint.tsx:
 * a tappable cream card (radius 18, hairline, shadow-card, px 16 / py 16)
 * with a 40pt brand-tint disc + SquarePen 20, title 14/800 and hint
 * 12.5/500; tapping opens the composer (guests get the upgrade sheet).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SquarePen } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

export function NoPostsHint({ onCompose }: { onCompose: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onCompose}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.disc}>
        <SquarePen size={20} color={colors.brandDeep} strokeWidth={1.8} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{t("Home.feed.emptyTitle")}</Text>
        <Text style={styles.hint}>{t("Home.feed.emptyHint")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSoft,
    ...shadows.card,
  },
  pressed: { backgroundColor: colors.bgAlt },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800", letterSpacing: -0.1, color: colors.ink },
  hint: { marginTop: 2, fontSize: 12.5, fontWeight: "500", color: colors.ink2 },
});
