"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { HeartPulse, Plus } from "lucide-react";
import type { HealthRecord, Pet } from "@/lib/types";
import { PetHealthRecordCard } from "./pet-health-record-card";
import { PetWeightTrendChart } from "./pet-weight-trend-chart";

/**
 * 健康 tab body — weight trend card (SVG chart + current weight + 6m
 * delta) followed by HealthRecord list sorted by recordedAt desc.
 * Ports prototype `HealthBody` (line 885–924).
 */
type Props = {
  pet: Pet;
  records: HealthRecord[];
  weights: { date: number; kg: number }[];
  onDelete: (r: HealthRecord) => void;
  onAdd: () => void;
};

export function PetHealthBody({
  pet,
  records,
  weights,
  onDelete,
  onAdd,
}: Props) {
  const tPP = useTranslations("PetsPage");

  const { current, delta, hasChart } = useMemo(() => {
    if (weights.length === 0) {
      return { current: pet.weightKg ?? null, delta: null, hasChart: false };
    }
    const sorted = [...weights].sort((a, b) => a.date - b.date);
    const last = sorted[sorted.length - 1].kg;
    const sixMonthsAgo = Date.now() - 6 * 30 * 86_400_000;
    const oldRef =
      sorted.find((p) => p.date >= sixMonthsAgo)?.kg ?? sorted[0].kg;
    const d = +(last - oldRef).toFixed(1);
    return {
      current: last,
      delta: Number.isFinite(d) ? d : null,
      hasChart: weights.length >= 2,
    };
  }, [weights, pet.weightKg]);

  const petRecords = records
    .filter((r) => r.petId === pet.petId)
    .sort((a, b) => b.recordedAt.toMillis() - a.recordedAt.toMillis());

  if (petRecords.length === 0 && !hasChart) {
    return <EmptyHealth onAdd={onAdd} />;
  }

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {/* Weight trend card */}
      <div className="rounded-[18px] border border-mango-hairline bg-mango-card px-3.5 pt-3.5 pb-2.5 shadow-card">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-mango-ink">
            {tPP("health.weightTrend")}
          </span>
          <span className="text-[11.5px] text-mango-ink-3">
            {tPP("health.weightTrendRange")}
          </span>
        </div>
        <div className="mt-2">
          {hasChart ? (
            <PetWeightTrendChart points={weights} />
          ) : (
            <p className="rounded-md bg-mango-bg-alt px-3 py-3 text-center text-[11.5px] text-mango-ink-3">
              {tPP("health.weightTrendInsufficient")}
            </p>
          )}
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-xl font-extrabold tracking-[-0.4px] text-mango-ink">
            {current != null ? (
              <>
                {current}
                <span className="text-xs font-semibold text-mango-ink-2">{" "}{tPP("kgUnit")}</span>
              </>
            ) : (
              <span className="text-mango-ink-3">—</span>
            )}
          </span>
          {delta != null && hasChart && (
            <span
              className={`text-[11.5px] font-bold ${
                delta >= 0 ? "text-mango-leaf" : "text-mango-cookie"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {delta} kg / 6m
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2.5">
        {petRecords.map((r) => (
          <PetHealthRecordCard
            key={r.recordId}
            record={r}
            onDelete={() => onDelete(r)}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyHealth({ onAdd }: { onAdd: () => void }) {
  const tPP = useTranslations("PetsPage");
  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-[18px] border border-mango-hairline bg-mango-card px-6 py-10 text-center shadow-card">
      <div className="grid size-14 place-items-center rounded-full bg-mango-leaf-tint text-mango-leaf">
        <HeartPulse className="size-6" strokeWidth={1.8} />
      </div>
      <p className="text-sm text-mango-ink-2">{tPP("health.empty")}</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-9 items-center gap-1 rounded-full bg-mango-leaf-tint px-3 text-sm font-bold text-mango-leaf transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        {tPP("health.addCta")}
      </button>
    </div>
  );
}
