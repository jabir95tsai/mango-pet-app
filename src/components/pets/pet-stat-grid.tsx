"use client";

import { useTranslations } from "next-intl";
import { Bell, Cookie, Scale, PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 2×2 stat tile grid for the 概覽 tab. Tiles port prototype `StatTile`
 * (line 360–394) — small tinted icon disc + uppercase label + big
 * number + small sub-line. Sub colour is the brand/leaf accent so the
 * eye traces "today / streak / weight delta" without reading numbers.
 *
 * Caller passes pre-computed strings (locale-aware formatting lives
 * upstream so this stays a pure render component).
 */
type Tone = "brand" | "cookie" | "leaf";

type Tile = {
  icon: "bell" | "cookie" | "scale" | "paw";
  tone: Tone;
  labelKey: "nextReminder" | "monthSpend" | "weight" | "walkDays";
  value: string;
  unit?: string;
  sub: string;
  subTone?: Tone | "muted";
};

const ICON_BG: Record<Tone, string> = {
  brand: "bg-mango-brand-tint text-mango-brand-deep",
  cookie: "bg-mango-cookie-tint text-mango-cookie",
  leaf: "bg-mango-leaf-tint text-mango-leaf",
};

const SUB_COLOR: Record<NonNullable<Tile["subTone"]>, string> = {
  brand: "text-mango-brand-deep",
  cookie: "text-mango-cookie",
  leaf: "text-mango-leaf",
  muted: "text-mango-ink-3",
};

function IconFor({ kind }: { kind: Tile["icon"] }) {
  const c = "size-4";
  switch (kind) {
    case "bell":
      return <Bell className={c} strokeWidth={1.8} />;
    case "cookie":
      return <Cookie className={c} strokeWidth={1.8} />;
    case "scale":
      return <Scale className={c} strokeWidth={1.8} />;
    case "paw":
      return <PawPrint className={c} strokeWidth={1.8} />;
  }
}

function StatTile({ tile }: { tile: Tile }) {
  const tPP = useTranslations("PetsPage");
  return (
    <div className="flex min-h-[116px] flex-col gap-2 rounded-[18px] border border-mango-hairline bg-mango-card p-3.5 shadow-card">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "grid size-[30px] place-items-center rounded-[10px]",
            ICON_BG[tile.tone],
          )}
          aria-hidden="true"
        >
          <IconFor kind={tile.icon} />
        </div>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.3px] text-mango-ink-3">
          {tPP(`stat.${tile.labelKey}`)}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[26px] font-extrabold leading-none tracking-[-0.7px] text-mango-ink tabular-nums">
          {tile.value}
        </span>
        {tile.unit && (
          <span className="text-xs font-semibold text-mango-ink-2">
            {tile.unit}
          </span>
        )}
      </div>
      <span
        className={cn(
          "-mt-0.5 text-xs font-medium",
          SUB_COLOR[tile.subTone ?? "muted"],
        )}
      >
        {tile.sub}
      </span>
    </div>
  );
}

type Props = {
  nextReminder: { value: string; unit?: string; sub: string } | null;
  monthSpend: { value: string; sub: string };
  weight: { value: string; unit: string; sub: string } | null;
  walkDays: { value: string; unit: string; sub: string };
};

export function PetStatGrid({ nextReminder, monthSpend, weight, walkDays }: Props) {
  const tPP = useTranslations("PetsPage");

  const tiles: Tile[] = [
    {
      icon: "bell",
      tone: "brand",
      labelKey: "nextReminder",
      value: nextReminder?.value ?? "—",
      unit: nextReminder?.unit,
      sub: nextReminder?.sub ?? tPP("stat.noReminder"),
      subTone: nextReminder ? "brand" : "muted",
    },
    {
      icon: "cookie",
      tone: "cookie",
      labelKey: "monthSpend",
      value: monthSpend.value,
      unit: "NT$",
      sub: monthSpend.sub,
      subTone: "muted",
    },
    {
      icon: "scale",
      tone: "leaf",
      labelKey: "weight",
      value: weight?.value ?? "—",
      unit: weight?.unit,
      sub: weight?.sub ?? tPP("stat.noWeight"),
      subTone: weight ? "leaf" : "muted",
    },
    {
      icon: "paw",
      tone: "brand",
      labelKey: "walkDays",
      value: walkDays.value,
      unit: walkDays.unit,
      sub: walkDays.sub,
      subTone: "muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 pt-1">
      {tiles.map((tile, i) => (
        <StatTile key={i} tile={tile} />
      ))}
    </div>
  );
}
