"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, PawPrint } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PetsPageContent } from "@/components/pets/pets-page-content";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import type { Pet } from "@/lib/types";

/**
 * Pet detail entry — same UI as list mode but title is "寵物資料" and
 * the switcher hard-navigates to `/app/pets/[newPetId]` instead of
 * swapping in place. Tab state lives in `?tab=...` so deep links land
 * on the right body.
 */
export default function PetDetailPage() {
  const router = useRouter();
  const params = useParams<{ petId: string }>();
  const petId = params.petId;
  const tPet = useTranslations("Pet");
  const tC = useTranslations("Common");
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="text-sm text-mango-ink-3">{tC("loading")}</p>;
  }

  const pet = pets.find((p) => p.petId === petId);
  if (!pet) {
    return (
      <EmptyState
        icon={PawPrint}
        title={tPet("notFound")}
        action={
          <Button variant="secondary" onClick={() => router.push("/app/pets")}>
            <ArrowLeft className="size-4" />
            {tC("back")}
          </Button>
        }
      />
    );
  }

  return (
    <PetsPageContent
      mode="detail"
      pets={pets}
      initialPetId={pet.petId}
      onPetsChanged={refresh}
    />
  );
}
