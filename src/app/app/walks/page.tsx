"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Footprints, Hand, Play, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { WalkTrackingView } from "@/components/walks/walk-tracking-view";
import { ManualWalkDialog } from "@/components/walks/manual-walk-dialog";
import { WalkCard } from "@/components/walks/walk-card";
import {
  createWalk,
  deleteWalk,
  listPersonalWalks,
  listWalks,
} from "@/lib/firebase/walks";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import { computeStreak } from "@/lib/scoring";
import {
  getEncouragementHint,
  getTodayProgress,
  getWeekProgress,
  getWeeklyAvgMinutes,
} from "@/lib/walk-tracking";
import { cn } from "@/lib/utils";
import type { Pet, Walk, WalkInput } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

// Spec docs/features/walk-core-redesign.md decisions:
const TODAY_GOAL_MIN = 30;
const WEEK_GOAL_COUNT = 5;
const RECENT_WALKS_LIMIT = 10;

// Per-uid last-selected-pet so a single-device household reopens to the
// same pet the user walked yesterday. Spec edge case "多寵物 上次選的".
const lastPetKey = (uid: string) => `mango.walks.lastPetId.${uid}`;

// Phase 1 (visual-redesign-mango v2) — palette swap to mango.* tokens.
// Structure / logic / state machine untouched. Per-instance className
// overrides on the shared <Button> because Button.tsx is out of scope
// (it would change every CTA across the app — Phase 6 polish).
//
// CTA family used across this page:
//   bg-mango-brand text-mango-ink hover:bg-mango-brand-deep shadow-mango
//   ↑ ink on brand = 7.6:1 AAA (white-on-brand would be 2.6:1, fails AA)
const CTA_MANGO =
  "bg-mango-brand text-mango-ink hover:bg-mango-brand-deep shadow-mango";

