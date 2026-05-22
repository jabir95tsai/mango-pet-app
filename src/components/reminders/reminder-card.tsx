"use client";

import { format, formatDistanceToNow, isPast } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Check, Trash2, Repeat, Pencil } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { FamilyMember, Pet, Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  reminder: Reminder;
  pet?: Pet;
  /** Family members keyed by uid — used to resolve `doneByUid` to a
   *  displayName without fetching a user doc per card. Optional: when
   *  omitted (e.g. on the active reminder lists where attribution
   *  doesn't render), the card silently falls back to the no-attribution
   *  variant. */
  members?: Map<string, FamilyMember>;
  onComplete: () => void;
  onDelete: () => void;
  onEdit?: () => void;
};

export function ReminderCard({
  reminder,
  pet,
  members,
  onComplete,
  onDelete,
  onEdit,
}: Props) {
  const tR = useTranslations("Reminder");
  const tC = useTranslations("Common");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  const ts = reminder.triggerAt as Timestamp;
  const triggerDate = new Date(ts.toMillis());
  const isOverdue = isPast(triggerDate);

  const rel = formatDistanceToNow(triggerDate, {
    addSuffix: true,
    locale: dateLocale,
  });
  const abs = format(triggerDate, "yyyy-MM-dd HH:mm");

  // ── Done-state branch ────────────────────────────────────────────
  // Renders a muted card with attribution ("by 媽媽 · 2 小時前") instead
  // of the active complete/edit/delete cluster. Active-list pages won't
  // hit this because they filter `done === false` server-side; the
  // "今日已完成" section is the entry point.
  if (reminder.done) {
    const doneTs = reminder.doneAt as Timestamp | undefined;
    const doneRel =
      doneTs &&
      formatDistanceToNow(new Date(doneTs.toMillis()), {
        addSuffix: true,
        locale: dateLocale,
      });

    // Resolve displayName via the in-memory member map so we never fetch
    // a user doc per card. Three fallbacks the spec calls out:
    //   1. doneByUid present + member found  → real name
    //   2. doneByUid present + member missing (left family) → former-member label
    //   3. doneByUid missing (legacy data)   → no "by" suffix at all
    const doneByMember = reminder.doneByUid
      ? members?.get(reminder.doneByUid)
      : undefined;
    const doneByName = reminder.doneByUid
      ? (doneByMember?.displayName ?? tR("formerMember"))
      : null;

    return (
      <article className="flex gap-3 rounded-lg border border-zinc-200/60 bg-zinc-50/60 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/40">
        <div className="shrink-0 size-10 rounded-full grid place-items-center bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <Check className="size-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate text-zinc-700 dark:text-zinc-300">
              {reminder.title}
            </p>
            {pet && (
              <span className="text-xs text-zinc-500">🐾 {pet.name}</span>
            )}
          </div>
          <p className="text-xs mt-0.5 text-emerald-700 dark:text-emerald-400">
            {doneByName && doneRel
              ? tR("doneByLabel", { name: doneByName, time: doneRel })
              : doneRel
                ? tR("doneTimeLabel", { time: doneRel })
                : tR("doneLabel")}
          </p>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            aria-label={tC("delete")}
            title={tC("delete")}
            className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </article>
    );
  }

  // ── Active-state branch (unchanged) ──────────────────────────────
  return (
    <article
      className={cn(
        "flex gap-3 rounded-lg border bg-white p-4 shadow-sm shadow-zinc-200/40 dark:bg-zinc-950 dark:shadow-none",
        isOverdue
          ? "border-red-200 dark:border-red-900/40"
          : "border-zinc-200/80 dark:border-zinc-800",
      )}
    >
      <div
        className={cn(
          "shrink-0 size-10 rounded-full grid place-items-center",
          isOverdue
            ? "bg-red-100 text-red-600 dark:bg-red-950"
            : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
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
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <Repeat className="size-3" />
              {tR(`repeat.${reminder.repeat}`)}
            </span>
          )}
        </div>
        <p className={cn("text-xs mt-0.5", isOverdue ? "text-red-600" : "text-zinc-500")}>
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
          title={tR("markDone")}
          className="rounded-lg bg-emerald-100 p-2 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
        >
          <Check className="size-4" />
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={tC("edit")}
            title={tC("edit")}
            className="rounded-lg p-2 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
          >
            <Pencil className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={tC("delete")}
          title={tC("delete")}
          className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  );
}
