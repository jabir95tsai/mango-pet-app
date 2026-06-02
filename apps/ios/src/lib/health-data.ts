/**
 * iOS Health-records READ layer — nested `pets/{petId}/healthRecords`, mirrors
 * web apps/web/src/lib/firebase/health-records.ts `listRecords`. Permission is
 * gated by the parent pet's familyId in security rules, so no familyId field
 * is queried here. The weight series for the trend chart is derived
 * client-side from the same `recordedAt desc` list (no separate type-filtered
 * query → no extra composite-index dependency).
 *
 * READS ONLY. Writes (createRecord + pet.weightKg sync) land in P2c.
 */
import firestore from "@react-native-firebase/firestore";
import type { HealthRecord, HealthRecordType, WeightData } from "@mango/shared-types";

function recordsCol(petId: string) {
  return firestore().collection("pets").doc(petId).collection("healthRecords");
}

/** All records for a pet, newest first (optionally one type). */
export async function listHealthRecords(
  petId: string,
  filter?: { type?: HealthRecordType },
): Promise<HealthRecord[]> {
  const q = filter?.type
    ? recordsCol(petId)
        .where("type", "==", filter.type)
        .orderBy("recordedAt", "desc")
    : recordsCol(petId).orderBy("recordedAt", "desc");
  const snap = await q.get();
  return snap.docs.map(
    (d) =>
      ({ ...(d.data() as object), recordId: d.id }) as unknown as HealthRecord,
  );
}

export type WeightPoint = { date: number; kg: number };

/** Weight points (oldest → newest) derived from a loaded record list — same
 *  shape web's `listWeightSeries` returns, computed without a second query. */
export function weightSeriesFromRecords(records: HealthRecord[]): WeightPoint[] {
  return records
    .filter((r) => r.type === "weight")
    .map((r) => {
      const kg = (r.data as WeightData)?.kg;
      const date =
        (r.recordedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
        0;
      return { date, kg };
    })
    .filter((p) => typeof p.kg === "number" && !Number.isNaN(p.kg))
    .sort((a, b) => a.date - b.date);
}