export default function WalksPage() {
  const t = useTranslations("Nav");
  const tW = useTranslations("Walks.core");
  const tS = useTranslations("Walks.streak");
  const tE = useTranslations("Walks.encouragement");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [pets, setPets] = useState<Pet[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [petR, walkR] = await Promise.allSettled([
        family ? listPets(family.familyId) : listPersonalPets(user.uid),
        family ? listWalks(family.familyId) : listPersonalWalks(user.uid),
      ]);
      setPets(petR.status === "fulfilled" ? petR.value : []);
      setWalks(walkR.status === "fulfilled" ? walkR.value : []);
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  // Hydrate selected pet from localStorage once we know who's logged in and
  // which pets exist. Falls back to pets[0] when no remembered choice or the
  // remembered id was deleted.
  useEffect(() => {
    if (!user || pets.length === 0) return;
    let stored: string | null = null;
    try {
      stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(lastPetKey(user.uid))
          : null;
    } catch {
      /* private mode / disabled storage — fall through to default */
    }
    const initial =
      stored && pets.some((p) => p.petId === stored) ? stored : pets[0].petId;
    setSelectedPetId(initial);
  }, [user, pets]);

  const handlePickPet = useCallback(
    (id: string) => {
      setSelectedPetId(id);
      if (!user) return;
      try {
        window.localStorage.setItem(lastPetKey(user.uid), id);
      } catch {
        /* best-effort persistence — re-pick stays per-tab on failure */
      }
    },
    [user],
  );

  const todayProgress = useMemo(
    () => getTodayProgress(walks, TODAY_GOAL_MIN),
    [walks],
  );

  const streakDays = useMemo(
    () =>
      computeStreak(
        walks.map((w) => new Date((w.startedAt as Timestamp).toMillis())),
      ),
    [walks],
  );

  const weekProgress = useMemo(
    () => getWeekProgress(walks, WEEK_GOAL_COUNT),
    [walks],
  );

  // Pre-compute fields the completion recap + Hero encouragement need.
  // Doing it on the page keeps the WalkTrackingView decoupled from the
  // walks list query.
  const weeklyAvgMin = useMemo(() => getWeeklyAvgMinutes(walks), [walks]);
  const lastWalkMs = useMemo<number | null>(() => {
    if (walks.length === 0) return null;
    const ts = walks[0].startedAt as Timestamp;
    return ts.toMillis();
  }, [walks]);
  const encouragement = useMemo(
    () =>
      getEncouragementHint({
        todayMinutes: todayProgress.minutes,
        streakDays,
        lastWalkMs,
        petName: pets.find((p) => p.petId === selectedPetId)?.name ?? null,
      }),
    [todayProgress.minutes, streakDays, lastWalkMs, pets, selectedPetId],
  );

  // Most-recent pet from the walks list — drives the "Last walk: Mango"
  // hint shown under the Start CTA when there are 2+ pets.
  const lastWalkedName = useMemo(() => {
    if (walks.length === 0) return null;
    return walks[0].petName ?? null;
  }, [walks]);

  // Promote the user's chosen pet to position 0 so the existing
  // WalkSessionDialog (which auto-selects pets[0] internally) opens on the
  // right pet. Phase 3 will replace this with a proper full-screen view
  // that accepts the selected pet directly.
  const dialogPets = useMemo(() => {
    if (!selectedPetId) return pets;
    const idx = pets.findIndex((p) => p.petId === selectedPetId);
    if (idx <= 0) return pets;
    return [pets[idx], ...pets.slice(0, idx), ...pets.slice(idx + 1)];
  }, [pets, selectedPetId]);

  async function handleCreate(input: WalkInput & { score: number }) {
    if (!user) return;
    const { score, ...rest } = input;
    await createWalk({
      ...rest,
      // family === null → personal walk (not on leaderboard, anti-farm).
      familyId: family?.familyId ?? null,
      walkerUid: user.uid,
      walkerName: user.displayName ?? undefined,
      walkerPhotoURL: user.photoURL,
      score,
    });
    await refresh();
  }

  async function handleDelete(walk: Walk) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: `${walk.distanceKm.toFixed(2)} km · ${walk.durationMin.toFixed(0)} min`,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteWalk(walk.walkId);
    await refresh();
  }

  // No-pets short circuit. Hero needs a target pet, so we route the user to
  // create one before anything else loads.
  if (!loading && pets.length === 0) {
    return (
      <>
        <RouteHeader title={t("walks")} className="mb-6" />
        <EmptyState
          icon={Footprints}
          title={tW("needPetTitle")}
          description={tW("needPetDescription")}
          action={
            <Link
              href="/app/pets"
              className={cn(
                // Mini-Button styled inline (Button component is out of
                // scope for Phase 1). Same CTA family as the Hero.
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                CTA_MANGO,
              )}
            >
              <Plus className="size-4" />
              {tW("needPetCta")}
            </Link>
          }
        />
      </>
    );
  }

  const remainingMin = Math.max(
    0,
    TODAY_GOAL_MIN - Math.round(todayProgress.minutes),
  );
  const goalHit = todayProgress.percent >= 100;
  const todayLabel = goalHit
    ? tW("todayGoalHit")
    : todayProgress.minutes === 0
      ? tW("noWalksToday")
      : tW("todayGoalGap", { min: remainingMin });

  return (
    <>
      <RouteHeader title={t("walks")} className="mb-6" />

      {/* Hero — "Do I need to walk today, and what do I tap to start?" The
          three answers (status copy, progress bar, big CTA) line up in the
          user's eye in one read. */}
      <section
        aria-labelledby="walks-hero-status"
        className="mb-6 flex flex-col gap-5 rounded-xl border border-mango-hairline bg-mango-card p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p
              id="walks-hero-status"
              className="text-lg font-semibold text-mango-ink dark:text-zinc-100 sm:text-xl"
            >
              {todayLabel}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {/* Streak badge — spec D4: always visible in Hero.
                  0-2 days: muted ink-2 number; ≥3: brand-tint chip with 🔥;
                  ≥7: leaf-tint chip with 🔥 (text-green-800 here is a
                  deliberate one-off — see patches/README.md "Deviations"). */}
              <span
                title={streakDays >= 7 ? tS("weekTooltip") : undefined}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                  streakDays >= 7
                    ? "bg-mango-leaf-tint text-green-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                    : streakDays >= 3
                      ? "bg-mango-brand-tint text-mango-brand-deep dark:bg-amber-500/15 dark:text-amber-200"
                      : "text-mango-ink-2 dark:text-zinc-400",
                )}
              >
                {streakDays >= 3 ? "🔥 " : ""}
                {tS("labelShort", { days: streakDays })}
              </span>
              <p className="text-xs tabular-nums text-mango-ink-2 dark:text-zinc-400">
                {tW("todayProgress", {
                  done: Math.round(todayProgress.minutes),
                  goal: TODAY_GOAL_MIN,
                })}
              </p>
            </div>
          </div>
          {/* Encouragement sub-text — pulled from the i18n bank by
              getEncouragementHint based on (today, streak, last walk,
              pet name). One line, low-key. */}
          <p className="text-xs text-mango-ink-2 dark:text-zinc-400">
            {tE(encouragement.key, encouragement.vars)}
          </p>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-mango-hairline dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={todayProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={tW("todayProgress", {
              done: Math.round(todayProgress.minutes),
              goal: TODAY_GOAL_MIN,
            })}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                goalHit ? "bg-mango-leaf" : "bg-mango-amber",
              )}
              style={{ width: `${todayProgress.percent}%` }}
            />
          </div>
        </div>

        {/* Multi-pet picker. Single-pet households skip the chips entirely
            (spec: "單寵物時直接預選"). Segmented chips beat a select because
            tapping a chip is one step, not two.
            Phase 1 palette:
              unselected → brand-tint bg, brand-deep text
              selected   → brand bg, ink text, soft mango shadow
            (mirrors the CTA hierarchy — picked pet visually feeds the
            big orange Start button below.) */}
        {pets.length > 1 && (
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label={tW("pickPet")}
          >
            {pets.map((p) => {
              const active = p.petId === selectedPetId;
              return (
                <button
                  key={p.petId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handlePickPet(p.petId)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
                    active
                      ? "border-transparent bg-mango-brand text-mango-ink shadow-[0_6px_14px_-6px_rgba(243,152,0,0.45)] dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200"
                      : "border-transparent bg-mango-brand-tint text-mango-brand-deep hover:bg-mango-brand-tint/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                >
                  🐾 {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Hero CTA — desktop only. Mobile relies on the sticky bottom CTA
            (renders below) so the user only sees one Start button at a time.
            Desktop has no sticky (md:hidden there) so the Hero CTA stays
            as the start button. Per-instance mango override on Button. */}
        <Button
          onClick={() => setSessionOpen(true)}
          size="lg"
          className={cn(
            "hidden h-14 w-full text-base font-bold sm:text-lg md:inline-flex",
            CTA_MANGO,
          )}
        >
          <Play className="size-5" />
          {tW("startWalking")}
        </Button>

        {pets.length > 1 && lastWalkedName && (
          <p className="hidden text-center text-xs text-mango-ink-2 md:block dark:text-zinc-400">
            {tW("lastWalkedWith", { name: lastWalkedName })}
          </p>
        )}
      </section>

      {/* Second screen — week + streak compact cards. Sit just under the
          Hero so a scroll reveals them; "分數" deliberately dropped per
          spec (kept on /app/leaderboard where it belongs). */}
      <section className="mb-6 grid grid-cols-2 gap-3">
        <article className="flex flex-col gap-2 rounded-xl border border-mango-hairline bg-mango-card p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <p className="text-[11px] font-medium uppercase tracking-wide text-mango-ink-2 dark:text-zinc-400">
            {tW("weekProgressLabel")}
          </p>
          <p className="text-2xl font-bold tabular-nums text-mango-ink dark:text-zinc-100">
            {tW("weekProgressCount", {
              done: weekProgress.count,
              goal: WEEK_GOAL_COUNT,
            })}
          </p>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-mango-hairline dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={weekProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                weekProgress.percent >= 100
                  ? "bg-mango-leaf"
                  : "bg-mango-amber",
              )}
              style={{ width: `${weekProgress.percent}%` }}
            />
          </div>
        </article>
        <article className="flex flex-col gap-2 rounded-xl border border-mango-hairline bg-mango-card p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <p className="text-[11px] font-medium uppercase tracking-wide text-mango-ink-2 dark:text-zinc-400">
            {tW("streakLabel")}
          </p>
          <p className="text-2xl font-bold tabular-nums text-mango-brand-deep dark:text-amber-300">
            {tW("streakDaysCount", { days: streakDays })}
          </p>
        </article>
      </section>

      {/* Recent walks — section header sets expectation that this is a
          summary, not the full archive. Limited to 10 per spec. */}
      {loading ? (
        <p className="text-sm text-mango-ink-2">{tC("loading")}</p>
      ) : walks.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title={tW("emptyWalksTitle")}
          description={tW("emptyWalksDescription")}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-mango-ink-2 dark:text-zinc-300">
            {tW("recentWalks")}
          </h2>
          <div className="flex flex-col gap-3">
            {walks.slice(0, RECENT_WALKS_LIMIT).map((w) => (
              <WalkCard
                key={w.walkId}
                walk={w}
                onDelete={() => handleDelete(w)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Manual log — secondary action at the very bottom. Ghost variant
          + small size so it never competes with the Hero CTA. */}
      <div className="mt-8 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setManualOpen(true)}
          disabled={pets.length === 0}
          className="text-mango-ink-2 hover:bg-mango-bg-alt hover:text-mango-ink"
        >
          <Hand className="size-4" />
          {tW("manualLog")}
        </Button>
      </div>

      {/* Mobile-only spacer so the sticky bottom CTA below can't cover
          the manual-log button when the user scrolls to the very end of
          the page. Grown from h-16 → h-24 alongside the sticky bottom
          bump (3.75rem → 5.75rem) so the raised nav disc has clearance. */}
      <div className="h-24 md:hidden" aria-hidden="true" />

      {/* Sticky bottom CTA — backlog "walks 頁加 sticky bottom CTA"
          (user 2026-05-24 解 A). Duplicates the Hero CTA so "Start
          walking" is always within iPhone thumb reach without scrolling
          back up. Hidden when the tracking view is open (already
          full-screen) and hidden on desktop (Hero is in view alongside
          the sidebar there, sticky would be redundant).
          Phase 1 palette: matches the warm cream + blur nav surface from
          Phase 0.5 so the bottom band reads as a continuous warm strip. */}
      {!sessionOpen && (
        <div
          className="fixed inset-x-0 z-20 border-t border-mango-hairline bg-mango-card-soft/92 px-4 py-3 backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
          style={{
            // 3.75rem nav + 2rem so the sticky bar clears the raised
            // walks-disc's 1rem protrusion + leaves a 1rem visual gap.
            bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)",
          }}
        >
          <Button
            onClick={() => setSessionOpen(true)}
            size="lg"
            className={cn(
              "h-12 w-full text-base font-bold",
              CTA_MANGO,
            )}
          >
            <Play className="size-5" />
            {tW("startWalking")}
          </Button>
        </div>
      )}

      <WalkTrackingView
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        pet={pets.find((p) => p.petId === selectedPetId) ?? null}
        streakDays={streakDays}
        storedTodayMin={todayProgress.minutes}
        goalMin={TODAY_GOAL_MIN}
        weeklyAvgMin={weeklyAvgMin}
        onComplete={handleCreate}
      />
      <ManualWalkDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pets={dialogPets}
        streakDays={streakDays}
        onSubmit={handleCreate}
      />
    </>
  );
}
