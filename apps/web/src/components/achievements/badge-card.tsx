"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check, Lock } from "lucide-react";
import { formatMetricValue, type BadgeState } from "@/lib/achievements";
import { cn } from "@/lib/utils";

/** One badge tile. Three visual states:
 *  - earned   → full-colour emoji on a warm gradient disc + brand ring +
 *               check + "解鎖於 {date}" pill, with a one-shot light sweep on
 *               mount (reduced-motion: no sweep).
 *  - unearned → greyscale dimmed emoji + (when the metric is client-
 *               computable) a progress bar with "47/50".
 *  - locked   → greyscale + lock; guest viewing a community/rank badge. The
 *               whole tile is a button that opens the upgrade dialog.
 *  Colours are mango tokens; text passes WCAG AA on the soft-card surface.
 *  Spec §E + UI/UX handoff.
 */
export function BadgeCard({
  state,
  onUpgrade,
}: {
  state: BadgeState;
  onUpgrade: () => void;
}) {
  const t = useTranslations("Achievements");
  const locale = useLocale();
  const { achievement, earned, earnedAt, locked, current, progress } = state;
  const title = t(`${achievement.id}.title`);
  const desc = t(`${achievement.id}.desc`);

  const showBar = !earned && !locked && progress != null && current != null;
  const pct = Math.round((progress ?? 0) * 100);

  const earnedDate =
    earnedAt != null
      ? new Date(earnedAt.toMillis()).toLocaleDateString(
          locale === "zh-TW" ? "zh-TW" : "en-US",
          { year: "numeric", month: "short", day: "numeric" },
        )
      : null;

  const inner = (
    <>
      <div className="relative">
        <span
          aria-hidden="true"
          className={cn(
            "relative grid size-14 place-items-center overflow-hidden rounded-2xl text-3xl",
            earned
              ? "badge-disc-earned"
              : "bg-mango-bg-alt opacity-45 grayscale",
          )}
        >
          {achievement.emoji}
          {earned && <span className="badge-sweep" aria-hidden="true" />}
        </span>
        {earned && (
          <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-mango-brand text-white ring-2 ring-mango-card-soft">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {locked && (
          <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-mango-ink text-white ring-2 ring-mango-card-soft">
            <Lock className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            earned ? "text-mango-ink" : "text-mango-ink-2",
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-mango-ink-2">{desc}</p>
      </div>

      {earned && earnedDate && (
        <span className="mt-auto rounded-full bg-mango-brand-tint px-2 py-0.5 text-[11px] font-semibold text-mango-brand-deep">
          {t("earnedOn", { date: earnedDate })}
        </span>
      )}

      {locked && (
        <span className="mt-auto text-[11px] font-semibold text-mango-brand-deep">
          {t("locked")}
        </span>
      )}

      {showBar && (
        <div
          className="mt-auto w-full"
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={achievement.threshold}
          aria-valuenow={current ?? 0}
        >
          <div className="h-2 w-full overflow-hidden rounded-full bg-mango-bg-alt">
            <div
              className="h-full rounded-full bg-mango-brand transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] font-medium tabular-nums text-mango-ink-2">
            {formatMetricValue(current ?? 0)} / {achievement.threshold}
          </p>
        </div>
      )}
    </>
  );

  const cardClass = cn(
    "flex h-full flex-col items-center gap-2 rounded-2xl border p-4 text-center",
    earned
      ? "border-mango-brand/50 bg-mango-card-soft shadow-[0_4px_16px_-10px_rgba(243,152,0,0.7)]"
      : "border-mango-hairline bg-mango-card-soft",
  );

  if (locked) {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        aria-label={`${title} — ${t("locked")}`}
        className={cn(
          cardClass,
          "transition-colors hover:border-mango-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
        )}
      >
        {inner}
      </button>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}
