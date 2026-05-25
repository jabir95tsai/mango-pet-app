import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./config";
import {
  deleteImage,
  fileExt,
  petAvatarPath,
  uploadImage,
} from "./storage";
import type { Pet, PetInput } from "@/lib/types";

// Top-level collection. familyId on each doc is the membership boundary.
const PETS = "pets";

function petsCollection() {
  return collection(getDb(), PETS);
}

function petDoc(petId: string) {
  return doc(getDb(), PETS, petId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export async function listPets(familyId: string): Promise<Pet[]> {
  const snap = await getDocs(
    query(
      petsCollection(),
      where("familyId", "==", familyId),
      orderBy("createdAt", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Pet), petId: d.id }));
}

/** Personal-mode counterpart of {@link listPets}: returns the signed-in
 *  user's pets that live outside any family (`familyId === null`).
 *  Requires the composite index `(ownerUid ASC, familyId ASC, createdAt ASC)`
 *  in firestore.indexes.json. Used by pages that render the active scope
 *  when `family === null` after the B2 onboarding redesign. */
export async function listPersonalPets(ownerUid: string): Promise<Pet[]> {
  const snap = await getDocs(
    query(
      petsCollection(),
      where("ownerUid", "==", ownerUid),
      where("familyId", "==", null),
      orderBy("createdAt", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Pet), petId: d.id }));
}

export async function getPet(petId: string): Promise<Pet | null> {
  const snap = await getDoc(petDoc(petId));
  return snap.exists() ? ({ ...(snap.data() as Pet), petId: snap.id }) : null;
}

export async function createPet(
  /** Pass `null` to create a personal-mode pet (lives in the creator's
   *  namespace; only the creator can read/write per rules). */
  familyId: string | null,
  ownerUid: string,
  input: PetInput,
  avatar?: File,
): Promise<Pet> {
  // familyId is preserved explicitly (including `null`) so the field is
  // queryable via `where("familyId", "==", null)`. The `clean` helper
  // strips undefined / "" so we splice it back in.
  const data = {
    familyId,
    ...clean({
      ownerUid,
      name: input.name,
      species: input.species,
      breed: input.breed,
      gender: input.gender,
      weightKg: input.weightKg,
      bio: input.bio,
      birthday: input.birthday ? Timestamp.fromDate(input.birthday) : undefined,
      createdAt: serverTimestamp(),
    }),
  };

  const docRef = await addDoc(petsCollection(), data);

  if (avatar) {
    const { url } = await uploadImage(
      // Storage path still uses ownerUid so each user's uploads stay
      // attributed; family members all read the same pet doc which
      // points at the URL.
      petAvatarPath(ownerUid, docRef.id, fileExt(avatar)),
      avatar,
    );
    await updateDoc(docRef, { photoURL: url });
  }

  return (await getPet(docRef.id))!;
}

export async function updatePet(
  petId: string,
  input: PetInput,
  /** Used for storage path when avatar is replaced. Any family member may
   *  update, but uploads are namespaced under the current user. */
  actingUid: string,
  avatar?: File,
): Promise<Pet> {
  const updates = clean({
    name: input.name,
    species: input.species,
    breed: input.breed,
    gender: input.gender,
    weightKg: input.weightKg,
    bio: input.bio,
    birthday: input.birthday ? Timestamp.fromDate(input.birthday) : undefined,
  });

  await updateDoc(petDoc(petId), updates);

  // walkGoal is set/overwritten as a whole map field — `clean` would
  // drop the entire object if any inner property were undefined, so we
  // splice it back outside the clean() pass. Absent input.walkGoal
  // means "don't touch the existing value" (matches the form, which
  // omits the field when the user didn't open the goal control).
  if (input.walkGoal) {
    await updateDoc(petDoc(petId), { walkGoal: input.walkGoal });
  }

  if (avatar) {
    const { url } = await uploadImage(
      petAvatarPath(actingUid, petId, fileExt(avatar)),
      avatar,
    );
    await updateDoc(petDoc(petId), { photoURL: url });
  }

  return (await getPet(petId))!;
}

/** Focused write for the walk goal alone — used by surfaces that want
 *  to update the goal without going through the full pet-form save
 *  path (e.g., a future inline stepper on the walks page picker, or a
 *  per-pet quick-edit). Pet edit form goes through `updatePet` so its
 *  single Save button writes everything atomically. */
export async function updatePetWalkGoal(
  petId: string,
  minutes: number,
  source: "manual" | "computed" = "manual",
): Promise<void> {
  await updateDoc(petDoc(petId), { walkGoal: { minutes, source } });
}

export async function deletePet(petId: string): Promise<void> {
  const pet = await getPet(petId);
  if (pet?.photoURL) {
    const guessedExt = pet.photoURL.split("?")[0].split(".").pop() ?? "jpg";
    // Storage was uploaded by whoever created the pet; only that user has
    // write to that path. If another family member deletes, Storage will
    // reject with permission-denied and would otherwise kill the whole
    // delete operation — so we treat storage cleanup as best-effort and
    // always proceed to delete the Firestore doc. Orphan images cost
    // virtually nothing and can be swept by a future cron.
    try {
      await deleteImage(petAvatarPath(pet.ownerUid, petId, guessedExt));
    } catch (err) {
      console.warn("[deletePet] storage cleanup failed (continuing):", err);
    }
  }
  await deleteDoc(petDoc(petId));
}

// Legacy `users/{uid}/pets/{petId}` migration helper was removed
// 2026-05-23 along with the legacy data + rules; see
// docs/features/legacy-path-cleanup.md.
