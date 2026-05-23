"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronDown, Square, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  WalkSession,
  type WalkErrorKind,
  type WalkSessionState,
} from "@/lib/walk-tracking";
import { computeWalkScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import type { Pet, WalkInput } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pet chosen on the Hero. The view does NOT show a pet picker — the
   *  Hero is the only place that decision lives. */
  pet: Pet | null;
  streakDays: number;
  /** Today's already-logged minutes BEFORE this session, so the live bar
   *  can blend "stored + current session". */
  storedTodayMin: number;
  goalMin: number;
  onComplete: (input: WalkInput & { score: number }) => Promise<void>;
};

// Map the session's structured error kind to a short, localized hint. The
// raw `lastError` from WalkSession is Chinese-only and longer than what
// fits in the full-screen tracking layout.
function errorKindToKey(kind: WalkErrorKind | null): string | null {
  switch (kind) {
    case "permission_denied":
      return "errDenied";
    case "position_unavailable":
      return "errWeak";
    case "timeout":
      return "errRetrying";
    case "unsupported":
      return "errUnsupported";
    case "backgrounded":
      return "errBackground";
    default:
      return null;
  }
}

function fmtMmSs(durationMin: number): { mm: string; ss: string } {
  const total = Math.max(0, Math.floor(durationMin * 60));
  return {
    mm: String(Math.floor(total / 60)).padStart(2, "0"),
    ss: String(total % 60).padStart(2, "0"),
  };
}

/**
 * Full-screen walking view. Replaces the old WalkSessionDialog modal —
 * spec docs/features/walk-core-redesign.md "B. 追蹤中畫面" calls for
 * `fixed inset-0` so the timer, distance, and stop button are the only
 * things on screen during a walk (no nav, no other CTAs competing).
 *
 * Phases:
 *   - "tracking" — auto-started on open, ticks until user taps stop
 *   - "done" — currently a save form (notes + save). Phase 4 will replace
 *     this with the in-page complete view (auto-save + two secondary CTAs).
 */
