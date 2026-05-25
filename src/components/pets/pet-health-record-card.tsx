"use client";

import { format } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import {
  Pill,
  Scale,
  Stethoscope,
  Syringe,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  FeedingData,
  HealthRecord,
  HealthRecordType,
  MedicationData,
  VaccineData,
  VetData,
  WeightData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pets-v2 health record card — type pill + title row, then dashed
 * border separating big detail (e.g. "12.5 公斤") + right-aligned note.
 * Ports prototype `HealthRecord` (line 525–571).
 *
 * Tone per record type:
 *   - weight     → leaf
 *   - vaccine    → brand
 *   - vet        → peach / cookie
 *   - feeding    → brand-tint
 *   - medication → cookie-tint
 */
type Props = {
  record: HealthRecord;
  onDelete?: () => void;
};

type ToneSpec = { bg: string; text: string; icon: LucideIcon };

const TONE: Record<HealthRecordType, ToneSpec> = {
  weight: { bg: "bg-mango-leaf-tint", text: "text-mango-leaf", icon: Scale },
  vaccine: { bg: "bg-mango-brand-tint", text: "text-mango-brand-deep", icon: Syringe },
  vet: { bg: "bg-mango-peach-tint", text: "text-mango-cookie", icon: Stethoscope },
  feeding: { bg: "bg-mango-brand-tint", text: "text-mango-brand-deep", icon: UtensilsCrossed },
  medication: { bg: "bg-mango-cookie-tint", text: "text-mango-cookie", icon: Pill },
};

function summarize(record: HealthRecord): {
  detail: string;
  note: string | null;
  title: string;
} {
  switch (record.type) {
    case "weight": {
      const d = record.data as WeightData;
      return {
        detail: `${d.kg} 公斤`,
        note: record.notes ?? null,
        title: "定期量測",
      };
    }
    case "feeding": {
      const d = record.data as FeedingData;
      const parts = [d.brand, d.amountG ? `${d.amountG}g` : null, d.foodType]
        .filter(Boolean)
        .join(" · ");
      return {
        detail: parts || "—",
        note: record.notes ?? null,
        title: d.brand ?? "餵食紀錄",
      };
    }
    case "vaccine": {
      const d = record.data as VaccineData;
      return {
        detail: d.name,
        note: record.notes ?? null,
        title: d.name,
      };
    }
    case "vet": {
      const d = record.data as VetData;
      return {
        detail: d.clinic,
        note: d.diagnosis,
        title: d.clinic,
      };
    }
    case "medication": {
      const d = record.data as MedicationData;
      return {
        detail: d.name,
        note: d.frequency ?? record.notes ?? null,
        title: d.name,
      };
    }
  }
}

export function PetHealthRecordCard({ record, onDelete }: Props) {
  const tC = useTranslations("Common");
  const tH = useTranslations("Health");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  const tone = TONE[record.type];
  const Icon = tone.icon;
  const { detail, note, title } = summarize(record);
  const dateStr = format(new Date(record.recordedAt.toMillis()), "yyyy/MM/dd", {
    locale: dateLocale,
  });

  return (
    <article className="rounded-[18px] border border-mango-hairline bg-mango-card p-3.5 shadow-card">
      <div className="flex items-center gap-3">
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
          <div
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.6px]",
              tone.text,
            )}
          >
            {tH(`types.${record.type}`)}
          </div>
          <div className="mt-0.5 truncate text-[14.5px] font-bold tracking-[-0.1px] text-mango-ink">
            {title}
          </div>
        </div>
        <div className="shrink-0 text-[11.5px] whitespace-nowrap text-mango-ink-3">
          {dateStr}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={tC("delete")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-mango-ink-3 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:hover:bg-red-950"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {(detail || note) && (
        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-dashed border-mango-hairline pt-2.5">
          <span className="text-[17px] font-extrabold tracking-[-0.3px] text-mango-ink">
            {detail}
          </span>
          {note && (
            <span className="text-xs text-mango-ink-2 line-clamp-1">{note}</span>
          )}
        </div>
      )}
    </article>
  );
}
