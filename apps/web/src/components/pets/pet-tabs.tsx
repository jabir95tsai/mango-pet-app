"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Sticky pill tab bar — 4 tabs (overview / reminders / expenses /
 * health) inside a single bg-alt pill with a gradient fade behind so
 * content scrolling underneath disappears cleanly. Ports prototype
 * `PetTabs` (line 320–357).
 *
 * Active tab gets card bg + soft shadow + bold weight; transition is
 * 200ms ease (globally cancelled by prefers-reduced-motion via
 * globals.css). The bar is `sticky top-0` — the parent page handles
 * scroll container so this works inside the existing AppLayout main.
 */
export type PetTab = "overview" | "reminders" | "expenses" | "health";

export const PET_TABS: readonly PetTab[] = [
  "overview",
  "reminders",
  "expenses",
  "health",
] as const;

type Props = {
  active: PetTab;
  onChange: (tab: PetTab) => void;
};

export function PetTabs({ active, onChange }: Props) {
  const tPP = useTranslations("PetsPage");

  return (
    <div
      className="sticky top-0 z-10 px-0 pt-3.5 pb-2.5"
      style={{
        background:
          "linear-gradient(180deg, var(--color-mango-bg) 0%, var(--color-mango-bg) 70%, rgba(251,241,221,0) 100%)",
      }}
    >
      <div className="grid grid-cols-4 gap-1 rounded-full border border-mango-hairline bg-mango-bg-alt p-1">
        {PET_TABS.map((id) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={cn(
                "rounded-full px-0 py-2 text-center text-[13.5px] tracking-[0.2px] transition-[background-color,color] duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
                isActive
                  ? "bg-mango-card font-bold text-mango-ink shadow-[0_4px_10px_-6px_rgba(80,50,10,0.30),0_1px_0_rgba(0,0,0,0.02)]"
                  : "font-semibold text-mango-ink-2 hover:text-mango-ink",
              )}
            >
              {tPP(`tabs.${id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
