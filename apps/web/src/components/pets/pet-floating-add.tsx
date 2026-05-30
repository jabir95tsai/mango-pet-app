"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PetTab } from "./pet-tabs";

/**
 * Tab-aware floating add button — sits above the bottom nav (the
 * AppNav reserves ~76px at the bottom). Color flips per active tab so
 * users read "+ add reminder / + add expense / + add health record" by
 * tone alone. Ports prototype `FloatingAdd` (line 574–593).
 *
 * Positioning: `fixed` (not absolute — page scrolls inside the layout
 * main scroll, so absolute would scroll away). Bottom uses the safe-
 * area inset PLUS the bottom-nav height (5rem) PLUS a tiny gap.
 *
 * a11y: `aria-label` is provided by caller — "新增提醒" / "Add expense"
 * etc. — so the same component reads correctly under each tab.
 */
type Tone = {
  gradient: string;
  shadow: string;
};

const TONES: Record<PetTab, Tone> = {
  overview: {
    gradient: "linear-gradient(180deg, #f39800 0%, #d77b00 100%)",
    shadow:
      "0 16px 32px -8px rgba(243,152,0,0.55), 0 4px 10px -4px rgba(80,50,10,0.30), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
  reminders: {
    gradient: "linear-gradient(180deg, #f39800 0%, #d77b00 100%)",
    shadow:
      "0 16px 32px -8px rgba(243,152,0,0.55), 0 4px 10px -4px rgba(80,50,10,0.30), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
  expenses: {
    gradient: "linear-gradient(180deg, #ee9a5a 0%, #d77b3f 100%)",
    shadow:
      "0 16px 32px -8px rgba(215,123,63,0.55), 0 4px 10px -4px rgba(80,50,10,0.30), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
  health: {
    gradient: "linear-gradient(180deg, #79c074 0%, #3f8a3a 100%)",
    shadow:
      "0 16px 32px -8px rgba(63,138,58,0.50), 0 4px 10px -4px rgba(80,50,10,0.30), inset 0 1px 0 rgba(255,255,255,0.4)",
  },
};

type Props = {
  tab: PetTab;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
};

export function PetFloatingAdd({ tab, ariaLabel, onClick, className }: Props) {
  const tone = TONES[tab];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        background: tone.gradient,
        boxShadow: tone.shadow,
        bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)",
      }}
      className={cn(
        "fixed right-5 z-30 grid size-14 place-items-center rounded-full text-mango-ink transition-transform duration-200 ease-out hover:scale-[1.04] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mango-brand-deep/40 motion-reduce:transition-none motion-reduce:hover:scale-100 md:hidden",
        className,
      )}
    >
      <Plus className="size-[22px]" strokeWidth={2.5} />
    </button>
  );
}
