import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "./config";
import type { Walk, WalkInput } from "@/lib/types";

function walksCol(uid: string) {
  return collection(getDb(), "users", uid, "walks");
}

function walkDoc(uid: string, walkId: string) {
  return doc(getDb(), "users", uid, "walks", walkId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export type CreateWalkArgs = WalkInput & {
  ownerUid: string;
  score: number;
};

export async function createWalk(args: CreateWalkArgs): Promise<Walk> {
  const data = clean({
    ownerUid: args.ownerUid,
    petId: args.petId,
    petName: args.petName,
    startedAt: Timestamp.fromDate(args.startedAt),
    endedAt: Timestamp.fromDate(args.endedAt),
    distanceKm: args.distanceKm,
    durationMin: args.durationMin,
    path: args.path,
    isManual: args.isManual,
    score: args.score,
    notes: args.notes,
    createdAt: serverTimestamp(),
  });
  const docRef = await addDoc(walksCol(args.ownerUid), data);
  return {
    walkId: docRef.id,
    ownerUid: args.ownerUid,
    petId: args.petId,
    petName: args.petName,
    startedAt: Timestamp.fromDate(args.startedAt),
    endedAt: Timestamp.fromDate(args.endedAt),
    distanceKm: args.distanceKm,
    durationMin: args.durationMin,
    path: args.path,
    isManual: args.isManual,
    score: args.score,
    notes: args.notes,
    createdAt: Timestamp.now(),
  };
}

export async function listWalks(uid: string, max = 50): Promise<Walk[]> {
  const snap = await getDocs(
    query(walksCol(uid), orderBy("startedAt", "desc")),
  );
  return snap.docs
    .slice(0, max)
    .map((d) => ({ ...(d.data() as Walk), walkId: d.id }));
}

export async function deleteWalk(uid: string, walkId: string): Promise<void> {
  await deleteDoc(walkDoc(uid, walkId));
}
