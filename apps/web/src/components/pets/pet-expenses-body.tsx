"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Wallet } from "lucide-react";
import type { Expense, ExpenseCategory, Pet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PetExpenseCard } from "./pet-expense-card";
import { PetExpenseDonut } from "./pet-expense-donut";

type CategoryFilter = ExpenseCategory | "all";

const FILTERS: CategoryFilter[] = [
  "all",
  "food",
  "medical",
  "grooming",
  "toy",
  "training",
  "insurance",
  "other",
];

/**
 * 開銷 tab body — month-total bar (NT$ X + +12% chip vs last month) +
 * donut chart + category legend + ExpenseCard list. Ports prototype
 * `ExpensesBody` (line 800–883).
 *
 * Bar comparison: percent change vs last month. Tone flips between
 * cookie (up) and leaf (down) so the user reads the trend at a glance.
 */
type Props = {
  pet: Pet;
  expenses: Expense[];
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  onAdd: () => void;
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: "#d77b3f", // cookie
  medical: "#3f8a3a", // leaf-deep
  grooming: "#f39800", // brand
  toy: "#ee9a5a",
  training: "#5fa858", // leaf
  insurance: "#9a8a74", // ink-3
  other: "#5a4a38", // ink-2
};

function startOfMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfLastMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
}

export function PetExpensesBody({
  pet,
  expenses,
  onEdit,
  onDelete,
  onAdd,
}: Props) {
  const tPP = useTranslations("PetsPage");
  const tE = useTranslations("Expense");
  const tF = useTranslations("Filter");
  // Category filter pills — narrow the list view only. Total bar +
  // donut still show the full month's data so the user sees the
  // big picture independent of the filter.
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const data = useMemo(() => {
    const monthStart = startOfMonth();
    const lastStart = startOfLastMonth();
    const pets = expenses.filter((e) => e.petId === pet.petId);
    const thisMonth = pets.filter((e) => e.spentAt.toMillis() >= monthStart);
    const lastMonth = pets.filter((e) => {
      const ms = e.spentAt.toMillis();
      return ms >= lastStart && ms < monthStart;
    });
    const total = thisMonth.reduce((s, e) => s + e.amount, 0);
    const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
    const pctChange =
      lastTotal === 0
        ? null
        : Math.round(((total - lastTotal) / lastTotal) * 100);

    // Roll up by category, descending, drop empties.
    const byCategory = new Map<ExpenseCategory, number>();
    for (const e of thisMonth) {
      byCategory.set(
        e.category,
        (byCategory.get(e.category) ?? 0) + e.amount,
      );
    }
    const slices = Array.from(byCategory.entries())
      .map(([cat, value]) => ({
        id: cat,
        label: tE(`categories.${cat}`),
        value,
        color: CATEGORY_COLORS[cat],
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      total,
      pctChange,
      slices,
      thisMonth: thisMonth.sort(
        (a, b) => b.spentAt.toMillis() - a.spentAt.toMillis(),
      ),
    };
  }, [expenses, pet.petId, tE]);

  if (data.thisMonth.length === 0) {
    return <EmptyExpenses onAdd={onAdd} />;
  }

  const monthLabel = new Date().getMonth() + 1;
  const pctSign =
    data.pctChange == null ? "" : data.pctChange >= 0 ? "+" : "";
  const pctTone =
    data.pctChange != null && data.pctChange < 0
      ? "bg-mango-leaf-tint text-mango-leaf"
      : "bg-mango-cookie-tint text-mango-cookie";

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {/* Month total bar */}
      <div className="flex items-center justify-between rounded-[18px] border border-mango-hairline bg-mango-card px-4 py-3.5 shadow-card">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-mango-ink-3">
            {tPP("expenses.monthTitle", { month: monthLabel })}
          </div>
          <div className="mt-0.5 text-2xl font-extrabold tracking-[-0.5px] text-mango-ink">
            <span className="mr-1 text-xs font-semibold text-mango-ink-3">
              NT$
            </span>
            <span className="tabular-nums">{data.total.toLocaleString()}</span>
          </div>
        </div>
        {data.pctChange != null && (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${pctTone}`}
          >
            {tPP("expenses.monthCompare", {
              sign: pctSign,
              pct: data.pctChange,
            })}
          </div>
        )}
      </div>

      {/* Donut + legend */}
      {data.slices.length > 0 && (
        <div className="flex items-center gap-3.5 rounded-[18px] border border-mango-hairline bg-mango-card p-3.5 shadow-card">
          <div className="shrink-0">
            <PetExpenseDonut
              slices={data.slices}
              total={data.total}
              size={128}
              monthTotalLabel={tPP("expenses.donutLabel")}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex items-baseline justify-between text-[12.5px] font-bold text-mango-ink">
              <span>{tPP("expenses.byCategory")}</span>
              <span className="text-[11px] font-semibold text-mango-ink-3">
                {tPP("expenses.itemCount", { count: data.slices.length })}
              </span>
            </div>
            {data.slices.map((c) => {
              const pct = Math.round((c.value / data.total) * 100);
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: c.color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-[12.5px] font-semibold text-mango-ink-2">
                    {c.label}
                  </span>
                  <span className="min-w-[28px] text-right text-[13px] font-extrabold tracking-[-0.2px] text-mango-ink tabular-nums">
                    {pct}%
                  </span>
                  <span className="min-w-[52px] text-right text-[11px] font-semibold text-mango-ink-3 tabular-nums">
                    ${c.value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category filter pills — port from /app/expenses page. Active
          pill picks the brand-tint highlight to match the rest of
          pets v2's pill family (PetTabs / filter chips). */}
      <div className="mt-1 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f;
          const label =
            f === "all" ? tF("all") : tE(`categories.${f}`);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
                active
                  ? "bg-mango-brand text-white shadow-sm"
                  : "bg-mango-card text-mango-ink-2 ring-1 ring-mango-hairline hover:bg-mango-bg-alt",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-2.5">
        {data.thisMonth
          .filter((e) => filter === "all" || e.category === filter)
          .map((e) => (
            <PetExpenseCard
              key={e.expenseId}
              expense={e}
              onEdit={() => onEdit(e)}
              onDelete={() => onDelete(e)}
            />
          ))}
        {/* When the filter narrows everything out, show a quiet hint
            rather than collapsing to empty (the total bar + donut
            above still show non-zero numbers, so the user shouldn't
            be left wondering where their data went). */}
        {filter !== "all" &&
          data.thisMonth.every((e) => e.category !== filter) && (
            <p className="text-center text-xs text-mango-ink-3">
              {tPP("expenses.filterEmpty")}
            </p>
          )}
      </div>
    </div>
  );
}

function EmptyExpenses({ onAdd }: { onAdd: () => void }) {
  const tPP = useTranslations("PetsPage");
  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-[18px] border border-mango-hairline bg-mango-card px-6 py-10 text-center shadow-card">
      <div className="grid size-14 place-items-center rounded-full bg-mango-cookie-tint text-mango-cookie">
        <Wallet className="size-6" strokeWidth={1.8} />
      </div>
      <p className="text-sm text-mango-ink-2">{tPP("expenses.empty")}</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-9 items-center gap-1 rounded-full bg-mango-cookie-tint px-3 text-sm font-bold text-mango-cookie transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        {tPP("expenses.addCta")}
      </button>
    </div>
  );
}
