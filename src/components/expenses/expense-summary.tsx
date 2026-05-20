"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryTotal, MonthlyTotal } from "@/lib/firebase/expenses";
import type { ExpenseCategory } from "@/lib/types";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: "#f97316",
  medical: "#f43f5e",
  grooming: "#3b82f6",
  toy: "#a855f7",
  training: "#10b981",
  insurance: "#6366f1",
  other: "#71717a",
};

type Props = {
  total: number;
  byCategory: CategoryTotal[];
  byMonth: MonthlyTotal[];
};

export function ExpenseSummary({ total, byCategory, byMonth }: Props) {
  const tE = useTranslations("Expense");
  const recentMonths = byMonth.slice(-6);

  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200/60 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col gap-4 mb-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          {tE("totalSpent")}
        </span>
        <span className="text-2xl font-bold tabular-nums">
          <span className="text-sm font-normal text-zinc-500">NT$</span>{" "}
          {total.toLocaleString()}
        </span>
      </div>

      {recentMonths.length > 1 && (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recentMonths} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#a1a1aa" />
              <YAxis tick={{ fontSize: 10 }} stroke="#a1a1aa" />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "#fbbf24", fontSize: 12 }}
                formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, "支出"]}
              />
              <Bar dataKey="total" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byCategory.length > 0 && (
        <div className="grid grid-cols-[1fr,auto] gap-3 items-center">
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={28}
                  outerRadius={50}
                  paddingAngle={2}
                >
                  {byCategory.map((c) => (
                    <Cell key={c.category} fill={CATEGORY_COLORS[c.category]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: "#fbbf24", fontSize: 12 }}
                  formatter={(v, name) => [
                    `NT$ ${Number(v).toLocaleString()}`,
                    tE(`categories.${name}`),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex flex-col gap-1 text-xs">
            {byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: CATEGORY_COLORS[c.category] }}
                />
                <span className="font-medium">{tE(`categories.${c.category}`)}</span>
                <span className="tabular-nums text-zinc-500 ml-auto">
                  {c.total.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
