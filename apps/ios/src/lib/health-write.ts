/**
 * iOS health-records WRITE layer — direct writes to the nested
 * `pets/{petId}/healthRecords`, mirroring apps/web/src/lib/firebase/
 * health-records.ts (createRecord / deleteRecord). A weight record also syncs
 * pet.weightKg so the header + overview show the latest weight (single source).
 */
import firestore from "@react-native-firebase/firestore";
import type { HealthRecordInput, WeightData } from "@mango/shared-types";

import { serverTimestamp, tsFromDate } from "./write-utils";

function recordsCol(petId: string) {
  return firestore().collection("pets").doc(petId).collection("healthRecords");
}

export async function createRecord(
  petId: string,
  recordedByUid: string,
  input: HealthRecordInput,
): Promise<string> {
  const ref = await recordsCol(petId).add({
    petId,
    recordedByUid,
    type: input.type,
    data: input.data,
    recordedAt: tsFromDate(input.recordedAt),
    notes: input.notes ?? null,
    createdAt: serverTimestamp(),
  });

  // Weight record → sync pet.weightKg for quick display (single source).
  if (input.type === "weight") {
    const kg = (input.data as WeightData).kg;
    if (kg) {
      await firestore().collection("pets").doc(petId).update({ weightKg: kg });
    }
  }
  return ref.id;
}

export async function deleteHealthRecord(
  petId: string,
  recordId: string,
): Promise<void> {
  await recordsCol(petId).doc(recordId).delete();
}
