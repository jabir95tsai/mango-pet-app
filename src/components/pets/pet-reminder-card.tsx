"use client";

import { format, formatDistanceToNow, isPast } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  Check,
  Clock,
  Pencil,
  Repeat,
  Scissors,
  Stethoscope,
  Syringe,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { Reminder, ReminderRepeat } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pets-v2 reminder card — same data as the existing ReminderCard but
 * styled to match the mango design family (warm card + 42px tinted icon
 * disc + repeat/due chip cluster + circular check button on the
 * right). Ports prototype `ReminderCard` (line 440–478).
 *
 * Icon tint is keyword-derived: titles containing 疫苗/Vaccine get the
 * leaf tone, 美容/洗澡 get peach, 心絲蟲/驅蟲 get brand, etc. Falls back
 * to bell + brand-tint.
 */
type Props = {
  reminder: Reminder;
  petName?: string;
  onComplete: () => void;
  onEdit?: () => void;
  onDelete: () => void;
};

type Tone = {
  bg: string;
  text: string;
  icon: LucideIcon;
};

const FALLBACK: Tone = {
  bg: "bg-mango-brand-tint",
  text: "text-mango-brand-deep",
  icon: Bell,
};

function toneForTitle(title: string): Tone {
  const t = title.toLowerCase();
  if (/疫苗|vaccine/.test(t)) {
    return { bg: "bg-mango-leaf-tint", text: "text-mango-leaf", icon: Syringe };
  }
  if (/驅蟲|心絲蟲|deworm|heartworm/.test(t)) {
    return { bg: "bg-mango-brand-tint", text: "text-mango-brand-deep", icon: Stethoscope };
  }
  if (/洗澡|美容|bath|groom/.test(t)) {
    return { bg: "bg-mango-peach-tint", text: "text-mango-cookie", icon: Scissors };
  }
  return FALLBACK;
}

const REPEAT_LABEL: Record<ReminderRepeat, string> = {
  none: "",
  daily: "每天",
  weekly: "每週",
  monthly: "每月",
  yearly: "每年",
};

export function PetReminderCard({
  reminder,
  petName,
  onComplete,
  onEdit,
  onDelete,
}: Props) {
  const tC = useTranslations("Common");
  const tR = useTranslations("Reminder");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  const tone = toneForTitle(reminder.title);
  const Icon = tone.icon;

  const ts = reminder.triggerAt as Timestamp;
  const triggerDate = new Date(ts.toMillis());
  const overdue = !reminder.done && isPast(triggerDate);
  const rel = formatDistanceToNow(triggerDate, {
    addSuffix: true,
    locale: dateLocale,
  });
  const exact = format(triggerDate, "yyyy-MM-dd HH:mm");

  return (
    <article className="flex items-center gap-3 rounded-[18px] border border-mango-hairline bg-mango-card px-3.5 py-3.5 shadow-card">
      <div
        className={cn(
          "grid size-[42px] shrink-0 place-items-center rounded-[14px]",
          tone.bg,
          tone.text,
        )}
        aria-hidden="true"
      >
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14.5px] font-bold tracking-[-0.1px] text-mango-ink">
            {reminder.title}
          </span>
          {petName && (
            <span className="shrink-0 text-[11px] text-mango-ink-3">
              · {petName}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {reminder.repeat !== "none" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-mango-bg-alt px-1.5 py-0.5 text-[11px] font-semibold text-mango-ink-2">
              <Repeat className="size-[11px]" />
              {REPEAT_LABEL[reminder.repeat]}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11.5px] font-semibold",
              overdue ? "text-red-600" : "text-mango-ink-2",
            )}
            title={exact}
          >
            <Clock className="size-[11px]" />
            {rel}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onComplete}
          aria-label={tR("markDone")}
          title={tR("markDone")}
          className={cn(
            "grid size-9 place-items-center rounded-xl border-[1.5px] border-mango-hairline bg-mango-card text-mango-ink-3 transition-colors hover:border-mango-leaf hover:bg-mango-leaf hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
            reminder.done && "border-none bg-mango-leaf text-white",
          )}
        >
          <Check className="size-[18px]" strokeWidth={2.6} />
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={tC("edit")}
            className="grid size-8 place-items-center rounded-lg text-mango-ink-3 transition-colors hover:bg-mango-bg-alt hover:text-mango-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
          >
            <Pencil className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={tC("delete")}
          className="grid size-8 place-items-center rounded-lg text-mango-ink-3 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:hover:bg-red-950"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  );
}
