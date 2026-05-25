"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, Pencil } from "lucide-react";
import type { Pet } from "@/lib/types";
import { PetAvatar } from "./pet-avatar";
import { cn } from "@/lib/utils";

/**
 * Pet header — 64px avatar + name (with chevron when multi-pet) + 3
 * meta chips (species/breed · sex · age · weight) + pencil edit
 * button. Ports prototype `PetHeader` (line 225–265).
 *
 * - `multi`: only show the chevron-down when the family has ≥ 2 pets;
 *   1-pet households never see a switcher affordance.
 * - `dropdownOpen`: rotates the chevron 180° (matches prototype).
 */
type Props = {
  pet: Pet;
  multi: boolean;
  dropdownOpen?: boolean;
  onToggleSwitcher?: () => void;
  onEdit: () => void;
};

function formatAge(birthday?: Pet["birthday"]): string | null {
  if (!birthday) return null;
  const birthMs = birthday.toMillis();
  const now = Date.now();
  const years = Math.floor((now - birthMs) / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years} 歲`;
  const months = Math.floor((now - birthMs) / (30 * 24 * 3600 * 1000));
  return `${Math.max(months, 1)} 個月`;
}

function genderSym(gender?: Pet["gender"]): string | null {
  if (!gender || gender === "unknown") return null;
  return gender === "male" ? "♂" : "♀";
}

export function PetHeader({
  pet,
  multi,
  dropdownOpen = false,
  onToggleSwitcher,
  onEdit,
}: Props) {
  const tPet = useTranslations("Pet");
  const tC = useTranslations("Common");

  const sex = genderSym(pet.gender);
  const age = formatAge(pet.birthday);
  const sexAge = [sex, age].filter(Boolean).join(" · ");

  const chips = [
    pet.breed ?? tPet(`species.${pet.species}`),
    sexAge,
    pet.weightKg != null ? `${pet.weightKg} 公斤` : null,
  ].filter((s): s is string => !!s && s.length > 0);

  return (
    <div className="pt-2 pb-1">
      <div className="flex items-center gap-3.5">
        <PetAvatar photoURL={pet.photoURL} name={pet.name} size={64} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={multi ? onToggleSwitcher : undefined}
            disabled={!multi}
            className={cn(
              "flex items-center gap-1 text-left",
              multi &&
                "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
            )}
            aria-expanded={multi ? dropdownOpen : undefined}
            aria-haspopup={multi ? "menu" : undefined}
          >
            <span className="text-[22px] font-extrabold leading-tight tracking-[-0.4px] text-mango-ink">
              {pet.name}
            </span>
            {multi && (
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-[22px] place-items-center rounded-md text-mango-ink-2 transition-transform duration-200 ease-out motion-reduce:transition-none",
                  dropdownOpen && "rotate-180",
                )}
              >
                <ChevronDown className="size-3.5" strokeWidth={2.2} />
              </span>
            )}
          </button>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((t, i) => (
              <span
                key={i}
                className="rounded-full border border-mango-hairline bg-mango-bg-alt px-2 py-0.5 text-[11.5px] font-semibold tracking-[0.1px] text-mango-ink-2"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={tC("edit")}
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-mango-hairline bg-mango-card text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}
