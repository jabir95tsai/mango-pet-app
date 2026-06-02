/**
 * Human (walker) leaderboard (P4a) — realtime onSnapshot, mirroring web
 * human-leaderboard.tsx. Scope (all/family, persisted) + period
 * (weekly/monthly/all_time) tabs; personal-mode (no family) shows an empty
 * state (the board is family-comparison only). Manual refresh tears down +
 * recreates the listener. Rows glow on fresh score writes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LeaderboardEntry, LeaderboardPeriod } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { subscribeLeaderboard } from "@/lib/leaderboards";
import { LeaderboardRow } from "./leaderboard-row";
import { Segmented } from "./segmented";
import { useLeaderboardEntryGlow } from "./use-glow";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const SCOPE_KEY = "mango.leaderboard.scope";
type Scope = "all" | "family";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "weekly", label: t("Leaderboard.period.weekly") },
  { value: "monthly", label: t("Leaderboard.period.monthly") },
  { value: "all_time", label: t("Leaderboard.period.all_time") },
];

export function HumanLeaderboard({ onCreateFamily }: { onCreateFamily: () => void }) {
  const { user } = useAuth();
  const { family } = useFamily();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [scope, setScope] = useState<Scope>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SCOPE_KEY).then((v) => {
      if (v === "all" || v === "family") setScope(v);
    });
  }, []);

  useEffect(() => {
    if (!family) return; // personal mode: no listener
    setLoading(true);
    const unsub = subscribeLeaderboard(
      period,
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [period, nonce, family]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const glowing = useLeaderboardEntryGlow(entries);

  const visible = useMemo(() => {
    if (scope === "family" && family) {
      const set = new Set(family.memberUids);
      return entries.filter((e) => set.has(e.uid));
    }
    return entries;
  }, [entries, scope, family]);

  function changeScope(next: Scope) {
    setScope(next);
    void AsyncStorage.setItem(SCOPE_KEY, next);
  }

  function refresh() {
    setRefreshing(true);
    setNonce((n) => n + 1);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 800);
  }

  if (!family) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{t("Leaderboard.personalEmpty.title")}</Text>
        <Text style={styles.emptyBody}>{t("Leaderboard.personalEmpty.subtitle")}</Text>
        <Pressable onPress={onCreateFamily} style={styles.cta}>
          <Text style={styles.ctaText}>{t("Leaderboard.personalEmpty.cta")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Segmented
        options={[
          { value: "all", label: t("Leaderboard.scope.all") },
          { value: "family", label: t("Leaderboard.scope.family") },
        ]}
        value={scope}
        onChange={changeScope}
      />
      <Segmented options={PERIODS} value={period} onChange={setPeriod} compact />
      <Text style={styles.subtitle}>{t("Leaderboard.humanSubtitle")}</Text>

      <View style={styles.refreshRow}>
        <Pressable onPress={refresh} disabled={refreshing} style={styles.refreshBtn} hitSlop={6}>
          <Text style={styles.refreshText}>
            {refreshing ? "…" : "↻"} {t("Leaderboard.refreshButton")}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("Leaderboard.computing.title")}</Text>
          <Text style={styles.emptyBody}>{t("Leaderboard.computing.subtitle")}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((e, i) => (
            <LeaderboardRow
              key={e.uid}
              rank={i + 1}
              name={e.displayName}
              photoURL={e.photoURL}
              score={e.totalScore}
              distanceKm={e.totalDistanceKm}
              walkCount={e.walkCount}
              streakDays={e.streakDays}
              previousRank={e.previousRank}
              isMe={e.uid === user?.uid}
              isGlowing={glowing.has(e.uid)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  subtitle: { fontSize: 11, color: colors.ink3, textAlign: "center" },
  refreshRow: { alignItems: "flex-end" },
  refreshBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
  refreshText: { fontSize: 12, fontWeight: "700", color: colors.brandDeep },
  loader: { marginVertical: spacing.xl },
  list: { gap: spacing.xs },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, textAlign: "center" },
  emptyBody: { fontSize: 13, color: colors.ink2, textAlign: "center", lineHeight: 19 },
  cta: {
    marginTop: spacing.sm, height: 44, paddingHorizontal: spacing.xl, borderRadius: radius.pill,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  ctaText: { fontSize: 14, fontWeight: "800", color: colors.card },
});
