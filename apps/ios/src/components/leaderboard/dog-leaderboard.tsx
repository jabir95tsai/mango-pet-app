/**
 * Dog leaderboard (P4a) — realtime onSnapshot over ALL dogs, filtered client-side
 * (mirrors web dog-leaderboard.tsx). Scope friends/all (persisted). Filter:
 *   - always show my own dogs (even visibility "off")
 *   - "friends": owner ∈ friendUids AND ownerVisibility ∈ {public, friends}
 *   - "all":     ownerVisibility === "public"
 * Personal-mode dogs are included (they're on the board too). Rows glow on fresh
 * score writes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DogLeaderboardEntry, LeaderboardPeriod } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { subscribeDogLeaderboard } from "@/lib/leaderboards";
import { listFriendUids } from "@/lib/friends-read";
import { LeaderboardRow } from "./leaderboard-row";
import { Segmented } from "./segmented";
import { RefreshIconButton } from "./refresh-icon-button";
import { useDogEntryGlow } from "./use-glow";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

const SCOPE_KEY = "mango.leaderboard.dogScope";
type DogScope = "friends" | "all";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "weekly", label: t("Leaderboard.period.weekly") },
  { value: "monthly", label: t("Leaderboard.period.monthly") },
  { value: "all_time", label: t("Leaderboard.period.all_time") },
];

export function DogLeaderboard({ onAddFriend }: { onAddFriend: () => void }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [scope, setScope] = useState<DogScope>("friends");
  const [entries, setEntries] = useState<DogLeaderboardEntry[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SCOPE_KEY).then((v) => {
      if (v === "friends" || v === "all") setScope(v);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    listFriendUids(user.uid).then((ids) => setFriendUids(new Set(ids)));
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeDogLeaderboard(
      period,
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [period, nonce]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const glowing = useDogEntryGlow(entries);

  const visible = useMemo(() => {
    const myUid = user?.uid;
    return entries.filter((e) => {
      if (e.ownerUid === myUid) return true;
      if (scope === "friends") {
        return (
          friendUids.has(e.ownerUid) &&
          (e.ownerVisibility === "public" || e.ownerVisibility === "friends")
        );
      }
      return e.ownerVisibility === "public";
    });
  }, [entries, scope, friendUids, user]);

  function changeScope(next: DogScope) {
    setScope(next);
    void AsyncStorage.setItem(SCOPE_KEY, next);
  }

  function refresh() {
    setRefreshing(true);
    setNonce((n) => n + 1);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("Leaderboard.title")}</Text>
          <Text style={styles.subtitle}>{t("Leaderboard.dog.subtitle")}</Text>
        </View>
        <RefreshIconButton refreshing={refreshing} onPress={refresh} />
      </View>

      <Segmented
        options={[
          { value: "friends", label: t("Leaderboard.dog.scope.friends") },
          { value: "all", label: t("Leaderboard.dog.scope.all") },
        ]}
        value={scope}
        onChange={changeScope}
      />
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {scope === "friends"
              ? t("Leaderboard.dog.emptyFriends.title")
              : t("Leaderboard.dog.emptyAll.title")}
          </Text>
          <Text style={styles.emptyBody}>
            {scope === "friends"
              ? t("Leaderboard.dog.emptyFriends.subtitle")
              : t("Leaderboard.dog.emptyAll.subtitle")}
          </Text>
          {scope === "friends" ? (
            <Button
              label={t("Leaderboard.dog.emptyFriends.cta")}
              onPress={onAddFriend}
              style={styles.cta}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((e, i) => (
            <LeaderboardRow
              key={e.petId}
              rank={i + 1}
              name={e.petName}
              breed={e.breed}
              ownerLabel={t("Leaderboard.dog.byOwner", { owner: e.ownerName })}
              photoURL={e.petPhotoURL}
              score={e.totalScore}
              distanceKm={e.totalDistanceKm}
              walkCount={e.walkCount}
              streakDays={e.streakDays}
              previousRank={e.previousRank}
              isMe={e.ownerUid === user?.uid}
              isGlowing={glowing.has(e.petId)}
              isDog
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.ink3, marginTop: 2 },
  loader: { marginVertical: spacing.xl },
  list: { gap: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, textAlign: "center" },
  emptyBody: { fontSize: 13, color: colors.ink2, textAlign: "center", lineHeight: 19 },
  cta: { marginTop: spacing.sm },
});
