"use client";

import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { formatMetricValue, type BadgeState } from "@/lib/achievements";
import { cn } from "@/lib/utils";

/** One badge tile. Three visual states:
 *  - earned   → full-colour emoji + brand tint + "解鎖於 {date}".
 *  - unearned → greyscale emoji + (when the metric is client-computable) a
 *               progress bar with "47/50".
 *  - locked   → greyscale + lock; guest viewing a community/rank badge. The
 *               whole tile is a button that opens the upgrade dialog.
 *  Visual polish (final palette / motion) is UI/UX's to refine; this is the
 *  functional structure. Spec §E.
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

  const dimmed = !earned;
  const showBar = !earned && !locked && progress != null && current != null;

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
            "grid size-14 place-items-center rounded-2xl text-3xl transition",
            earned
              ? "bg-mango-brand-tint"
              : "bg-mango-bg-alt grayscale opacity-50",
          )}
        >
          {achievement.emoji}
        </span>
        {locked && (
          <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-mango-ink text-white">
            <Lock className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            dimmed ? "text-mango-ink-2" : "text-mango-ink",
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-mango-ink-3">{desc}</p>
      </div>

      {earned && earnedDate && (
        <p className="text-[11px] font-medium text-mango-brand-deep">
          {t("earnedOn", { date: earnedDate })}
        </p>
      )}

      {locked && (
        <span className="text-[11px] font-semibold text-mango-brand-deep">
          {t("locked")}
        </span>
      )}

      {showBar && (
        <div className="w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-mango-bg-alt">
            <div
              className="h-full rounded-full bg-mango-brand"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-mango-ink-3">
            {formatMetricValue(current ?? 0)} / {achievement.threshold}
          </p>
        </div>
      )}
    </>
  );

  const cardClass = cn(
    "flex h-full flex-col items-center gap-2 rounded-2xl border p-4 text-center",
    earned
      ? "border-mango-brand/40 bg-mango-card-soft"
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

  return (
    <div className={cardClass} aria-label={earned ? `${title} ✓` : title}>
      {inner}
    </div>
  );
}
