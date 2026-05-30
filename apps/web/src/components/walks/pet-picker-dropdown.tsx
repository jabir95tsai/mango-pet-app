"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Settings } from "lucide-react";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { getPetWalkGoalMinutes } from "@/lib/walk-goals";
import { cn } from "@/lib/utils";
import type { Pet } from "@/lib/types";

/**
 * Walks page pet picker. Opens beneath the top-bar mango pill when
 * the user taps the name + chevron. Each row shows pet avatar / name
 * / per-pet daily-goal chip; the active row is highlighted brandDeep.
 * Bottom row links to /app/pets.
 *
 * Mirrors PetSwitcherDropdown's structure (click-outside + Esc to
 * close, deferred listener attach so the opening click doesn't
 * immediately close) — kept as a sibling component rather than a
 * shared one because the walks picker shows the per-pet goal chip
 * while the pets-page switcher shows breed/weight meta. The two
 * vary enough that abstracting would muddle both.
 */
type Props = {
  pets: Pet[];
  currentPetId: string;
  onSelect: (pet: Pet) => void;
  onClose: () => void;
};

export function PetPickerDropdown({
  pets,
  currentPetId,
  onSelect,
  onClose,
}: Props) {
  // Spec calls these out under "WalksPage.petPicker.*" but the existing
  // walks-page i18n already nests under Walks.page.* — keep the dotted
  // path consistent with the rest of the file rather than introducing
  // a parallel top-level namespace for two keys.
  const tPP = useTranslations("Walks.page.petPicker");
  const panelRef = useRef<HTMLDivElement>(null);

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
      className="absolute left-0 z-30 mt-1 w-64 rounded-[18px] border border-mango-hairline bg-mango-card p-1.5 shadow-elevated"
    >
      {pets.map((p) => {
        const active = p.petId === currentPetId;
        const goalMin = getPetWalkGoalMinutes(p);
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
              <span
                className={cn(
                  "mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active
                    ? "bg-white text-mango-brand-deep"
                    : "bg-mango-bg-alt text-mango-ink-2",
                )}
              >
                {tPP("goalChip", { n: goalMin })}
              </span>
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

      <Link
        href="/app/pets"
        role="menuitem"
        onClick={onClose}
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <span className="grid size-[34px] place-items-center rounded-xl bg-mango-bg-alt text-mango-ink-2">
          <Settings className="size-[18px]" />
        </span>
        <span className="text-sm font-bold">{tPP("manageLink")}</span>
      </Link>
    </div>
  );
}
