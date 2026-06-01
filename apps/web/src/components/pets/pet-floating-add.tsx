"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PetTab } from "./pet-tabs";

/**
 * Tab-aware floating add button — sits above the bottom nav (the AppNav
 * reserves ~76px at the bottom). Ports prototype `FloatingAdd`.
 *
 * Tone is now UNIFORM across all four tabs (overview / reminders /
 * expenses / health): the same warm orange gradient + brand-orange shadow
 * as the 開始遛狗 CTA, so the primary "add" affordance reads as one
 * consistent action across the pets page. The earlier per-tab tints
 * (expenses peach, health green) are dropped. `tab` is still accepted so
 * the caller can pass the correct per-tab `aria-label`, but it no longer
 * drives colour.
 *
 * Positioning: `fixed` (not absolute — page scrolls inside the layout
 * main scroll, so absolute would scroll away). Bottom uses the safe-area
 * inset PLUS the bottom-nav height PLUS a tiny gap.
 *
 * a11y: `aria-label` is provided by caller — "新增提醒" / "Add expense"
 * etc. The `+` is white on the orange gradient to match the CTA.
 */
const ADD_GRADIENT =
  "linear-gradient(160deg, var(--color-mango-amber), var(--color-mango-brand) 50%, var(--color-mango-brand-deep))";
const ADD_SHADOW =
  "0 16px 32px -8px rgba(243,152,0,0.55), 0 4px 10px -4px rgba(80,50,10,0.30), inset 0 1px 0 rgba(255,255,255,0.4)";

type Props = {
  tab: PetTab;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
};

export function PetFloatingAdd({ ariaLabel, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        background: ADD_GRADIENT,
        boxShadow: ADD_SHADOW,
        bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)",
      }}
      className={cn(
        "fixed right-5 z-30 grid size-14 place-items-center rounded-full text-white transition-transform duration-200 ease-out hover:scale-[1.04] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mango-brand-deep/40 motion-reduce:transition-none motion-reduce:hover:scale-100 md:hidden",
        className,
      )}
    >
      <Plus className="size-[22px]" strokeWidth={2.5} />
    </button>
  );
}
