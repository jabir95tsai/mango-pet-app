"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PawPrint, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PetCard } from "@/components/pets/pet-card";
import { PetFormDialog } from "@/components/pets/pet-form-dialog";
import { createPet, deletePet, listPets, updatePet } from "@/lib/firebase/pets";
import type { Pet, PetInput } from "@/lib/types";

export default function PetsPage() {
  const t = useTranslations("Nav");
  const tPet = useTranslations("Pet");
  const tCommon = useTranslations("Common");
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pet | undefined>();

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPets(await listPets(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function handleEdit(pet: Pet) {
    setEditing(pet);
    setDialogOpen(true);
  }

  async function handleDelete(pet: Pet) {
    if (!user) return;
    if (!confirm(`${tCommon("delete")}: ${pet.name}?`)) return;
    await deletePet(user.uid, pet.petId);
    await refresh();
  }

  async function handleSubmit(input: PetInput, avatar?: File) {
    if (!user) return;
    if (editing) {
      await updatePet(user.uid, editing.petId, input, avatar);
    } else {
      await createPet(user.uid, input, avatar);
    }
    await refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-6">
        <RouteHeader title={t("pets")} />
        <Button onClick={handleAdd} size="md">
          <Plus className="size-4" />
          {tPet("addPet")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tCommon("loading")}</p>
      ) : pets.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title={tPet("addPet")}
          description="新增第一隻寵物來開始紀錄體重、餵食、疫苗等健康資料。"
          action={
            <Button onClick={handleAdd} size="md">
              <Plus className="size-4" />
              {tPet("addPet")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pets.map((pet) => (
            <PetCard
              key={pet.petId}
              pet={pet}
              onEdit={() => handleEdit(pet)}
              onDelete={() => handleDelete(pet)}
            />
          ))}
        </div>
      )}

      <PetFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </>
  );
}
