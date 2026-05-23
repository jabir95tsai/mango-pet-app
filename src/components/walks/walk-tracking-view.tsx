"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertTriangle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/select";
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
  const tC = useTranslations("Common");
  const sessionRef = useRef<WalkSession | null>(null);
  const [state, setState] = useState<WalkSessionState | null>(null);
  const [phase, setPhase] = useState<"tracking" | "done">("tracking");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setSaveError(null);
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

  async function handleSave() {
    if (!sessionRef.current || !state || !state.startedAt || !pet) return;
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
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
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
        <div className="mx-auto flex w-full flex-1 flex-col gap-5 px-6 py-8 sm:max-w-md">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">km</span>
              <span className="text-2xl font-bold tabular-nums">
                {state.totalDistanceKm.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">min</span>
              <span className="text-2xl font-bold tabular-nums">
                {state.durationMin.toFixed(1)}
              </span>
            </div>
          </div>

          {state.path.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{tW("errDenied")}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <FieldLabel>{tW("noteOptional")}</FieldLabel>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {tC("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || state.path.length === 0}
            >
              {saving ? "..." : tC("save")}
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
