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
import type {
  HealthRecord,
  HealthRecordInput,
  HealthRecordType,
  WeightData,
} from "@/lib/types";

// Health records are nested under each pet at top-level:
//   pets/{petId}/healthRecords/{recordId}
// Family membership is gated by the parent pet's familyId in security rules,
// so no familyId field is required on each record itself.

function recordsCol(petId: string) {
  return collection(getDb(), "pets", petId, "healthRecords");
}

function recordDoc(petId: string, recordId: string) {
  return doc(getDb(), "pets", petId, "healthRecords", recordId);
}

function petDocRef(petId: string) {
  return doc(getDb(), "pets", petId);
}

export async function listRecords(
  petId: string,
  filter?: { type?: HealthRecordType; max?: number },
): Promise<HealthRecord[]> {
  const constraints = filter?.type
    ? [where("type", "==", filter.type), orderBy("recordedAt", "desc")]
    : [orderBy("recordedAt", "desc")];

  const snap = await getDocs(query(recordsCol(petId), ...constraints));
  return snap.docs.map((d) => ({
    ...(d.data() as HealthRecord),
    recordId: d.id,
  }));
}

export async function createRecord(
  petId: string,
  recordedByUid: string,
  input: HealthRecordInput,
): Promise<HealthRecord> {
  const docRef = await addDoc(recordsCol(petId), {
    petId,
    recordedByUid,
    type: input.type,
    data: input.data,
    recordedAt: Timestamp.fromDate(input.recordedAt),
    notes: input.notes ?? null,
    createdAt: serverTimestamp(),
  });

  // If it's a weight record, also sync to pet.weightKg for quick display
  // on the pet card. We don't have access to familyId here — but pet is
  // already top-level so we just update it directly.
  if (input.type === "weight") {
    const weightData = input.data as WeightData;
    if (weightData.kg) {
      await updateDoc(petDocRef(petId), { weightKg: weightData.kg });
    }
  }

  const snap = await getDoc(docRef);
  return { ...(snap.data() as HealthRecord), recordId: docRef.id };
}

export async function deleteRecord(
  petId: string,
  recordId: string,
): Promise<void> {
  await deleteDoc(recordDoc(petId, recordId));
}

export async function listWeightSeries(
  petId: string,
): Promise<{ date: number; kg: number }[]> {
  const snap = await getDocs(
    query(
      recordsCol(petId),
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

/** Copy `users/{uid}/pets/{petId}/healthRecords/*` to top-level
 *  `pets/{petId}/healthRecords/*` for every pet a user owns. Idempotent.
 *  Called once when the family is auto-created on first login. */
export async function migrateLegacyHealthRecordsToFamily(
  legacyUid: string,
): Promise<number> {
  const petsSnap = await getDocs(
    collection(getDb(), "users", legacyUid, "pets"),
  );
  if (petsSnap.empty) return 0;

  let migrated = 0;
  for (const petDoc of petsSnap.docs) {
    const petId = petDoc.id;
    const recsSnap = await getDocs(
      collection(getDb(), "users", legacyUid, "pets", petId, "healthRecords"),
    );
    if (recsSnap.empty) continue;

    const batch = writeBatch(getDb());
    let batchMigrated = 0;
    for (const rec of recsSnap.docs) {
      const newRef = doc(
        getDb(),
        "pets",
        petId,
        "healthRecords",
        rec.id,
      );
      const existing = await getDoc(newRef);
      if (existing.exists()) continue;
      batch.set(newRef, {
        ...rec.data(),
        recordedByUid: rec.data().recordedByUid ?? legacyUid,
      });
      batchMigrated++;
    }
    if (batchMigrated > 0) {
      await batch.commit();
      migrated += batchMigrated;
    }
  }
  return migrated;
}
