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

export function WalkCard({ walk, onDelete }: Props) {
  const locale = useLocale();
  const tC = useTranslations("Common");
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const ts = walk.startedAt as Timestamp | undefined;
  const start = ts ? new Date(ts.toMillis()) : new Date();
  const dateStr = format(start, "yyyy-MM-dd HH:mm", { locale: dateLocale });
  const rel = formatDistance(start, new Date(), { addSuffix: true, locale: dateLocale });

  return (
    <article className="flex gap-3 rounded-lg border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      <div
        className={cn(
          "shrink-0 size-10 rounded-full grid place-items-center",
          walk.isManual
            ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
        )}
      >
        {walk.isManual ? <Hand className="size-5" /> : <Footprints className="size-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{walk.petName ?? "🐾"}</p>
          <span className="text-xs text-zinc-500">{rel}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{dateStr}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <span>📏 {walk.distanceKm.toFixed(2)} km</span>
          <span>⏱️ {walk.durationMin.toFixed(0)} min</span>
          <span className="font-semibold text-amber-600">⭐ {walk.score.toFixed(1)}</span>
        </div>
        {walk.walkerName && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <Avatar
              src={walk.walkerPhotoURL}
              name={walk.walkerName}
              size={18}
            />
            <span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {walk.walkerName}
              </span>{" "}
              走的
            </span>
          </div>
        )}
        {walk.notes && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{walk.notes}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        aria-label={tC("delete")}
        className="self-start rounded-lg p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}
