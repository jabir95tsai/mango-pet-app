/**
 * Per-pet health records hook — lazily loads `pets/{petId}/healthRecords` when
 * the active pet changes (the Health tab mounts it). Separate from usePetsData
 * because records are nested per-pet and only needed when the Health tab is in
 * view.
 */
import { useCallback, useEffect, useState } from "react";
import type { HealthRecord } from "@mango/shared-types";

import { listHealthRecords } from "@/lib/health-data";

export function useHealthRecords(petId: string | null) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HealthRecord[]>([]);

  const reload = useCallback(async () => {
    if (!petId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRecords(await listHealthRecords(petId));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, records, reload };
}
