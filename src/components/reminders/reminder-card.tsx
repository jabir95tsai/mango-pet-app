"use client";

import { format, formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Check, Trash2, Repeat } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { Pet, Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  reminder: Reminder;
  pet?: Pet;
  onComplete: () => void;
  onDelete: () => void;
};

export function ReminderCard({ reminder, pet, onComplete, onDelete }: Props) {
  const tR = useTranslations("Reminder");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  const ts = reminder.triggerAt as Timestamp;
  const triggerDate = ts ? new Date(ts.toMillis()) : new Date();
  const isPast = triggerDate.getTime() < Date.now();

  const rel = formatDistanceToNow(triggerDate, {
    addSuffix: true,
    locale: dateLocale,
  });
  const abs = format(triggerDate, "yyyy-MM-dd HH:mm");

  return (
    <article
      className={cn(
        "flex gap-3 rounded-2xl border p-4 bg-white dark:bg-zinc-950",
        isPast
          ? "border-red-200 dark:border-red-900/40"
          : "border-amber-200/60 dark:border-zinc-800",
      )}
    >
      <div
        className={cn(
          "shrink-0 size-10 rounded-full grid place-items-center",
          isPast
            ? "bg-red-100 text-red-600 dark:bg-red-950"
            : "bg-amber-100 text-amber-600 dark:bg-amber-500/20",
        )}
      >
        <Bell className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{reminder.title}</p>
          {pet && (
            <span className="text-xs text-zinc-500">🐾 {pet.name}</span>
          )}
          {reminder.repeat !== "none" && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
              <Repeat className="size-3" />
              {tR(`repeat.${reminder.repeat}`)}
            </span>
          )}
        </div>
        <p className={cn("text-xs mt-0.5", isPast ? "text-red-600" : "text-zinc-500")}>
          {rel} · {abs}
        </p>
        {reminder.description && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
            {reminder.description}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={onComplete}
          aria-label={tR("markDone")}
          className="p-2 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="delete"
          className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  );
}