export function WalkTrackingView({
  open,
  onClose,
  pet,
  streakDays,
  storedTodayMin,
  goalMin,
  onComplete,
}: Props) {
  const tW = useTranslations("Walks.core");
  const router = useRouter();
  const sessionRef = useRef<WalkSession | null>(null);
  const [state, setState] = useState<WalkSessionState | null>(null);
  const [phase, setPhase] = useState<"tracking" | "done">("tracking");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Open → spin up session, auto-start. Close → tear down + release wake lock
  // (handled inside session.stop()).
  useEffect(() => {
    if (!open) return;
    if (!pet) return;
    const session = new WalkSession();
    sessionRef.current = session;
    const unsub = session.on(setState);
    setPhase("tracking");
    setNotes("");
    setNotesOpen(false);
    setSaveError(null);
    setSaved(false);
    session.start();
    return () => {
      unsub();
      session.stop();
      sessionRef.current = null;
    };
  }, [open, pet]);

  // Body scroll lock while the view is open (mirrors the previous Dialog).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function handleStop() {
    sessionRef.current?.stop();
    setPhase("done");
  }

  /**
   * Save the walk exactly once. Notes are taken from current state so the
   * user can add them after stopping but before tapping a CTA. The spec
   * says "停止 = 儲存成功" — from the user's POV the walk is captured at
   * stop; the actual Firestore write is deferred ~one click later to the
   * CTA so notes can ride along without a separate updateWalk path (UI/UX
   * role doesn't add Firebase functions).
   */
  async function saveWalkOnce(): Promise<boolean> {
    if (saved) return true;
    if (!sessionRef.current || !state || !state.startedAt || !pet) {
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const score = computeWalkScore({
        distanceKm: state.totalDistanceKm,
        durationMin: state.durationMin,
        pet,
        streakDays,
      });
      await onComplete({
        petId: pet.petId,
        petName: pet.name,
        startedAt: state.startedAt,
        endedAt: new Date(),
        distanceKm: state.totalDistanceKm,
        durationMin: state.durationMin,
        path: state.path,
        isManual: false,
        notes: notes.trim() || undefined,
        score,
      });
      setSaved(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : tW("saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleBackToWalking() {
    const ok = await saveWalkOnce();
    if (ok) onClose();
  }

  async function handleViewLeaderboard() {
    const ok = await saveWalkOnce();
    if (ok) {
      onClose();
      router.push("/app/leaderboard");
    }
  }

  if (!open || !pet || typeof document === "undefined") return null;

  // Live blend of stored today + current session minutes for the bar.
  const blended = state
    ? WalkSession.blendTodayProgress(storedTodayMin, state.durationMin, goalMin)
    : {
        minutes: storedTodayMin,
        goalMin,
        percent: Math.min(100, Math.round((storedTodayMin / goalMin) * 100)),
      };

  // At stop time `state.durationMin` freezes, so the same `blended` value
  // also drives the done-view headline ("Goal hit!" vs "Today's X%").
  const finalBlended = blended;
  const finalGoalHit = finalBlended.percent >= 100;

  const { mm, ss } = fmtMmSs(state?.durationMin ?? 0);
  const errKey = errorKindToKey(state?.errorKind ?? null);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950"
      role="dialog"
      aria-modal="true"
      aria-label={tW("tracking")}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {phase === "tracking" && state && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
          {/* Status pill — animated dot doubles as "still recording" signal */}
          <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full bg-amber-500",
                !state.isPaused && "animate-pulse",
              )}
            />
            {state.isPaused ? tW("paused") : tW("tracking")}
            <span className="text-zinc-500 dark:text-zinc-400">
              · 🐾 {pet.name}
            </span>
          </div>

          <p className="font-bold tabular-nums text-7xl text-zinc-900 dark:text-zinc-100 sm:text-8xl">
            {mm}:{ss}
          </p>

          <p className="text-3xl font-semibold tabular-nums text-zinc-700 dark:text-zinc-300 sm:text-4xl">
            {state.totalDistanceKm.toFixed(2)}
            <span className="ml-1 text-base font-normal text-zinc-500">km</span>
          </p>

          <div className="w-full max-w-xs">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-xs text-zinc-500">
                {tW("todayPercent", { percent: blended.percent })}
              </p>
              <p className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                {Math.round(blended.minutes)} / {goalMin} min
              </p>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-valuenow={blended.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  blended.percent >= 100 ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{ width: `${blended.percent}%` }}
              />
            </div>
          </div>

          {errKey && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                state.errorKind === "permission_denied"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              <AlertTriangle className="size-3.5" />
              {tW(errKey)}
            </p>
          )}

          <Button
            variant="danger"
            onClick={handleStop}
            className="h-14 w-full max-w-xs text-base font-semibold"
          >
            <Square className="size-5" />
            {tW("stop")}
          </Button>
        </div>
      )}

      {phase === "done" && state && (
        <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 px-6 py-8 sm:max-w-md">
          {/* Completion headline. Emerald + Trophy when the goal was hit
              today (stored + this session ≥ goalMin), amber percent line
              otherwise. Both copy variants stay short and warm — no
              "scoring" detail (spec: 分數 not in main visual). */}
          {finalGoalHit ? (
            <div className="flex flex-col items-center gap-2">
              <div className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Trophy className="size-8" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 sm:text-3xl">
                {tW("goalHitTitle")}
              </p>
            </div>
          ) : (
            <p className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              {tW("todayPercentLabel", { percent: finalBlended.percent })}
            </p>
          )}

          {/* This-session recap */}
          <div className="grid w-full max-w-xs grid-cols-2 gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                km
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {state.totalDistanceKm.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                min
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {state.durationMin.toFixed(1)}
              </span>
            </div>
          </div>

          {state.path.length === 0 && (
            <div className="flex w-full max-w-xs items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{tW("noPathWarning")}</span>
            </div>
          )}

          {/* Notes — secondary, collapsed by default. Expanding it doesn't
              hold up the save: notes ride along on whichever CTA the user
              taps next (saveWalkOnce reads `notes` state at click time). */}
          <details
            open={notesOpen}
            onToggle={(e) =>
              setNotesOpen((e.currentTarget as HTMLDetailsElement).open)
            }
            className="w-full max-w-xs"
          >
            <summary className="flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-zinc-400 dark:hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  notesOpen && "rotate-180",
                )}
              />
              {tW("addNote")}
            </summary>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
              aria-label={tW("noteOptional")}
            />
          </details>

          {saveError && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}

          {/* Two secondary CTAs. Both trigger save (saveWalkOnce is
              idempotent). 回到遛狗 = stay on Mango, 查看排行榜 = celebrate
              the streak / family compare. */}
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button
              onClick={handleBackToWalking}
              size="lg"
              disabled={saving}
              className="w-full"
            >
              {saving && !saved ? "..." : tW("backToWalking")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleViewLeaderboard}
              size="lg"
              disabled={saving}
              className="w-full"
            >
              {tW("viewLeaderboard")}
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
