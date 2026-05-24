"use client";

import { format, formatDistance } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Footprints, Hand, Trash2 } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { Walk } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  walk: Walk;
  onDelete: () => void;
};

// Phase 1 (visual-redesign-mango v2) — palette swap only. Markup and
// information hierarchy unchanged.
//   - article surface: white card on cream body, warm hairline border
//   - non-manual avatar: warm brand-tint / brand-deep (was amber-100/700)
//   - manual avatar:    warm bgAlt / ink-2     (was zinc-100/500)
//   - score:            brand-deep             (was amber-600)
//   - text ladder:      ink / ink-2            (was zinc-900/500)
//   - delete hover:     stays red (semantic — destructive)

export function WalkCard({ walk, onDelete }: Props) {
  const locale = useLocale();
  const tC = useTranslations("Common");
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const ts = walk.startedAt as Timestamp | undefined;
  const start = ts ? new Date(ts.toMillis()) : new Date();
  const dateStr = format(start, "yyyy-MM-dd HH:mm", { locale: dateLocale });
  const rel = formatDistance(start, new Date(), {
    addSuffix: true,
    locale: dateLocale,
  });

  return (
    <article className="flex gap-3 rounded-lg border border-mango-hairline bg-mango-card p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      <div
        className={cn(
          "shrink-0 size-10 rounded-full grid place-items-center",
          walk.isManual
            ? "bg-mango-bg-alt text-mango-ink-2 dark:bg-zinc-800 dark:text-zinc-400"
            : "bg-mango-brand-tint text-mango-brand-deep dark:bg-amber-500/15 dark:text-amber-300",
        )}
      >
        {walk.isManual ? (
          <Hand className="size-5" />
        ) : (
          <Footprints className="size-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-mango-ink dark:text-zinc-100">
            {walk.petName ?? "🐾"}
          </p>
          <span className="text-xs text-mango-ink-2 dark:text-zinc-400">
            {rel}
          </span>
        </div>
        <p className="text-xs text-mango-ink-2 mt-0.5 dark:text-zinc-400">
          {dateStr}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-mango-ink dark:text-zinc-200">
          <span>📏 {walk.distanceKm.toFixed(2)} km</span>
          <span>⏱️ {walk.durationMin.toFixed(0)} min</span>
          <span className="font-semibold text-mango-brand-deep dark:text-amber-300">
            ⭐ {walk.score.toFixed(1)}
          </span>
        </div>
        {walk.walkerName && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-mango-ink-2 dark:text-zinc-400">
            <Avatar
              src={walk.walkerPhotoURL}
              name={walk.walkerName}
              size={18}
            />
            <span>
              <span className="font-medium text-mango-ink dark:text-zinc-300">
                {walk.walkerName}
              </span>{" "}
              走的
            </span>
          </div>
        )}
        {walk.notes && (
          <p className="text-xs text-mango-ink-2 mt-1 line-clamp-1 dark:text-zinc-400">
            {walk.notes}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        aria-label={tC("delete")}
        className="self-start rounded-lg p-2 text-mango-ink-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}
