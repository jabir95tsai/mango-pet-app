"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Trophy, Users } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-row";
import { listLeaderboard } from "@/lib/firebase/leaderboards";
import { listFamilyMembers } from "@/lib/firebase/families";
import type {
  FamilyMember,
  LeaderboardEntry,
  LeaderboardPeriod,
} from "@/lib/types";

type Scope = "all" | "family";
const SCOPE_STORAGE_KEY = "mango.leaderboard.scope";

export default function LeaderboardPage() {
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

  // Restore last-selected scope from localStorage on first mount.
  // Personal-mode users never see the toggle so this is a no-op for
  // them — the branch below short-circuits before scope matters.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY) as Scope | null;
    if (saved === "family" || saved === "all") setScope(saved);
  }, []);

  const refresh = useCallback(async () => {
    if (familyLoading) return;
    if (!family) {
      // Personal mode — nothing to fetch. The empty-state branch below
      // doesn't render LeaderboardRow at all.
      setEntries([]);
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // allSettled so a slow members fetch doesn't blank the leaderboard
      // (and vice versa). Each section degrades independently.
      const [entriesR, membersR] = await Promise.allSettled([
        listLeaderboard(period),
        listFamilyMembers(family),
      ]);
      setEntries(entriesR.status === "fulfilled" ? entriesR.value : []);
      setMembers(membersR.status === "fulfilled" ? membersR.value : []);
    } finally {
      setLoading(false);
    }
  }, [familyLoading, family, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <RouteHeader
          title={t("leaderboard")}
          subtitle="加權公式：距離×體型係數 + 時長 + 連續天數"
          className="mb-0"
        />
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
            { value: "weekly", label: "本週" },
            { value: "monthly", label: "本月" },
            { value: "all_time", label: "總榜" },
          ]}
        />
      </div>

      {loading || familyLoading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="排行榜計算中"
          description="Cloud Function 每天午夜 (Asia/Taipei) 聚合一次。先去遛狗累積分數！"
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
