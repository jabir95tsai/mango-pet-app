"use client";

import { format } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Trash2, Scale, UtensilsCrossed, Syringe, Stethoscope, Pill } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type {
  FeedingData,
  HealthRecord,
  HealthRecordType,
  MedicationData,
  VaccineData,
  VetData,
  WeightData,
} from "@/lib/types";

type Props = {
  record: HealthRecord;
  onDelete: () => void;
};

const ICONS: Record<HealthRecordType, LucideIcon> = {
  weight: Scale,
  feeding: UtensilsCrossed,
  vaccine: Syringe,
  vet: Stethoscope,
  medication: Pill,
};

const ICON_COLORS: Record<HealthRecordType, string> = {
  weight: "text-blue-500",
  feeding: "text-orange-500",
  vaccine: "text-green-500",
  vet: "text-rose-500",
  medication: "text-purple-500",
};

function formatDate(ts: Timestamp | undefined, locale: string): string {
  if (!ts) return "—";
  const d = new Date(ts.toMillis());
  return format(d, "yyyy-MM-dd", {
    locale: locale === "zh-TW" ? zhTW : enUS,
  });
}

export function HealthRecordCard({ record, onDelete }: Props) {
  const tH = useTranslations("Health");
  const locale = useLocale();
  const Icon = ICONS[record.type];

  return (
    <article className="flex gap-3 rounded-2xl border border-amber-200/60 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className={`shrink-0 size-10 rounded-full bg-zinc-100 dark:bg-zinc-900 grid place-items-center ${ICON_COLORS[record.type]}`}>
        <Icon className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{tH(`types.${record.type}`)}</p>
          <span className="text-xs text-zinc-500">{formatDate(record.recordedAt, locale)}</span>
        </div>
        <RecordSummary record={record} tH={tH} locale={locale} />
        {record.notes && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{record.notes}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        aria-label="delete"
        className="self-start p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}

function RecordSummary({
  record,
  tH,
  locale,
}: {
  record: HealthRecord;
  tH: (key: string) => string;
  locale: string;
}) {
  switch (record.type) {
    case "weight": {
      const d = record.data as WeightData;
      return <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.kg} kg</p>;
    }
    case "feeding": {
      const d = record.data as FeedingData;
      const parts = [d.brand, d.amountG ? `${d.amountG}g` : null, d.foodType]
        .filter(Boolean)
        .join(" · ");
      return <p className="text-sm text-zinc-600 dark:text-zinc-400">{parts || "—"}</p>;
    }
    case "vaccine": {
      const d = record.data as VaccineData;
      return (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {d.name}
          {d.nextDueAt && (
            <span className="text-zinc-500"> · {tH("fields.nextDue")}: {formatDate(d.nextDueAt, locale)}</span>
          )}
        </p>
      );
    }
    case "vet": {
      const d = record.data as VetData;
      return (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <p>{d.clinic}{d.doctor ? ` · ${d.doctor}` : ""}</p>
          <p className="line-clamp-1">{d.diagnosis}</p>
        </div>
      );
    }
    case "medication": {
      const d = record.data as MedicationData;
      const span =
        d.startsAt || d.endsAt
          ? ` (${formatDate(d.startsAt, locale)} → ${d.endsAt ? formatDate(d.endsAt, locale) : "?"})`
          : "";
      return (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {d.name}{d.frequency ? ` · ${d.frequency}` : ""}{span}
        </p>
      );
    }
  }
}
