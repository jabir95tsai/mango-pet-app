"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, Footprints, Hand, Play, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { WalkTrackingView } from "@/components/walks/walk-tracking-view";
import { ManualWalkDialog } from "@/components/walks/manual-walk-dialog";
import { WalksDial } from "@/components/walks/walks-dial";
import { WalksWeekStrip } from "@/components/walks/walks-week-strip";
import { WalksConfettiDecor } from "@/components/walks/walks-confetti-decor";
import { StreakChip } from "@/components/walks/streak-chip";
import { WalkRow } from "@/components/walks/walk-row";
import {
  createWalk,
  deleteWalk,
  listPersonalWalks,
  listWalks,
} from "@/lib/firebase/walks";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import { computeStreak } from "@/lib/scoring";
import {
  getTodayProgress,
  getWeeklyAvgMinutes,
} from "@/lib/walk-tracking";
import { cn } from "@/lib/utils";
import type { Pet, Walk, WalkInput } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

// Spec decisions:
const TODAY_GOAL_MIN = 30;
const WEEK_GOAL_COUNT = 5;
const RECENT_WALKS_LIMIT = 5;

// CTA family — ink on brand mango (7.6:1 AAA). Shared across hero CTA
// (desktop), sticky CTA (mobile), and the empty-state inline link.
const CTA_MANGO =
  "bg-mango-brand text-mango-ink hover:bg-mango-brand-deep shadow-mango";

/** ISO-8601 week start (Monday 00:00 device-local). Mirrors the helper
 *  inside `walk-tracking.ts` but re-implemented here per spec rule
 *  "不動 walk-tracking.ts". */
