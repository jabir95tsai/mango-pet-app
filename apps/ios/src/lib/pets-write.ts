/**
 * iOS pets WRITE layer — direct Firestore writes mirroring
 * apps/web/src/lib/firebase/pets.ts (createPet / updatePet / deletePet). Avatar
 * upload goes through @react-native-firebase/storage at the same path web uses
 * (petAvatarPath), compressed with the shared IMAGE_PRESETS.avatar dimension.
 * No Cloud Functions — rules permit owner/family writes.
 */
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import type { PetInput } from "@mango/shared-types";

import { uploadPetAvatar } from "./photos";
import { petAvatarPath } from "./storage-paths";
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

/**
 * Delete a pet — same client path as web deletePet (apps/web/src/lib/firebase/
 * pets.ts): read the doc, best-effort delete the avatar object at
 * petAvatarPath(ownerUid, petId, <ext guessed from the URL>), then delete the
 * Firestore doc. Storage cleanup never blocks the delete: another family
 * member has no write access to the uploader's path (permission-denied), and
 * an orphan image costs virtually nothing. Health records / post photos are
 * kept (web copy: PetsPage.deletePetBody).
 */
export async function deletePet(petId: string): Promise<void> {
  try {
    const snap = await refOf(petId).get();
    const data = snap.data() as { ownerUid?: string; photoURL?: string } | undefined;
    if (data?.photoURL && data.ownerUid) {
      const guessedExt = data.photoURL.split("?")[0].split(".").pop() ?? "jpg";
      await storage().ref(petAvatarPath(data.ownerUid, petId, guessedExt)).delete();
    }
  } catch (err) {
    console.warn("[deletePet] storage cleanup failed (continuing):", err);
  }
  await refOf(petId).delete();
}
