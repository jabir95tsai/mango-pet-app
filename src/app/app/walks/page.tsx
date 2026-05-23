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
import { getTodayProgress } from "@/lib/walk-tracking";
import { cn } from "@/lib/utils";
import type { Pet, Walk, WalkInput } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

// Spec docs/features/walk-core-redesign.md decision: 30-min today goal.
const TODAY_GOAL_MIN = 30;

// Per-uid last-selected-pet so a single-device household reopens to the
// same pet the user walked yesterday. Spec edge case "多寵物 上次選的".
const lastPetKey = (uid: string) => `mango.walks.lastPetId.${uid}`;

export default function WalksPage() {
  const t = useTranslations("Nav");
  const tW = useTranslations("Walks.core");
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

  const weekTotals = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recent = walks.filter(
      (w) => (w.startedAt as Timestamp).toMillis() > weekAgo,
    );
    return {
      count: recent.length,
      distanceKm: recent.reduce((s, w) => s + w.distanceKm, 0),
      durationMin: recent.reduce((s, w) => s + w.durationMin, 0),
      score: recent.reduce((s, w) => s + w.score, 0),
    };
  }, [walks]);

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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-zinc-950"
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
        className="mb-6 flex flex-col gap-5 rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p
              id="walks-hero-status"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 sm:text-xl"
            >
              {todayLabel}
            </p>
            <p className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {tW("todayProgress", {
                done: Math.round(todayProgress.minutes),
                goal: TODAY_GOAL_MIN,
              })}
            </p>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
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
                goalHit ? "bg-emerald-500" : "bg-amber-500",
              )}
              style={{ width: `${todayProgress.percent}%` }}
            />
          </div>
        </div>

        {/* Multi-pet picker. Single-pet households skip the chips entirely
            (spec: "單寵物時直接預選"). Segmented chips beat a select because
            tapping a chip is one step, not two. */}
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
                    "h-9 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    active
                      ? "border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900",
                  )}
                >
                  🐾 {p.name}
                </button>
              );
            })}
          </div>
        )}

        <Button
          onClick={() => setSessionOpen(true)}
          size="lg"
          className="h-14 w-full text-base font-semibold sm:text-lg"
        >
          <Play className="size-5" />
          {tW("startWalking")}
        </Button>

        {pets.length > 1 && lastWalkedName && (
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            {tW("lastWalkedWith", { name: lastWalkedName })}
          </p>
        )}
      </section>

      {/* Existing weekly stat row — kept here for Phase 2 so the page still
          shows streak/week info while the Hero lands. Phase 5 replaces this
          row with a compact week+streak block under the Hero. */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-zinc-200/80 bg-white p-4 text-center shadow-sm shadow-zinc-200/40 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
        <Stat label="連續天數" value={`${streakDays}`} suffix="天" accent />
        <Stat label="本週次數" value={`${weekTotals.count}`} />
        <Stat
          label="本週距離"
          value={`${weekTotals.distanceKm.toFixed(1)}`}
          suffix="km"
        />
        <Stat label="本週分數" value={`${weekTotals.score.toFixed(0)}`} />
      </div>

      {/* Manual log — ghost variant so it doesn't compete with the Hero CTA.
          Phase 5 will move this to a real secondary slot at the page bottom. */}
      <div className="mb-6 flex justify-end">
        <Button
          variant="ghost"
          onClick={() => setManualOpen(true)}
          disabled={pets.length === 0}
        >
          <Hand className="size-4" />
          補登
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : walks.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title="尚無遛狗紀錄"
          description="按下「開始遛狗」即時追蹤，或「補登」手動加入。"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {walks.map((w) => (
            <WalkCard key={w.walkId} walk={w} onDelete={() => handleDelete(w)} />
          ))}
        </div>
      )}

      <WalkTrackingView
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        pet={pets.find((p) => p.petId === selectedPetId) ?? null}
        streakDays={streakDays}
        storedTodayMin={todayProgress.minutes}
        goalMin={TODAY_GOAL_MIN}
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

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span
        className={`text-lg font-bold tabular-nums ${
          accent ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
        {suffix && (
          <span className="text-xs font-normal text-zinc-500 ml-0.5">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}
