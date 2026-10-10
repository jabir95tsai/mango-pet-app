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
import { ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertTriangle, PawPrint, Users } from "lucide-react-native";
import type { DogLeaderboardEntry, LeaderboardPeriod } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { subscribeDogLeaderboard } from "@/lib/leaderboards";
import { listFriendUids } from "@/lib/friends-read";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { BoardHeader, BoardList, BoardTabs } from "./board-list";
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

  return (
    <BoardList
      data={loading ? [] : visible}
      keyExtractor={(e) => e.petId}
      renderItem={({ item, index }) => (
        <LeaderboardRow
          rank={index + 1}
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
          {header}
          <BoardHeader
            title={t("Leaderboard.title")}
            subtitle={t("Leaderboard.dog.subtitle")}
            refreshing={refreshing}
            onRefresh={refresh}
          />
          <BoardTabs
            scope={
              <Segmented
                options={[
                  { value: "friends", label: t("Leaderboard.dog.scope.friends") },
                  { value: "all", label: t("Leaderboard.dog.scope.all") },
                ]}
                value={scope}
                onChange={changeScope}
              />
            }
            period={
              <Segmented
                options={[
                  { value: "weekly", label: t("Leaderboard.period.weekly") },
                  { value: "monthly", label: t("Leaderboard.period.monthly") },
                  { value: "all_time", label: t("Leaderboard.period.all_time") },
                ]}
                value={period}
                onChange={setPeriod}
              />
            }
          />
        </>
      }
      empty={empty}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.xl },
});
