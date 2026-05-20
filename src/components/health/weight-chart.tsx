"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";

type Props = {
  data: { date: number; kg: number }[];
};

export function WeightChart({ data }: Props) {
  const tH = useTranslations("Health");

  // Hide entirely when there's nothing yet — the page already shows a generic
  // "no records" empty state below.
  if (data.length === 0) return null;

  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300/60 bg-amber-50/40 dark:border-zinc-700 dark:bg-zinc-900/40 p-4 text-center text-xs text-zinc-500">
        {tH("needTwoForChart")}
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: format(new Date(d.date), "MM/dd"),
  }));

  return (
    <div className="rounded-2xl border border-amber-200/60 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold mb-3">{tH("weightChart")}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
            <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: "#fbbf24", fontSize: 12 }}
              labelFormatter={(label) => label}
              formatter={(value) => [`${value} kg`, tH("types.weight")]}
            />
            <Line
              type="monotone"
              dataKey="kg"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#f59e0b" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
