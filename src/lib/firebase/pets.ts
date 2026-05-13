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
} from "firebase/firestore";
import { getDb } from "./config";
import {
  deleteImage,
  fileExt,
  petAvatarPath,
  uploadImage,
} from "./storage";
import type { Pet, PetInput } from "@/lib/types";

function petsCollection(uid: string) {
  return collection(getDb(), "users", uid, "pets");
}

function petDoc(uid: string, petId: string) {
  return doc(getDb(), "users", uid, "pets", petId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export async function listPets(uid: string): Promise<Pet[]> {
  const snap = await getDocs(query(petsCollection(uid), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => ({ ...(d.data() as Pet), petId: d.id }));
}

export async function getPet(uid: string, petId: string): Promise<Pet | null> {
  const snap = await getDoc(petDoc(uid, petId));
  return snap.exists() ? ({ ...(snap.data() as Pet), petId: snap.id }) : null;
}

export async function createPet(
  uid: string,
  input: PetInput,
  avatar?: File,
): Promise<Pet> {
  const data = clean({
    ownerUid: uid,
    name: input.name,
    species: input.species,
    breed: input.breed,
    gender: input.gender,
    weightKg: input.weightKg,
    bio: input.bio,
    birthday: input.birthday ? Timestamp.fromDate(input.birthday) : undefined,
    createdAt: serverTimestamp(),
  });

  const docRef = await addDoc(petsCollection(uid), data);

  if (avatar) {
    const { url } = await uploadImage(
      petAvatarPath(uid, docRef.id, fileExt(avatar)),
      avatar,
    );
    await updateDoc(docRef, { photoURL: url });
  }

  return (await getPet(uid, docRef.id))!;
}

export async function updatePet(
  uid: string,
  petId: string,
  input: PetInput,
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

  await updateDoc(petDoc(uid, petId), updates);

  if (avatar) {
    const { url } = await uploadImage(
      petAvatarPath(uid, petId, fileExt(avatar)),
      avatar,
    );
    await updateDoc(petDoc(uid, petId), { photoURL: url });
  }

  return (await getPet(uid, petId))!;
}

export async function deletePet(uid: string, petId: string): Promise<void> {
  const pet = await getPet(uid, petId);
  if (pet?.photoURL) {
    const guessedExt = pet.photoURL.split("?")[0].split(".").pop() ?? "jpg";
    await deleteImage(petAvatarPath(uid, petId, guessedExt));
  }
  await deleteDoc(petDoc(uid, petId));
}