function startOfWeekLocal(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const daysFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

/** Day index 0..6 (Monday=0) for "today". */
function todayIdxLocal(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

/** Per-day minute totals for this week → boolean array of length 7,
 *  Monday-first, true if that day's total minutes >= goalMin. */
function getWeekDayDoneFlags(walks: Walk[], goalMin: number): boolean[] {
  const start = startOfWeekLocal().getTime();
  const dayMs = 24 * 3600 * 1000;
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const w of walks) {
    const ts = w.startedAt as Timestamp | undefined;
    if (!ts) continue;
    const t = ts.toMillis();
    const idx = Math.floor((t - start) / dayMs);
    if (idx >= 0 && idx < 7) {
      totals[idx] += w.durationMin ?? 0;
    }
  }
  return totals.map((m) => m >= goalMin);
}

/** Total km across this week (used in the week-strip header summary). */
function getWeekKm(walks: Walk[]): number {
  const start = startOfWeekLocal().getTime();
  let km = 0;
  for (const w of walks) {
    const ts = w.startedAt as Timestamp | undefined;
    if (!ts) continue;
    if (ts.toMillis() >= start) km += w.distanceKm ?? 0;
  }
  return km;
}

/** This-week walk count (matches the dial's data shape — counted by
 *  walks not days). */
function getWeekWalkCount(walks: Walk[]): number {
  const start = startOfWeekLocal().getTime();
  let n = 0;
  for (const w of walks) {
    const ts = w.startedAt as Timestamp | undefined;
    if (!ts) continue;
    if (ts.toMillis() >= start) n += 1;
  }
  return n;
}

export default function WalksPage() {
  const t = useTranslations("Nav");
  const tW = useTranslations("Walks.core");
  const tP = useTranslations("Walks.page");
  const tS = useTranslations("Walks.streak");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [pets, setPets] = useState<Pet[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

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

  // Primary pet = earliest createdAt. Spec edge case "多 pet user
  // → top-bar only shows primary pet; multi-pet picker DEFERRED".
  // Single-pet user falls through to the same code path.
  const primaryPet = useMemo<Pet | null>(() => {
    if (pets.length === 0) return null;
    return [...pets].sort((a, b) => {
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return at - bt;
    })[0];
  }, [pets]);
  const hasMultiplePets = pets.length > 1;

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

  const weekDayFlags = useMemo(
    () => getWeekDayDoneFlags(walks, TODAY_GOAL_MIN),
    [walks],
  );
  const weekKm = useMemo(() => getWeekKm(walks), [walks]);
  const weekCount = useMemo(() => getWeekWalkCount(walks), [walks]);
  const todayIdx = useMemo(() => todayIdxLocal(), []);

  const weeklyAvgMin = useMemo(() => getWeeklyAvgMinutes(walks), [walks]);

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

  // No-pets short circuit — same as before, just re-styled into the
  // mango CTA family.
  if (!loading && pets.length === 0) {
    return (
      <>
        <EmptyState
          icon={Footprints}
          title={tW("needPetTitle")}
          description={tW("needPetDescription")}
          action={
            <Link
              href="/app/pets"
              className={cn(
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
  const doneMin = Math.round(todayProgress.minutes);
  const petName = primaryPet?.name ?? "";

  // Hero copy — title + sub-line. Spec format:
  //   "再走 {min} 分鐘" / "達標了 🎉"
  //   "{pet} 今天走了 {done} 分 · 連續 {streak} 天"
  const heroTitle = goalHit
    ? tP("heroComplete")
    : tP("heroIncomplete", { min: remainingMin });
  const heroSub = petName
    ? tP("heroSub", { pet: petName, done: doneMin, streak: streakDays })
    : tP("heroSubNoPet", { done: doneMin, streak: streakDays });

  return (
    <>
      {/* Confetti decor — only when today's goal is met. Sits at -z-0
          behind the top section so it doesn't intercept taps. */}
      {goalHit && (
        <div className="relative">
          <WalksConfettiDecor />
        </div>
      )}

      {/* Top bar — title (left) + Mango pill (multi-pet primary) +
          streak chip (right). Spec: chevron is decoration only;
          multi-pet picker is DEFERRED to a follow-up spec. */}
      <div className="relative z-10 mb-3 flex items-center gap-2.5">
        <h1 className="text-[22px] font-bold tracking-tight text-mango-ink">
          {t("walks")}
        </h1>
        {primaryPet && (
          <button
            type="button"
            disabled={!hasMultiplePets}
            aria-label={
              hasMultiplePets
                ? tP("multiPetHint", { pet: primaryPet.name })
                : primaryPet.name
            }
            title={hasMultiplePets ? tP("multiPetHint", { pet: primaryPet.name }) : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-mango-hairline bg-mango-card py-1 pl-1 pr-2.5 text-[13px] font-semibold text-mango-ink",
              hasMultiplePets
                ? "cursor-default opacity-100"
                : "cursor-default",
            )}
          >
            <span
              aria-hidden="true"
              className="grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full bg-[#f7c168] text-[13px]"
            >
              🐶
            </span>
            <span className="truncate max-w-[6.5rem]">{primaryPet.name}</span>
            {hasMultiplePets && (
              <ChevronDown
                className="size-3 text-mango-ink-3"
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <div className="flex-1" />
        <StreakChip
          streakDays={streakDays}
          label={tS("labelShort", { days: streakDays })}
          weekTooltip={tS("weekTooltip")}
        />
      </div>

      {/* Hero copy — title + sub-line. Mounts above the dial. */}
      <div className="relative z-10 mb-3 px-1">
        <h2
          className="text-[26px] font-bold leading-tight tracking-tight text-mango-ink"
          aria-live="polite"
        >
          {heroTitle}
        </h2>
        <p className="mt-1 text-[13px] font-medium text-mango-ink-2">
          {heroSub}
        </p>
      </div>

      {/* Dial — the page's hero element. 232px radial with walking dog
          inside. Bottom pill ({done} / {goal} 分) overlaps the ring. */}
      <div className="relative z-10 mb-6 pt-2 pb-6">
        <WalksDial
          percent={todayProgress.percent}
          complete={goalHit}
          doneMin={todayProgress.minutes}
          goalMin={TODAY_GOAL_MIN}
        />
      </div>

      {/* Week strip — 7 days Mon-Sun + summary header */}
      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="text-xs font-semibold text-mango-ink-2">
            {tP("weekLabel")}
          </span>
          <span className="text-xs text-mango-ink-3">
            <strong className="font-bold text-mango-ink">{weekCount}</strong>
            {" / "}
            {WEEK_GOAL_COUNT}
            {" · "}
            <span className="tabular-nums">{weekKm.toFixed(1)}</span>
            {" km"}
          </span>
        </div>
        <WalksWeekStrip
          days={weekDayFlags}
          todayIdx={todayIdx}
          complete={goalHit}
        />
      </section>

      {/* Recent walks — compact rows (max 5). "全部" → /app/walks history
          page is OUT of scope for v2 (placeholder text only for now). */}
      {loading ? (
        <p className="text-sm text-mango-ink-2">{tC("loading")}</p>
      ) : walks.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title={tW("emptyWalksTitle")}
          description={tW("emptyWalksDescription")}
        />
      ) : (
        <section className="mb-6">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-sm font-semibold text-mango-ink">
              {tP("recentTitle")}
            </h3>
            {/* "View all" link — TODO: target the future history page
                when one exists. For now it just labels intent so the
                user understands the list is truncated. */}
            <span className="text-xs font-semibold text-mango-brand-deep">
              {tP("viewAll")}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {walks.slice(0, RECENT_WALKS_LIMIT).map((w) => (
              <WalkRow
                key={w.walkId}
                walk={w}
                onDelete={() => handleDelete(w)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Manual log — secondary action; small, low-contrast so it never
          competes with the sticky CTA. */}
      <div className="mt-6 flex justify-center">
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

      {/* Mobile-only spacer — sticky CTA below sits 5.75rem above
          viewport bottom (3.75rem nav + 1rem disc protrusion + 1rem
          gap), spacer h-24 keeps the tail content above it. */}
      <div className="h-24 md:hidden" aria-hidden="true" />

      {/* Sticky bottom CTA — variant swap on goalHit:
            incomplete  → orange gradient pill ▶ 開始遛狗
            complete    → white pill with brand border + 「再遛一次」 */}
      {!sessionOpen && (
        <div
          className="fixed inset-x-0 z-20 border-t border-mango-hairline bg-mango-card-soft/92 px-4 py-3 backdrop-blur-md md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
        >
          <button
            type="button"
            onClick={() => setSessionOpen(true)}
            disabled={pets.length === 0}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-bold transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
              goalHit
                ? "border-[1.5px] border-mango-brand bg-mango-card text-mango-ink"
                : "border-0 text-mango-ink",
            )}
            style={
              goalHit
                ? {
                    boxShadow:
                      "0 10px 24px -8px rgba(80,50,10,0.22)",
                  }
                : {
                    background:
                      "linear-gradient(180deg, #f39800 0%, #d77b00 100%)",
                    boxShadow:
                      "0 16px 32px -8px rgba(243,152,0,0.60), 0 4px 10px -4px rgba(180,100,0,0.35), 0 1px 0 rgba(255,255,255,0.3) inset",
                  }
            }
          >
            {goalHit ? (
              <>
                <Plus className="size-5 text-mango-brand-deep" strokeWidth={2.5} />
                {tP("walkAgain")}
              </>
            ) : (
              <>
                <Play className="size-5" />
                {tW("startWalking")}
              </>
            )}
          </button>
        </div>
      )}

      {/* Desktop Hero CTA — sticky is md:hidden so desktop needs its own
          start button. Lives below the manual log row visually but only
          renders on md+. */}
      <div className="mt-4 hidden justify-center md:flex">
        <Button
          onClick={() => setSessionOpen(true)}
          size="lg"
          disabled={pets.length === 0}
          className={cn(
            "h-14 w-full max-w-xs text-base font-bold sm:text-lg",
            CTA_MANGO,
          )}
        >
          {goalHit ? (
            <>
              <Plus className="size-5" />
              {tP("walkAgain")}
            </>
          ) : (
            <>
              <Play className="size-5" />
              {tW("startWalking")}
            </>
          )}
        </Button>
      </div>

      <WalkTrackingView
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        pet={primaryPet}
        streakDays={streakDays}
        storedTodayMin={todayProgress.minutes}
        goalMin={TODAY_GOAL_MIN}
        weeklyAvgMin={weeklyAvgMin}
        onComplete={handleCreate}
      />
      <ManualWalkDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pets={pets}
        streakDays={streakDays}
        onSubmit={handleCreate}
      />
    </>
  );
}
