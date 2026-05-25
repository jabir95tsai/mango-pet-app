"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { PetFormDialog } from "@/components/pets/pet-form-dialog";
import { PetsEmptyState } from "@/components/pets/pets-empty-state";
import { PetsPageContent } from "@/components/pets/pets-page-content";
import {
  createPet,
  listPersonalPets,
  listPets,
} from "@/lib/firebase/pets";
import type { Pet, PetInput } from "@/lib/types";

/**
 * Pets list entry. Phase 2 v2 redesign — replaces the previous
 * grid-of-pet-cards layout with the new tabbed mango view (sticky
 * pills, stat grid, per-tab body). Renders `<PetsEmptyState>` when the
 * user has no pets yet; otherwise hands off to the shared
 * `<PetsPageContent>` in `list` mode (first pet is the default; user
 * can switch via the dropdown without leaving this route).
 */
export default function PetsPage() {
  const tC = useTranslations("Common");
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPet, setAddingPet] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPets(
        family
          ? await listPets(family.familyId)
          : await listPersonalPets(user.uid),
      );
    } finally {
      setLoading(false);
    }
  }, [family, user]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  async function handleAddPet(input: PetInput, avatar?: File) {
    if (!user) return;
    await createPet(family?.familyId ?? null, user.uid, input, avatar);
    setAddingPet(false);
    await refresh();
  }

  if (loading) {
    return <p className="text-sm text-mango-ink-3">{tC("loading")}</p>;
  }

  if (pets.length === 0) {
    return (
      <>
        <PetsEmptyState onAddPet={() => setAddingPet(true)} />
        <PetFormDialog
          open={addingPet}
          onClose={() => setAddingPet(false)}
          onSubmit={handleAddPet}
        />
      </>
    );
  }

  return (
    <PetsPageContent
      mode="list"
      pets={pets}
      initialPetId={pets[0].petId}
      onPetsChanged={refresh}
    />
  );
}
