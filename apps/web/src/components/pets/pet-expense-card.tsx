"use client";

import { format } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import {
  Cookie,
  Gamepad2,
  GraduationCap,
  Pencil,
  Receipt,
  Scissors,
  Shield,
  Sparkles,
  Stethoscope,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pets-v2 expense card — same data as the existing ExpenseCard but
 * styled to match the mango design family. 42px tinted icon + title +
 * AI chip + date · payer + big NT$ amount on the right. Ports
 * prototype `ExpenseCard` (line 481–522).
 */
type Props = {
  expense: Expense;
  onEdit?: () => void;
  onDelete?: () => void;
};

type ToneSpec = { bg: string; text: string; icon: LucideIcon };

const TONE: Record<ExpenseCategory, ToneSpec> = {
  food: { bg: "bg-mango-cookie-tint", text: "text-mango-cookie", icon: Cookie },
  medical: { bg: "bg-mango-leaf-tint", text: "text-mango-leaf", icon: Stethoscope },
  grooming: { bg: "bg-mango-peach-tint", text: "text-mango-cookie", icon: Scissors },
  toy: { bg: "bg-mango-brand-tint", text: "text-mango-brand-deep", icon: Gamepad2 },
  training: { bg: "bg-mango-leaf-tint", text: "text-mango-leaf", icon: GraduationCap },
  insurance: { bg: "bg-mango-bg-alt", text: "text-mango-ink-2", icon: Shield },
  other: { bg: "bg-mango-bg-alt", text: "text-mango-ink-2", icon: Receipt },
};

export function PetExpenseCard({ expense, onEdit, onDelete }: Props) {
  const tC = useTranslations("Common");
  const tE = useTranslations("Expense");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  const tone = TONE[expense.category];
  const Icon = tone.icon;
  const dateStr = format(new Date(expense.spentAt.toMillis()), "MM/dd", {
    locale: dateLocale,
  });

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
            {expense.vendor || tE(`categories.${expense.category}`)}
          </span>
          {expense.source === "ai_scan" && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-mango-brand-tint px-1.5 py-0.5 text-[10px] font-bold tracking-[0.3px] text-mango-brand-deep">
              <Sparkles className="size-[9px]" /> AI
            </span>
          )}
        </div>
        <div className="mt-1 text-[11.5px] text-mango-ink-3">
          {dateStr}
          {expense.payerName ? ` · ${expense.payerName} 付` : ""}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="text-right whitespace-nowrap font-extrabold tracking-[-0.3px] text-mango-ink">
          <span className="mr-0.5 text-[11px] font-semibold text-mango-ink-3">
            NT$
          </span>
          <span className="text-base tabular-nums">
            {expense.amount.toLocaleString()}
          </span>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 flex-col">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={tC("edit")}
                className="grid size-7 place-items-center rounded-lg text-mango-ink-3 transition-colors hover:bg-mango-bg-alt hover:text-mango-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={tC("delete")}
                className="grid size-7 place-items-center rounded-lg text-mango-ink-3 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:hover:bg-red-950"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
