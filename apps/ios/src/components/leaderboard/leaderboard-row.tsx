/**
 * Leaderboard row (P4a) — shared by the human + dog boards. Rank medal/number,
 * avatar (circle for people, rounded square for dogs), name + optional subtitle,
 * score + distance/walks/streak, a ▲▼ rank-delta vs previousRank, a "yours"
 * highlight, and a fade-out glow flash when `isGlowing` ticks true (realtime
 * score write within 5s). Glow respects reduce-motion (instant, no flash).
 */
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { UserAvatar } from "@/components/feed/user-avatar";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { groupThousands } from "@/lib/format";
import { colors, radius, spacing } from "@/theme/theme";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardRow({
  rank,
  name,
  subtitle,
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
  subtitle?: string;
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

  const glowBg = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,231,191,0)", "rgba(255,231,191,1)"],
  });

  const delta =
    previousRank != null && previousRank > 0 ? previousRank - rank : 0;

  return (
    <Animated.View
      style={[styles.row, isMe && styles.rowMe, { backgroundColor: glowBg }]}
    >
      <View style={styles.rankCol}>
        {rank <= 3 ? (
          <Text style={styles.medal}>{MEDALS[rank - 1]}</Text>
        ) : (
          <Text style={styles.rankNum}>{rank}</Text>
        )}
        {delta !== 0 ? (
          <Text style={[styles.delta, delta > 0 ? styles.up : styles.down]}>
            {delta > 0 ? `▲${delta}` : `▼${-delta}`}
          </Text>
        ) : null}
      </View>

      {isDog ? (
        <PetAvatar name={name} photoURL={photoURL ?? undefined} size={40} />
      ) : (
        <UserAvatar name={name} photoURL={photoURL} size={40} />
      )}

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
          {isMe ? <Text style={styles.you}> ·我</Text> : null}
        </Text>
        <Text style={styles.stats} numberOfLines={1}>
          {subtitle ? `${subtitle} · ` : ""}
          {distanceKm.toFixed(1)}km · {walkCount}次
          {streakDays > 0 ? ` · 🔥${streakDays}` : ""}
        </Text>
      </View>

      <View style={styles.scoreCol}>
        <Text style={styles.score}>{groupThousands(score)}</Text>
        <Text style={styles.scoreUnit}>分</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  rowMe: { borderWidth: 1.5, borderColor: colors.brand },
  rankCol: { width: 34, alignItems: "center" },
  medal: { fontSize: 20 },
  rankNum: { fontSize: 16, fontWeight: "800", color: colors.ink2 },
  delta: { fontSize: 10, fontWeight: "800", marginTop: 1 },
  up: { color: colors.leaf },
  down: { color: colors.cookie },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: "800", color: colors.ink },
  you: { fontSize: 12, fontWeight: "800", color: colors.brandDeep },
  stats: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  scoreCol: { alignItems: "flex-end" },
  score: { fontSize: 18, fontWeight: "900", color: colors.brandDeep },
  scoreUnit: { fontSize: 10, color: colors.ink3, marginTop: -2 },
});
