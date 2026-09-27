/**
 * Leaderboard row (P4a) — shared by the human + dog boards, 1:1 with web
 * leaderboard-row / dog-leaderboard-row. Rank medal/number, avatar (36),
 * name + (dog) breed chip + (dog & mine)「我的狗」pill, a meta line ordered
 * 「{n}次 · {km} km · 🔥{streak} · 飼主{owner}」, score, a "mine" highlight,
 * and a fade-out glow flash when `isGlowing` ticks (reduce-motion safe).
 *
 * Web has no per-row「·我」text — the highlight bg carries "mine" on the
 * human board, and the dog board uses the「我的狗」pill instead.
 */
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { UserAvatar } from "@/components/feed/user-avatar";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { groupThousands } from "@/lib/format";
import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardRow({
  rank,
  name,
  breed,
  ownerLabel,
  photoURL,
  score,
  distanceKm,
  walkCount,
  streakDays,
  isMe,
  isGlowing,
  previousRank,
  isDog,
}: {
  rank: number;
  name: string;
  /** Dog breed → amber chip beside the name (dog board only). */
  breed?: string | null;
  /** Pre-formatted「飼主 X」label, appended last in the meta line (dog only). */
  ownerLabel?: string;
  photoURL?: string | null;
  score: number;
  distanceKm: number;
  walkCount: number;
  streakDays: number;
  isMe?: boolean;
  isGlowing?: boolean;
  previousRank?: number;
  isDog?: boolean;
}) {
  const glow = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isGlowing) return;
    if (reduceMotion) {
      glow.setValue(0);
      return;
    }
    glow.setValue(1);
    Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: false }).start();
  }, [isGlowing, reduceMotion, glow]);

  // Meta order mirrors web: walks · distance · 🔥streak · 飼主owner.
  const meta: string[] = [
    t("Leaderboard.unitWalks", { count: walkCount }),
    `${distanceKm.toFixed(1)} km`,
  ];
  if (streakDays > 0) meta.push(`🔥 ${streakDays}`);
  if (ownerLabel) meta.push(ownerLabel);

  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      {/* glow flash overlay — fades out over the base (incl. the me tint) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { opacity: glow }]}
      />
      <View style={styles.rankCol}>
        {rank <= 3 ? (
          <Text style={styles.medal}>{MEDALS[rank - 1]}</Text>
        ) : (
          <Text style={styles.rankNum}>{rank}</Text>
        )}
      </View>

      {isDog ? (
        <PetAvatar name={name} photoURL={photoURL ?? undefined} size={36} />
      ) : (
        <UserAvatar name={name} photoURL={photoURL} size={36} />
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isDog && breed ? (
            <View style={styles.breedChip}>
              <Text style={styles.breedText} numberOfLines={1}>
                {breed}
              </Text>
            </View>
          ) : null}
          {isDog && isMe ? (
            <View style={styles.yoursPill}>
              <Text style={styles.yoursText}>{t("Leaderboard.dog.yours")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.stats} numberOfLines={1}>
          {meta.join(" · ")}
        </Text>
      </View>

      <View style={styles.scoreCol}>
        <Text style={styles.score}>{groupThousands(score)}</Text>
        <Text style={styles.scoreUnit}>{t("Leaderboard.unitScore")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: every row is a white card (rounded-lg, amber-200 border, shadow-sm);
  // highlight = amber-100 bg + amber-400 border.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bellTint,
    ...shadows.card,
  },
  rowMe: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brandTint,
  },
  rankCol: { width: 32, alignItems: "center" },
  medal: { fontSize: 18 },
  rankNum: { fontSize: 18, fontWeight: "700", color: colors.ink3 },
  body: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  breedChip: {
    flexShrink: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  breedText: { fontSize: 10, fontWeight: "500", color: colors.brandDeep },
  yoursPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  yoursText: { fontSize: 10, fontWeight: "700", color: "#ffffff" },
  stats: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  scoreCol: { alignItems: "flex-end" },
  score: { fontSize: 18, fontWeight: "700", color: colors.brandDeep, fontVariant: ["tabular-nums"] },
  scoreUnit: { fontSize: 10, color: colors.ink3, marginTop: -2 },
});
