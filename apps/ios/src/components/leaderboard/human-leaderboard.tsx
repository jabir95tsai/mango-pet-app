/**
 * Human (walker) leaderboard — realtime onSnapshot, 1:1 with web
 * human-leaderboard.tsx:
 *  - personal mode (family resolved to none): page title + Trophy EmptyState
 *    with the create-family CTA; never flashed while the family loads
 *  - scope all / family (persisted by the screen) + period tabs
 *  - 家庭內 lists EVERY member: walkers without an entry get a 0-score
 *    placeholder; "only you" hint when the family has one member
 *  - computing / listener-error cards (error = iOS improvement: retry)
 *
 * The listener runs only while `active` (tab focused + app foreground) and
 * keeps the last entries, so re-focus shows data instantly. Manual refresh
 * re-subscribes and re-pulls members (web handleRefresh).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertTriangle, Trophy, Users } from "lucide-react-native";
import type { FamilyMember, LeaderboardEntry, LeaderboardPeriod } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { listFamilyMembers } from "@/lib/families-read";
import { subscribeLeaderboard } from "@/lib/leaderboards";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { BoardHeader, BoardList, BoardTabs } from "./board-list";
import { LeaderboardRow } from "./leaderboard-row";
import { Segmented } from "./segmented";
import { useLeaderboardEntryGlow } from "./use-glow";

export const HUMAN_SCOPE_KEY = "mango.leaderboard.scope";
export type HumanScope = "all" | "family";

const REFRESH_HOLD_MS = 800;

export function HumanLeaderboard({
  active,
  header,
  initialScope,
  onCreateFamily,
}: {
  active: boolean;
  /** The page-level dimension toggle, rendered above the board header. */
  header: ReactElement;
  initialScope: HumanScope;
  onCreateFamily: () => void;
}) {
  const { user } = useAuth();
  const { family, status: familyStatus, refresh: retryFamily } = useFamily();
  const familyLoading = familyStatus === "loading";
  const familyId = family?.familyId ?? null;
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [scope, setScope] = useState<HumanScope>(initialScope);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (!active || familyLoading) return;
    if (!familyId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    // Only show the spinner when there is nothing to show yet.
    if (entriesRef.current.length === 0) setLoading(true);
    const unsub = subscribeLeaderboard(
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
  }, [active, familyLoading, familyId, period, nonce]);

  const refreshMembers = useCallback(async () => {
    if (!family) {
      setMembers([]);
      return;
    }
    try {
      setMembers(await listFamilyMembers(family));
    } catch {
      setMembers([]);
    }
  }, [family]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  // Above every early return (hook order) — fed the real entries only.
  const glowing = useLeaderboardEntryGlow(entries);

  const visible = useMemo<LeaderboardEntry[]>(() => {
    if (scope !== "family" || !family) return entries;
    const byUid = new Map(entries.map((e) => [e.uid, e]));
    return members
      .map(
        (m) =>
          byUid.get(m.uid) ??
          ({
            uid: m.uid,
            displayName: m.displayName,
            photoURL: m.photoURL ?? null,
            totalScore: 0,
            totalDistanceKm: 0,
            totalDurationMin: 0,
            walkCount: 0,
            streakDays: 0,
          } as unknown as LeaderboardEntry),
      )
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [entries, scope, family, members]);

  function changeScope(next: HumanScope) {
    setScope(next);
    void AsyncStorage.setItem(HUMAN_SCOPE_KEY, next).catch(() => {});
  }

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setNonce((n) => n + 1);
    void refreshMembers();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), REFRESH_HOLD_MS);
  }

  // Scope read failed ≠ personal mode (R08): retry, never the create CTA.
  if (!family && familyStatus === "error") {
    return (
      <BoardList
        data={[] as LeaderboardEntry[]}
        keyExtractor={(e) => e.uid}
        renderItem={() => null}
        header={
          <>
            {header}
            <BoardHeader title={t("Nav.leaderboard")} />
          </>
        }
        empty={
          <EmptyState
            icon={AlertTriangle}
            title={t("Error.title")}
            action={{ label: t("Error.retry"), onPress: () => void retryFamily() }}
          />
        }
        refreshing={false}
      />
    );
  }

  // Personal mode (resolved, no family): the explanation card only.
  if (!familyLoading && !family) {
    return (
      <BoardList
        data={[] as LeaderboardEntry[]}
        keyExtractor={(e) => e.uid}
        renderItem={() => null}
        header={
          <>
            {header}
            <BoardHeader title={t("Nav.leaderboard")} />
          </>
        }
        empty={
          <EmptyState
            icon={Trophy}
            title={t("Leaderboard.personalEmpty.title")}
            description={t("Leaderboard.personalEmpty.subtitle")}
            action={{ label: t("Leaderboard.personalEmpty.cta"), icon: Users, onPress: onCreateFamily }}
          />
        }
        refreshing={false}
      />
    );
  }

  const familyOnlyMe = scope === "family" && members.length === 1 && visible.length === 1;

  let empty: ReactElement | null;
  if (loading || familyLoading) {
    empty = <ActivityIndicator color={colors.brand} style={styles.loader} />;
  } else if (error) {
    empty = (
      <EmptyState
        icon={AlertTriangle}
        title={t("Error.title")}
        action={{ label: t("Error.retry"), onPress: refresh }}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={Trophy}
        title={t("Leaderboard.computing.title")}
        description={t("Leaderboard.computing.subtitle")}
      />
    );
  }

  return (
    <BoardList
      data={loading || familyLoading ? [] : visible}
      keyExtractor={(e) => e.uid}
      renderItem={({ item, index }) => (
        <LeaderboardRow
          rank={index + 1}
          name={item.displayName}
          photoURL={item.photoURL}
          score={item.totalScore}
          distanceKm={item.totalDistanceKm}
          walkCount={item.walkCount}
          streakDays={item.streakDays}
          previousRank={item.previousRank}
          isMe={item.uid === user?.uid}
          isGlowing={glowing.has(item.uid)}
        />
      )}
      header={
        <>
          {header}
          <BoardHeader
            title={t("Nav.leaderboard")}
            subtitle={t("Leaderboard.humanSubtitle")}
            refreshing={refreshing}
            onRefresh={refresh}
          />
          <BoardTabs
            scope={
              <Segmented
                options={[
                  { value: "all", label: t("Leaderboard.scope.all") },
                  { value: "family", label: t("Leaderboard.scope.family") },
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
      footer={familyOnlyMe ? <Text style={styles.onlyMe}>{t("Leaderboard.familyOnlyMe")}</Text> : null}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.xl },
  onlyMe: { marginTop: spacing.lg, textAlign: "center", fontSize: 14, color: colors.ink2 },
});
