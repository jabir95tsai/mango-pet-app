"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PawPrint, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DogLeaderboardRow } from "@/components/leaderboard/dog-leaderboard-row";
import { useDogEntryGlow } from "@/components/leaderboard/use-glow";
import { subscribeDogLeaderboard } from "@/lib/firebase/leaderboards";
import { listFriends } from "@/lib/firebase/friends";
import type { DogLeaderboardEntry, LeaderboardPeriod } from "@/lib/types";

type DogScope = "friends" | "all";
const DOG_SCOPE_STORAGE_KEY = "mango.leaderboard.dogScope";

/**
 * Dog-centric leaderboard (leaderboard v2). Net-new surface: reads the
 * backend's `dogLeaderboards/{period}/entries` and renders two scope
 * tabs (friends / all-app) over the shared weekly/monthly/all-time
 * period tabs. All visibility + friends filtering is client-side —
 * entries carry denormalised ownerUid / ownerVisibility so no
 * cross-family pet reads are needed (spec ③).
 *
 * Coexists with the walker board; this component owns its own header +
 * refresh so it stays fully self-contained under the page's 人/狗
 * dimension switch. Works in personal mode (dog entries include
 * personal-mode dogs, and the collection is readable by any signed-in
 * user).
 */
export function DogLeaderboard() {
  const tLb = useTranslations("Leaderboard");
  const tDog = useTranslations("Leaderboard.dog");
  const tC = useTranslations("Common");
  const { user } = useAuth();

  // Default to the friends tab — the user story centres on competing in
  // your friend circle, and your own dogs always show here even before
  // you add anyone, so it's never a dead end. Persisted per visit.
  const [scope, setScope] = useState<DogScope>("friends");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<DogLeaderboardEntry[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Restore last-selected scope from localStorage on first mount.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const saved = localStorage.getItem(DOG_SCOPE_STORAGE_KEY) as DogScope | null;
    if (saved === "friends" || saved === "all") setScope(saved);
  }, []);

  // Realtime listener so the recomputeDogLeaderboards trigger's writes
  // reach the page within 1-2s — letting useDogEntryGlow flash the row.
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeDogLeaderboard(
      period,
      (next) => {
        setEntries(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [period, refreshNonce]);

  // Friends: one-shot fetch (used only by the friends tab's client
  // filter). Re-runs on manual refresh so a freshly-accepted friend's
  // dogs show up without a reload.
  useEffect(() => {
    if (!user) {
      setFriendUids(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const friends = await listFriends(user.uid);
        if (!cancelled) setFriendUids(new Set(friends.map((f) => f.uid)));
      } catch {
        if (!cancelled) setFriendUids(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshNonce]);

  function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshNonce((n) => n + 1);
    // Hold the spinner 800ms so an instant re-subscribe still reads as
    // "I did something" (matches the walker board's refresh feel).
    window.setTimeout(() => setIsRefreshing(false), 800);
  }

  function handleScopeChange(next: DogScope) {
    setScope(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DOG_SCOPE_STORAGE_KEY, next);
    }
  }

  const myUid = user?.uid;

  // Per-tab client filter. Both tabs ALWAYS show the user's own dogs
  // (even when their visibility is 'off') so a user who opted out can
  // still track their own ranking — spec ③ "永遠看得到自己的狗".
  // Entries arrive pre-sorted by totalScore desc, so filtering keeps
  // rank order and rank = index + 1 within the visible set.
  const visibleEntries = useMemo<DogLeaderboardEntry[]>(() => {
    return entries.filter((e) => {
      if (myUid && e.ownerUid === myUid) return true;
      if (scope === "all") return e.ownerVisibility === "public";
      return (
        friendUids.has(e.ownerUid) &&
        (e.ownerVisibility === "public" || e.ownerVisibility === "friends")
      );
    });
  }, [entries, scope, friendUids, myUid]);

  // Glow signal — diff lastUpdatedAt across realtime snapshots. Feed the
  // source-of-truth `entries` (not the filtered view) so the baseline
  // diff is stable across tab switches.
  const glowing = useDogEntryGlow(entries);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <RouteHeader
          title={tLb("title")}
          subtitle={tDog("subtitle")}
          className="mb-0 min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label={tLb("refreshButton")}
          title={tLb("refreshButton")}
          className="grid size-11 shrink-0 place-items-center rounded-full text-mango-brand-deep transition-colors hover:bg-mango-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-60"
        >
          <RefreshCw
            className={
              isRefreshing
                ? "size-5 animate-spin motion-reduce:animate-none"
                : "size-5"
            }
            strokeWidth={2}
          />
        </button>
      </div>

      <div className="mb-3">
        <Tabs<DogScope>
          value={scope}
          onChange={handleScopeChange}
          options={[
            { value: "friends", label: tDog("scope.friends") },
            { value: "all", label: tDog("scope.all") },
          ]}
        />
      </div>

      <div className="mb-4">
        <Tabs<LeaderboardPeriod>
          value={period}
          onChange={setPeriod}
          options={[
            { value: "weekly", label: tLb("period.weekly") },
            { value: "monthly", label: tLb("period.monthly") },
            { value: "all_time", label: tLb("period.all_time") },
          ]}
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : visibleEntries.length === 0 ? (
        scope === "friends" ? (
          <EmptyState
            icon={Users}
            title={tDog("emptyFriends.title")}
            description={tDog("emptyFriends.subtitle")}
            action={
              <Link href="/app/friends">
                <Button variant="secondary">
                  <Users className="size-4" />
                  {tDog("emptyFriends.cta")}
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={PawPrint}
            title={tDog("emptyAll.title")}
            description={tDog("emptyAll.subtitle")}
          />
        )
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {visibleEntries.map((e, idx) => (
            <DogLeaderboardRow
              key={e.petId}
              rank={idx + 1}
              entry={e}
              highlight={!!myUid && e.ownerUid === myUid}
              isGlowing={glowing.has(e.petId)}
            />
          ))}
        </div>
      )}
    </>
  );
}
