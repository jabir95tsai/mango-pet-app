"use client";

import { Loader2, Minus, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { FieldLabel } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WalkGoalRecommendation } from "@/lib/types";
import {
  WALK_GOAL_MAX_MINUTES,
  WALK_GOAL_MIN_MINUTES,
  WALK_GOAL_STEP_MINUTES,
} from "@/lib/walk-goals";

/**
 * Per-pet daily walk-goal stepper. Used inside PetFormDialog (and any
 * future per-pet inline edit). Pairs −/＋ buttons with a numeric input
 * clamped to [MIN, MAX] in WALK_GOAL_STEP_MINUTES increments, and
 * optionally triggers a Gemini AI walk-goal recommendation.
 *
 * No new UI dependency (matches per-pet-walk-goal spec guardrail);
 * stepper is hand-rolled with existing Tailwind primitives and mango tokens.
 */
type Props = {
  /** Minutes currently in the input. Caller owns state (so the form
   *  can include it in its save payload). */
  value: number;
  onChange: (next: number) => void;
  /** Pass `'computed'` when the value originated from the AI
   *  recommendation — flips the "建議值（可覆蓋）" chip on. */
  source?: "manual" | "computed";
  onRequestRecommend?: () => void;
  recommending?: boolean;
  recommendation?: WalkGoalRecommendation | null;
  recommendError?: string | null;
  onApplyRecommendation?: (minutes: number) => void;
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

export function PetWalkGoalInput({
  value,
  onChange,
  source = "manual",
  onRequestRecommend,
  recommending = false,
  recommendation = null,
  recommendError = null,
  onApplyRecommendation,
}: Props) {
  const t = useTranslations("PetEdit.walkGoal");
  const safeValue = clamp(value);
  const atMin = safeValue <= WALK_GOAL_MIN_MINUTES;
  const atMax = safeValue >= WALK_GOAL_MAX_MINUTES;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FieldLabel className="!m-0">{t("label")}</FieldLabel>
          {source === "computed" && (
            <span className="rounded-[var(--radius-pill)] bg-mango-leaf-tint px-2 py-0.5 text-[10px] font-semibold text-mango-leaf">
              {t("computedChip")}
            </span>
          )}
        </div>

        {onRequestRecommend && (
          <button
            type="button"
            onClick={onRequestRecommend}
            disabled={recommending}
            aria-busy={recommending}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-mango-hairline bg-mango-brand-tint px-3 py-1 text-xs font-semibold text-mango-brand-deep transition-colors hover:bg-mango-amber/40 active:scale-[.97] disabled:cursor-wait disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
          >
            {recommending ? (
              <>
                <Loader2 className="size-3.5 motion-safe:animate-spin" />
                <span>{t("aiSuggesting")}</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>{t("aiSuggest")}</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(safeValue - WALK_GOAL_STEP_MINUTES))}
          disabled={atMin}
          aria-label={`−${WALK_GOAL_STEP_MINUTES}`}
          className={cn(
            "grid size-10 place-items-center rounded-[var(--radius-sm)] border border-mango-hairline bg-mango-card text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-40",
          )}
        >
          <Minus className="size-4" />
        </button>
        <div className="flex items-baseline gap-1 rounded-[var(--radius-sm)] border border-mango-hairline bg-mango-card px-3 py-2">
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
            "grid size-10 place-items-center rounded-[var(--radius-sm)] border border-mango-hairline bg-mango-card text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-40",
          )}
        >
          <Plus className="size-4" />
        </button>
      </div>

      {recommendError && (
        <p role="alert" className="text-xs text-red-600">
          {recommendError}
        </p>
      )}

      {recommendation && (
        <div
          aria-live="polite"
          className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-mango-hairline bg-mango-card-soft px-3.5 py-2.5 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold tabular-nums text-mango-ink">
              {t("aiResultTitle", {
                minutes: recommendation.minutes,
                sessions: recommendation.sessionsPerDay,
              })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-mango-brand-tint px-2 py-0.5 text-[10px] font-semibold text-mango-brand-deep">
              <Sparkles className="size-2.5" />
              {t("aiBadge")}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-mango-ink-2">
            {recommendation.rationale}
          </p>

          {recommendation.tips.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] leading-relaxed text-mango-ink-2">
              {recommendation.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          )}

          {safeValue !== recommendation.minutes && onApplyRecommendation && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => onApplyRecommendation(recommendation.minutes)}
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-mango-hairline bg-mango-card px-2.5 py-1 text-[11px] font-semibold text-mango-brand-deep transition-colors hover:bg-mango-brand-tint/60 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                {t("aiApplyAgain", { minutes: recommendation.minutes })}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-mango-ink-3">{t("hint")}</p>
    </div>
  );
}
