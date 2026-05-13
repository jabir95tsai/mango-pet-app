"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import type { Pet } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";

type Props = {
  pet: Pet;
  onEdit: () => void;
  onDelete: () => void;
};

const SPECIES_EMOJI: Record<Pet["species"], string> = {
  dog: "🐶",
  cat: "🐱",
  other: "🐾",
};

export function PetCard({ pet, onEdit, onDelete }: Props) {
  const tCommon = useTranslations("Common");

  function stop(handler: () => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    };
  }

  return (
    <Link
      href={`/app/pets/${pet.petId}`}
      className="flex items-center gap-4 rounded-2xl border border-amber-200/60 bg-white p-4 transition-colors hover:border-amber-400 hover:bg-amber-50/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
    >
      <Avatar src={pet.photoURL} name={pet.name} size={64} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="font-semibold truncate">{pet.name}</h3>
          <span className="text-xs text-zinc-500">{SPECIES_EMOJI[pet.species]}</span>
          {pet.breed && (
            <span className="text-xs text-zinc-500">· {pet.breed}</span>
          )}
        </div>
        <div className="flex gap-3 text-xs text-zinc-500 mt-1">
          {pet.weightKg != null && <span>{pet.weightKg} kg</span>}
          {pet.gender && pet.gender !== "unknown" && (
            <span>{pet.gender === "male" ? "♂" : "♀"}</span>
          )}
        </div>
        {pet.bio && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{pet.bio}</p>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={stop(onEdit)}
          aria-label={tCommon("edit")}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={stop(onDelete)}
          aria-label={tCommon("delete")}
          className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </Link>
  );
}
