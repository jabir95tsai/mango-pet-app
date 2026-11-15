/**
 * Dog leaderboard — realtime onSnapshot over ALL dogs, filtered client-side,
 * 1:1 with web dog-leaderboard.tsx. Scope friends / all (persisted by the
 * screen):
 *   - always show my own dogs (even visibility "off")
 *   - "friends": owner ∈ friendUids AND ownerVisibility ∈ {public, friends}
 *   - "all":     ownerVisibility === "public"
 * Empty states: friends → Users card + secondary "add friends"; all →
 * PawPrint card; listener error → retry card (iOS improvement).
 *
 * The listener runs only while `active` (tab focused + app foreground);
 * refresh re-subscribes AND re-pulls the friend list (web parity).
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertTriangle, PawPrint, Users } from "lucide-react-native";
import type { DogLeaderboardEntry, LeaderboardPeriod } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { withDemoDogs } from "@/lib/leaderboard-demo";
import { subscribeDogLeaderboard } from "@/lib/leaderboards";
import { listFriendUids } from "@/lib/friends-read";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { BoardHeader, BoardList } from "./board-list";
import { MyRankBar, Podium, ScopePill } from "./podium";
import { LeaderboardRow } from "./leaderboard-row";
import { Segmented } from "./segmented";
import { useDogEntryGlow } from "./use-glow";

export const DOG_SCOPE_KEY = "mango.leaderboard.dogScope";
export type DogScope = "friends" | "all";

const REFRESH_HOLD_MS = 800;

export function DogLeaderboard({
  active,
  header,
  initialScope,
  onAddFriend,
}: {
  active: boolean;
  header: ReactElement;
  initialScope: DogScope;
  onAddFriend: () => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [scope, setScope] = useState<DogScope>(initialScope);
  const [entries, setEntries] = useState<DogLeaderboardEntry[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (!uid) {
      setFriendUids(new Set());
      return;
    }
    let cancelled = false;
    listFriendUids(uid)
      .then((ids) => {
        if (!cancelled) setFriendUids(new Set(ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid, nonce]);

  useEffect(() => {
    if (!active) return;
    if (entriesRef.current.length === 0) setLoading(true);
    const unsub = subscribeDogLeaderboard(
      period,
      (list) => {
        setEntries(list);
        setError(false);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      },
    );
    return unsub;
  }, [active, period, nonce]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const glowing = useDogEntryGlow(entries);

  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (e.ownerUid === uid) return true;
      if (scope === "friends") {
        return (
          friendUids.has(e.ownerUid) &&
          (e.ownerVisibility === "public" || e.ownerVisibility === "friends")
        );
      }
      return e.ownerVisibility === "public";
    });
  }, [entries, scope, friendUids, uid]);

  function changeScope(next: DogScope) {
    setScope(next);
    void AsyncStorage.setItem(DOG_SCOPE_KEY, next).catch(() => {});
  }

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setNonce((n) => n + 1);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), REFRESH_HOLD_MS);
  }

  let empty: ReactElement | null;
  if (loading) {
    empty = <ActivityIndicator color={colors.brand} style={styles.loader} />;
  } else if (error) {
    empty = (
      <EmptyState
        icon={AlertTriangle}
        title={t("Error.title")}
        action={{ label: t("Error.retry"), onPress: refresh }}
      />
    );
  } else if (scope === "friends") {
    empty = (
      <EmptyState
        icon={Users}
        title={t("Leaderboard.dog.emptyFriends.title")}
        description={t("Leaderboard.dog.emptyFriends.subtitle")}
        secondaryAction={{ label: t("Leaderboard.dog.emptyFriends.cta"), icon: Users, onPress: onAddFriend }}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={PawPrint}
        title={t("Leaderboard.dog.emptyAll.title")}
        description={t("Leaderboard.dog.emptyAll.subtitle")}
      />
    );
  }

  const list = loading ? [] : withDemoDogs(visible);
  // My best-ranked dog, only when it's below the podium.
  const meIndex = list.findIndex((e) => e.ownerUid === uid);
  const me = meIndex >= 3 ? list[meIndex] : null;

  return (
    <BoardList
      data={list.slice(3)}
      keyExtractor={(e) => e.petId}
      renderItem={({ item, index }) => (
        <LeaderboardRow
          rank={index + 4}
          name={item.petName}
          breed={item.breed}
          ownerLabel={t("Leaderboard.dog.byOwner", { owner: item.ownerName })}
          photoURL={item.petPhotoURL}
          score={item.totalScore}
          distanceKm={item.totalDistanceKm}
          walkCount={item.walkCount}
          streakDays={item.streakDays}
          previousRank={item.previousRank}
          isMe={item.ownerUid === uid}
          isGlowing={glowing.has(item.petId)}
          isDog
        />
      )}
      header={
        <>
          <BoardHeader
            title={t("Leaderboard.title")}
            refreshing={refreshing}
            onRefresh={refresh}
            accessory={header}
          />
          <View style={styles.period}>
            <Segmented
              warm
              size="sm"
              options={[
                { value: "weekly", label: t("Leaderboard.period.weekly") },
                { value: "monthly", label: t("Leaderboard.period.monthly") },
                { value: "all_time", label: t("Leaderboard.period.all_time") },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <ScopePill
              options={[
                { value: "friends", label: t("Leaderboard.dog.scope.friends") },
                { value: "all", label: t("Leaderboard.dog.scope.all") },
              ]}
              value={scope}
              onChange={changeScope}
            />
          </View>
          <Podium
            isDog
            items={list.slice(0, 3).map((e) => ({
              key: e.petId,
              name: e.petName,
              photoURL: e.petPhotoURL,
              score: e.totalScore,
              meta: `${t("Leaderboard.dog.walkCount", { count: e.walkCount })} · ${e.totalDistanceKm.toFixed(1)} km`,
              isMe: e.ownerUid === uid,
            }))}
          />
        </>
      }
      empty={list.length ? null : empty}
      overlay={
        me ? (
          <MyRankBar
            isDog
            rank={meIndex + 1}
            name={me.petName}
            photoURL={me.petPhotoURL}
            score={me.totalScore}
            gap={list[meIndex - 1].totalScore - me.totalScore}
          />
        ) : null
      }
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.xl },
  period: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
});
