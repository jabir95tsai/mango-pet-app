/**
 * Badge tile — 1:1 with apps/web/src/components/achievements/badge-card.tsx.
 * Three states:
 *  - earned: amber → brand-tint → amber gradient disc + brand Check corner,
 *    "解鎖於 {date}" pill, brand-tinted border + glow
 *  - unearned: dimmed disc (RN cannot grayscale an emoji → opacity .45),
 *    progress bar "current / threshold" when the metric is computable
 *  - locked (guest viewing a non-guest badge): ink Lock corner +
 *    "綁定帳號解鎖"; the whole tile opens the upgrade flow
 */
import { StyleSheet, Text, View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Lock } from "lucide-react-native";

import { withAlpha } from "@/components/auth/color";
import { formatEarnedDate, formatMetricValue, type BadgeState } from "@/lib/achievements";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function BadgeCard({
  state,
  onUpgrade,
  style,
}: {
  state: BadgeState;
  onUpgrade: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { achievement, earned, earnedAt, locked, current, progress } = state;
  const title = t(`Achievements.${achievement.id}.title`);
  const desc = t(`Achievements.${achievement.id}.desc`);
  const showBar = !earned && !locked && progress != null && current != null;
  const pct = Math.round((progress ?? 0) * 100);

  const inner = (
    <>
      <View>
        {earned ? (
          <LinearGradient
            colors={[colors.amber, colors.brandTint, colors.amber]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[styles.disc, styles.discEarned]}
          >
            <Text style={styles.emoji}>{achievement.emoji}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.disc, styles.discIdle]}>
            <Text style={[styles.emoji, styles.emojiIdle]}>{achievement.emoji}</Text>
          </View>
        )}
        {earned ? (
          <View style={[styles.corner, styles.cornerEarned]}>
            <Check size={14} color="#ffffff" strokeWidth={3} />
          </View>
        ) : null}
        {locked ? (
          <View style={[styles.corner, styles.cornerLocked]}>
            <Lock size={14} color="#ffffff" strokeWidth={2} />
          </View>
        ) : null}
      </View>

      <View style={styles.texts}>
        <Text style={[styles.title, !earned && styles.titleIdle]}>{title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {desc}
        </Text>
      </View>

      {earned && earnedAt ? (
        <View style={styles.earnedPill}>
          <Text style={styles.earnedText}>
            {t("Achievements.earnedOn", { date: formatEarnedDate(earnedAt) })}
          </Text>
        </View>
      ) : null}

      {locked ? <Text style={styles.lockedText}>{t("Achievements.locked")}</Text> : null}

      {showBar ? (
        <View
          style={styles.progressWrap}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={title}
          accessibilityValue={{ min: 0, max: achievement.threshold, now: current ?? 0 }}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {`${formatMetricValue(current ?? 0)} / ${achievement.threshold}`}
          </Text>
        </View>
      ) : null}
    </>
  );

  if (locked) {
    return (
      <Pressable
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel={`${title} — ${t("Achievements.locked")}`}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.card, earned && styles.cardEarned, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  // web: flex h-full flex-col items-center gap-2 rounded-2xl border p-4 text-center
  card: {
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSoft,
    padding: spacing.lg,
  },
  cardEarned: {
    borderColor: withAlpha(colors.brand, 0.5),
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardPressed: { borderColor: withAlpha(colors.brand, 0.5) },
  disc: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  discEarned: { borderWidth: 1, borderColor: withAlpha(colors.brand, 0.25) },
  discIdle: { backgroundColor: colors.bgAlt, opacity: 0.45 },
  emoji: { fontSize: 30 },
  emojiIdle: {},
  corner: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerEarned: { backgroundColor: colors.brand },
  cornerLocked: { backgroundColor: colors.ink },
  texts: { alignItems: "center", gap: 2, width: "100%" },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink, textAlign: "center" },
  titleIdle: { color: colors.ink2 },
  desc: { fontSize: 12, lineHeight: 16, color: colors.ink2, textAlign: "center" },
  earnedPill: {
    marginTop: "auto",
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  earnedText: { fontSize: 11, fontWeight: "600", color: colors.brandDeep },
  lockedText: { marginTop: "auto", fontSize: 11, fontWeight: "600", color: colors.brandDeep },
  progressWrap: { marginTop: "auto", width: "100%" },
  track: { height: 8, width: "100%", borderRadius: radius.pill, backgroundColor: colors.bgAlt, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brand },
  progressText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: colors.ink2,
    fontVariant: ["tabular-nums"],
  },
});
