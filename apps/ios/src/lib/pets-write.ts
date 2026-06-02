/**
 * iOS pets WRITE layer — direct Firestore writes mirroring
 * apps/web/src/lib/firebase/pets.ts (createPet / updatePet / deletePet). Avatar
 * upload goes through @react-native-firebase/storage at the same path web uses
 * (petAvatarPath), compressed with the shared IMAGE_PRESETS.avatar dimension.
 * No Cloud Functions — rules permit owner/family writes.
 */
import firestore from "@react-native-firebase/firestore";
import type { PetInput } from "@mango/shared-types";

import { uploadPetAvatar } from "./photos";
import { clean, deleteField, serverTimestamp, tsFromDate } from "./write-utils";

const col = () => firestore().collection("pets");
const refOf = (id: string) => col().doc(id);

/**
 * Create a pet (familyId null → personal mode). `avatarUri` is a local image
 * URI from the picker; when present it's compressed + uploaded after the doc
 * exists (so the path can use the new petId), then photoURL is written.
 * Returns the new petId.
 */
export async function createPet(
  familyId: string | null,
  ownerUid: string,
  input: PetInput,
  avatarUri?: string,
): Promise<string> {
  const ref = await col().add({
    familyId, // explicit (incl null) so `where(familyId == null)` works
    ...clean({
      ownerUid,
      name: input.name,
      species: input.species,
      speciesOther: input.speciesOther,
      breed: input.breed,
      gender: input.gender,
      weightKg: input.weightKg,
      bio: input.bio,
      birthday: input.birthday ? tsFromDate(input.birthday) : undefined,
      createdAt: serverTimestamp(),
    }),
  });

  if (avatarUri) {
    const url = await uploadPetAvatar(avatarUri, ownerUid, ref.id);
    await ref.update({ photoURL: url });
  }
  return ref.id;
}

/**
 * Update a pet. speciesOther is written only for "other" pets, else deleted so
 * a stale value can't shadow the dog/cat label (mirrors web). walkGoal is set
 * as a whole map only when provided (absent = leave existing). Avatar replaced
 * when `avatarUri` is a fresh local URI.
 */
export async function updatePet(
  petId: string,
  input: PetInput,
  actingUid: string,
  avatarUri?: string,
): Promise<void> {
  const updates: Record<string, unknown> = clean({
    name: input.name,
    species: input.species,
    breed: input.breed,
    gender: input.gender,
    weightKg: input.weightKg,
    bio: input.bio,
    birthday: input.birthday ? tsFromDate(input.birthday) : undefined,
  });
  updates.speciesOther =
    input.species === "other" && input.speciesOther
      ? input.speciesOther
      : deleteField();

  await refOf(petId).update(updates);

  if (input.walkGoal) {
    await refOf(petId).update({ walkGoal: input.walkGoal });
  }

  if (avatarUri) {
    const url = await uploadPetAvatar(avatarUri, actingUid, petId);
    await refOf(petId).update({ photoURL: url });
  }
}

export async function deletePet(petId: string): Promise<void> {
  // Storage avatar cleanup is best-effort on web; here we just drop the doc
  // (orphan avatar objects are negligible + swept later). Keeps delete simple
  // and avoids a permission-denied on cross-member deletes.
  await refOf(petId).delete();
}
