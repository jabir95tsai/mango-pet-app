"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
  Cookie,
  Stethoscope,
  Scissors,
  Gamepad2,
  GraduationCap,
  Shield,
  Receipt,
  Sparkles,
  Pencil,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
};

const ICONS: Record<ExpenseCategory, LucideIcon> = {
  food: Cookie,
  medical: Stethoscope,
  grooming: Scissors,
  toy: Gamepad2,
  training: GraduationCap,
  insurance: Shield,
  other: Receipt,
};

const COLORS: Record<ExpenseCategory, string> = {
  food: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  medical: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  grooming: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  toy: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  training: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  insurance: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function ExpenseCard({ expense, onEdit, onDelete }: Props) {
  const tE = useTranslations("Expense");
  const tC = useTranslations("Common");
  const Icon = ICONS[expense.category];

  const date = new Date(expense.spentAt.toMillis());
  const dateStr = format(date, "MM/dd");

  return (
    <article className="flex items-center gap-3 rounded-lg border border-zinc-200/80 bg-white p-3 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      <div className={cn("shrink-0 size-10 rounded-full grid place-items-center", COLORS[expense.category])}>
        <Icon className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold truncate">
            {expense.vendor || tE(`categories.${expense.category}`)}
          </p>
          {expense.source === "ai_scan" && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Sparkles className="size-2.5" /> AI
            </span>
          )}
        </div>
        <div className="flex gap-2 text-xs text-zinc-500 mt-0.5">
          <span>{dateStr}</span>
          <span>·</span>
          <span>🐾 {expense.petName ?? "?"}</span>
          <span>·</span>
          <span>{tE(`categories.${expense.category}`)}</span>
          {expense.payerName && (
            <>
              <span>·</span>
              <span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {expense.payerName}
                </span>{" "}
                付的
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-base font-bold tabular-nums">
          <span className="text-xs text-zinc-500">NT$</span> {expense.amount.toLocaleString()}
        </p>
        <div className="flex gap-1 justify-end mt-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={tC("edit")}
            className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={tC("delete")}
            className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
