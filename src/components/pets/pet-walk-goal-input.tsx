"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { FieldLabel } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  WALK_GOAL_MAX_MINUTES,
  WALK_GOAL_MIN_MINUTES,
  WALK_GOAL_STEP_MINUTES,
} from "@/lib/walk-goals";

/**
 * Per-pet daily walk-goal stepper. Used inside PetFormDialog (and any
 * future per-pet inline edit). Pairs −/＋ buttons with a numeric input
 * clamped to [MIN, MAX] in WALK_GOAL_STEP_MINUTES increments.
 *
 * The "建議值（可覆蓋）" chip is wired but only renders when source ===
 * 'computed' — this round writes 'manual' only, so the chip stays
 * dark. Pre-laid for the future breed/age/weight computed-goal spec.
 *
 * No new dependency (matches per-pet-walk-goal spec guardrail);
 * stepper is hand-rolled with existing Tailwind primitives.
 */
type Props = {
  /** Minutes currently in the input. Caller owns state (so the form
   *  can include it in its save payload). */
  value: number;
  onChange: (next: number) => void;
  /** Pass `'computed'` when the value originated from the future
   *  recommendation heuristic — flips the "可覆蓋" chip on. Defaults
   *  to `'manual'` for the current ship. */
  source?: "manual" | "computed";
};

function clamp(n: number): number {
  if (!Number.isFinite(n)) return WALK_GOAL_MIN_MINUTES;
  return Math.min(
    WALK_GOAL_MAX_MINUTES,
    Math.max(WALK_GOAL_MIN_MINUTES, Math.round(n)),
  );
}

/** Snap an arbitrary number to the nearest STEP-aligned value. Keeps
 *  raw keyboard input (e.g., 32) from drifting between increments;
 *  the −/＋ buttons would otherwise jump back to a 5-aligned value
 *  next click. */
function snapToStep(n: number): number {
  return Math.round(n / WALK_GOAL_STEP_MINUTES) * WALK_GOAL_STEP_MINUTES;
}

export function PetWalkGoalInput({ value, onChange, source = "manual" }: Props) {
  const t = useTranslations("PetEdit.walkGoal");
  const safeValue = clamp(value);
  const atMin = safeValue <= WALK_GOAL_MIN_MINUTES;
  const atMax = safeValue >= WALK_GOAL_MAX_MINUTES;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <FieldLabel className="!m-0">{t("label")}</FieldLabel>
        {source === "computed" && (
          <span className="rounded-full bg-mango-leaf-tint px-2 py-0.5 text-[10px] font-semibold text-mango-leaf">
            {t("computedChip")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(safeValue - WALK_GOAL_STEP_MINUTES))}
          disabled={atMin}
          aria-label={`−${WALK_GOAL_STEP_MINUTES}`}
          className={cn(
            "grid size-10 place-items-center rounded-lg border border-mango-hairline bg-mango-card text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-40",
          )}
        >
          <Minus className="size-4" />
        </button>
        <div className="flex items-baseline gap-1 rounded-lg border border-mango-hairline bg-white px-3 py-2 dark:bg-zinc-900">
          <input
            type="number"
            inputMode="numeric"
            min={WALK_GOAL_MIN_MINUTES}
            max={WALK_GOAL_MAX_MINUTES}
            step={WALK_GOAL_STEP_MINUTES}
            value={safeValue}
            onChange={(e) => {
              const raw = Number(e.target.value);
              onChange(clamp(snapToStep(raw)));
            }}
            className="w-14 bg-transparent text-center text-lg font-bold tabular-nums text-mango-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={t("label")}
          />
          <span className="text-xs font-semibold text-mango-ink-2">
            {t("unit")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(clamp(safeValue + WALK_GOAL_STEP_MINUTES))}
          disabled={atMax}
          aria-label={`+${WALK_GOAL_STEP_MINUTES}`}
          className={cn(
            "grid size-10 place-items-center rounded-lg border border-mango-hairline bg-mango-card text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-40",
          )}
        >
          <Plus className="size-4" />
        </button>
      </div>

      <p className="text-[11px] text-mango-ink-3">{t("hint")}</p>
    </div>
  );
}
