"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RefreshCw, Trophy, Users } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-row";
import { useLeaderboardEntryGlow } from "@/components/leaderboard/use-glow";
import { subscribeLeaderboard } from "@/lib/firebase/leaderboards";
import { listFamilyMembers } from "@/lib/firebase/families";
import type {
  FamilyMember,
  LeaderboardEntry,
  LeaderboardPeriod,
} from "@/lib/types";

type Scope = "all" | "family";
const SCOPE_STORAGE_KEY = "mango.leaderboard.scope";

/**
 * Walker (human) leaderboard. Extracted verbatim from the original
 * leaderboard page so it can sit under the 人/狗 dimension switch
 * unchanged — behaviour, scoring, scope/period tabs, glow, refresh,
 * and the personal-mode empty state are all exactly as before.
 */
export function HumanLeaderboard() {
  const t = useTranslations("Nav");
  const tC = useTranslations("Common");
  const tLb = useTranslations("Leaderboard");
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [scope, setScope] = useState<Scope>("all");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  // Manual refresh wiring (spec Item #4). `refreshNonce` flips on click
  // so the subscribe-leaderboard useEffect re-runs and tears down /
  // re-creates the Firestore listener; `isRefreshing` drives the icon
  // spinner + disabled state, auto-clearing after 800ms so the user
  // gets visible feedback even when the data was already up-to-date.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Restore last-selected scope from localStorage on first mount.
  // Personal-mode users never see the toggle so this is a no-op for
  // them — the branch below short-circuits before scope matters.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY) as Scope | null;
    if (saved === "family" || saved === "all") setScope(saved);
  }, []);

  // Entries: realtime listener so the recomputeWalkerLeaderboards
  // trigger's writes reach the page within 1-2s — letting the glow
  // hook detect lastUpdatedAt deltas and flash the row. Personal mode
  // bypasses the listener (the empty-state branch returns before any
  // row renders).
  useEffect(() => {
    if (familyLoading) return;
    if (!family) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeLeaderboard(
      period,
      (next) => {
        setEntries(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [familyLoading, family, period, refreshNonce]);

  function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshNonce((n) => n + 1);
    refreshMembers();
    // Hold the spinner for 800ms so even instant re-subscribe reads as
    // "I did something." Clearing earlier on data arrival would look
    // like a flicker.
    window.setTimeout(() => setIsRefreshing(false), 800);
  }

  // Members: one-shot fetch — family member list rarely changes, no
  // realtime needed. Re-runs if family doc swaps under us.
  const refreshMembers = useCallback(async () => {
    if (familyLoading || !family) {
      setMembers([]);
      return;
    }
    try {
      const m = await listFamilyMembers(family);
      setMembers(m);
    } catch {
      setMembers([]);
    }
  }, [familyLoading, family]);

  useEffect(() => {
    refreshMembers();
  }, [refreshMembers]);

  function handleScopeChange(next: Scope) {
    setScope(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SCOPE_STORAGE_KEY, next);
    }
  }

  // Build the family-scope view: every family member appears, even those
  // who never walked (zero-score placeholder). Spec C: "成員 leaderboard
  // entry 不存在 → 顯示但分數 0、灰底，不要漏人."
  // Hook stays above the early return so React's rules-of-hooks holds.
  const familyEntries: LeaderboardEntry[] = useMemo(() => {
    if (!family || members.length === 0) return [];
    const entriesByUid = new Map(entries.map((e) => [e.uid, e]));
    const fakeUpdatedAt = Timestamp.now();
    return members
      .map(
        (m) =>
          entriesByUid.get(m.uid) ??
          ({
            uid: m.uid,
            displayName: m.displayName,
            photoURL: m.photoURL,
            totalScore: 0,
            totalDistanceKm: 0,
            totalDurationMin: 0,
            walkCount: 0,
            streakDays: 0,
            updatedAt: fakeUpdatedAt,
          } as LeaderboardEntry),
      )
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [family, members, entries]);

  // Glow signal — diff lastUpdatedAt across realtime snapshots. We feed
  // the source-of-truth `entries` (not `visibleEntries`, which has the
  // zero-score placeholder rows that never have a real lastUpdatedAt and
  // would never glow anyway). MUST stay above the personal-mode early
  // return below so the hook count is constant across renders — otherwise
  // a personal-mode / guest user (no family) crashes with React error
  // #300 ("rendered fewer hooks than expected") the moment familyLoading
  // flips false. (Guest-login made this reachable: guests are always
  // personal-mode and the spec lets them view the board.)
  const glowing = useLeaderboardEntryGlow(entries);

  // ── Personal mode branch (spec B): empty state + CTA ─────────────
  // No toggle, no period tabs, no rows — just the explanation card.
  // Gated on familyLoading so we don't flash the empty state to a
  // family user while their family doc is loading.
  if (!familyLoading && !family) {
    return (
      <>
        <RouteHeader title={t("leaderboard")} className="mb-4" />
        <EmptyState
          icon={Trophy}
          title={tLb("personalEmpty.title")}
          description={tLb("personalEmpty.subtitle")}
          action={
            <Link href="/onboarding">
              <Button>
                <Users className="size-4" />
                {tLb("personalEmpty.cta")}
              </Button>
            </Link>
          }
        />
      </>
    );
  }

  // ── Family mode (toggle + period tabs + rows) ────────────────────
  const visibleEntries = scope === "family" ? familyEntries : entries;
  const isFamilyOnlyMe =
    scope === "family" && members.length === 1 && visibleEntries.length === 1;

  return (
    <>
      {/* Header row — refresh icon button anchored to the page's
          top-right corner per user 2026-05-25. Pulled out of
          RouteHeader's `action` slot so it sits as a sibling, keeping
          the button visually pinned far-right while the title +
          subtitle stack hugs the left. items-start so the button stays
          at the top edge even when the subtitle wraps. */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <RouteHeader
          title={t("leaderboard")}
          subtitle={tLb("humanSubtitle")}
          className="mb-0 flex-1 min-w-0"
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
        <Tabs<Scope>
          value={scope}
          onChange={handleScopeChange}
          options={[
            { value: "all", label: tLb("scope.all") },
            { value: "family", label: tLb("scope.family") },
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

      {loading || familyLoading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={tLb("computing.title")}
          description={tLb("computing.subtitle")}
        />
      ) : (
        <>
          <div className="grid gap-2 lg:grid-cols-2">
            {visibleEntries.map((e, idx) => (
              <LeaderboardRow
                key={e.uid}
                rank={idx + 1}
                entry={e}
                highlight={e.uid === user?.uid}
                isGlowing={glowing.has(e.uid)}
              />
            ))}
          </div>
          {isFamilyOnlyMe && (
            <p className="mt-4 text-center text-sm text-zinc-500">
              {tLb("familyOnlyMe")}
            </p>
          )}
        </>
      )}
    </>
  );
}
