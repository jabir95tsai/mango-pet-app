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
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import type {
  HealthRecord,
  HealthRecordInput,
  HealthRecordType,
  WeightData,
} from "@/lib/types";

function recordsCol(uid: string, petId: string) {
  return collection(getDb(), "users", uid, "pets", petId, "healthRecords");
}

function recordDoc(uid: string, petId: string, recordId: string) {
  return doc(getDb(), "users", uid, "pets", petId, "healthRecords", recordId);
}

export async function listRecords(
  uid: string,
  petId: string,
  filter?: { type?: HealthRecordType; max?: number },
): Promise<HealthRecord[]> {
  const constraints = filter?.type
    ? [where("type", "==", filter.type), orderBy("recordedAt", "desc")]
    : [orderBy("recordedAt", "desc")];

  const snap = await getDocs(query(recordsCol(uid, petId), ...constraints));
  return snap.docs.map((d) => ({
    ...(d.data() as HealthRecord),
    recordId: d.id,
  }));
}

export async function createRecord(
  uid: string,
  petId: string,
  input: HealthRecordInput,
): Promise<HealthRecord> {
  const docRef = await addDoc(recordsCol(uid, petId), {
    petId,
    type: input.type,
    data: input.data,
    recordedAt: Timestamp.fromDate(input.recordedAt),
    notes: input.notes ?? null,
    createdAt: serverTimestamp(),
  });

  // If it's a weight record, also sync to pet.weightKg for quick display
  if (input.type === "weight") {
    const weightData = input.data as WeightData;
    if (weightData.kg) {
      await updateDoc(doc(getDb(), "users", uid, "pets", petId), {
        weightKg: weightData.kg,
      });
    }
  }

  return {
    recordId: docRef.id,
    petId,
    type: input.type,
    data: input.data,
    recordedAt: Timestamp.fromDate(input.recordedAt),
    notes: input.notes,
    createdAt: Timestamp.now(),
  };
}

export async function deleteRecord(
  uid: string,
  petId: string,
  recordId: string,
): Promise<void> {
  await deleteDoc(recordDoc(uid, petId, recordId));
}

export async function listWeightSeries(
  uid: string,
  petId: string,
): Promise<{ date: number; kg: number }[]> {
  const snap = await getDocs(
    query(
      recordsCol(uid, petId),
      where("type", "==", "weight"),
      orderBy("recordedAt", "asc"),
    ),
  );
  return snap.docs
    .map((d) => {
      const r = d.data() as HealthRecord;
      const data = r.data as WeightData;
      return {
        date: (r.recordedAt as Timestamp).toMillis(),
        kg: data.kg,
      };
    })
    .filter((p) => typeof p.kg === "number" && !Number.isNaN(p.kg));
}
