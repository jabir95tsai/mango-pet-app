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

export async function getPet(petId: string): Promise<Pet | null> {
  const snap = await getDoc(petDoc(petId));
  return snap.exists() ? ({ ...(snap.data() as Pet), petId: snap.id }) : null;
}

export async function createPet(
  familyId: string,
  ownerUid: string,
  input: PetInput,
  avatar?: File,
): Promise<Pet> {
  const data = clean({
    familyId,
    ownerUid,
    name: input.name,
    species: input.species,
    breed: input.breed,
    gender: input.gender,
    weightKg: input.weightKg,
    bio: input.bio,
    birthday: input.birthday ? Timestamp.fromDate(input.birthday) : undefined,
    createdAt: serverTimestamp(),
  });

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

  if (avatar) {
    const { url } = await uploadImage(
      petAvatarPath(actingUid, petId, fileExt(avatar)),
      avatar,
    );
    await updateDoc(petDoc(petId), { photoURL: url });
  }

  return (await getPet(petId))!;
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

// ────────────────────────────────────────────────────────────────────
// Legacy migration
// ────────────────────────────────────────────────────────────────────

/** Copies pets from the legacy `users/{uid}/pets/{petId}` path to the new
 *  top-level `pets/{petId}` collection with `familyId` set. Idempotent —
 *  if the new doc already exists, skips. Source docs are LEFT in place for
 *  safety; a separate cleanup pass can remove them once we're confident.
 *
 *  Returns the number of pets migrated this run (0 if user has none, or
 *  all already moved). */
export async function migrateLegacyPetsToFamily(
  legacyUid: string,
  familyId: string,
): Promise<number> {
  const legacyCol = collection(getDb(), "users", legacyUid, "pets");
  const snap = await getDocs(legacyCol);
  if (snap.empty) return 0;

  let migrated = 0;
  const batch = writeBatch(getDb());

  for (const legacyDoc of snap.docs) {
    const data = legacyDoc.data();
    // If the new top-level doc with same petId already exists, skip — we
    // never overwrite to avoid clobbering newer state if the user has
    // been writing through the new path on a different device.
    const newRef = doc(getDb(), PETS, legacyDoc.id);
    const existing = await getDoc(newRef);
    if (existing.exists()) continue;

    batch.set(newRef, {
      ...data,
      familyId,
      // ownerUid is the original creator. Keep whatever was on the legacy
      // doc, but fall back to legacyUid for old docs that pre-dated the
      // ownerUid field.
      ownerUid: data.ownerUid ?? legacyUid,
    });
    migrated++;
  }

  if (migrated > 0) {
    await batch.commit();
  }
  return migrated;
}
