"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import type { Pet } from "@/lib/types";
import { PetAvatar } from "./pet-avatar";
import { cn } from "@/lib/utils";

/**
 * Floating pet switcher panel. Opens beneath the pet header when the
 * user taps the name + chevron. Each row = real avatar + name + meta;
 * bottom row is "新增寵物". Click outside or Esc closes.
 *
 * Ports prototype `PetSwitcher` (line 268–318) — absolute position
 * lives in the parent because the dropdown's anchor depends on whether
 * we're in list or detail mode.
 */
type Props = {
  pets: Pet[];
  currentPetId: string;
  onSelect: (pet: Pet) => void;
  onAddPet: () => void;
  onClose: () => void;
};

export function PetSwitcherDropdown({
  pets,
  currentPetId,
  onSelect,
  onAddPet,
  onClose,
}: Props) {
  const tPet = useTranslations("Pet");
  const tPP = useTranslations("PetsPage");
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-outside + Esc to close. Listener is added in capture phase so
  // a click on a child of the dropdown still fires before we count it
  // as an outside click.
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.target instanceof Node && !panel.contains(e.target)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Defer one tick so the click that *opened* the dropdown doesn't
    // immediately close it (the click bubbles after this effect runs).
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", handleDocClick);
      window.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", handleDocClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="menu"
      className="absolute left-0 z-20 w-60 rounded-[18px] border border-mango-hairline bg-mango-card p-1.5 shadow-elevated"
      style={{ top: "calc(100% + 4px)" }}
    >
      {pets.map((p) => {
        const active = p.petId === currentPetId;
        return (
          <button
            key={p.petId}
            type="button"
            role="menuitem"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors",
              active
                ? "bg-mango-brand-tint"
                : "hover:bg-mango-bg-alt focus:bg-mango-bg-alt",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
            )}
          >
            <PetAvatar photoURL={p.photoURL} name={p.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold leading-tight text-mango-ink">
                {p.name}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-mango-ink-3">
                {[p.breed ?? p.speciesOther ?? tPet(`species.${p.species}`), p.weightKg != null ? `${p.weightKg} kg` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {active && (
              <Check
                className="size-4 shrink-0 text-mango-brand-deep"
                strokeWidth={2.6}
              />
            )}
          </button>
        );
      })}

      <div className="my-1.5 h-px bg-mango-hairline" />

      <button
        type="button"
        role="menuitem"
        onClick={onAddPet}
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left text-mango-brand-deep transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <span className="grid size-[34px] place-items-center rounded-xl bg-mango-brand-tint text-mango-brand-deep">
          <Plus className="size-[18px]" strokeWidth={2.5} />
        </span>
        <span className="text-sm font-bold">
          {tPP("switcher.addPet")}
        </span>
      </button>
    </div>
  );
}
