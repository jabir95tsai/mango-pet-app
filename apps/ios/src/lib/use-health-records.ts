/**
 * Per-pet health records hook — lazily loads `pets/{petId}/healthRecords` when
 * the active pet changes (the Health tab mounts it). Separate from usePetsData
 * because records are nested per-pet and only needed when the Health tab is in
 * view.
 *
 * PETS-21 / XCUT-14 (R16):
 *  - records ALWAYS belong to the requested pet: every load carries a request
 *    generation and a response for a superseded pet/request is dropped;
 *  - the full-area spinner (`loading`) only shows when nothing is known for this
 *    pet yet — a `reloadKey` bump / `reload()` / `refresh()` keeps the current
 *    list on screen (records already seen for a pet are cached per pet, so
 *    switching back is instant and refreshes silently);
 *  - a failed load keeps the previous records and reports `error`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { HealthRecord } from "@mango/shared-types";

import { listHealthRecords } from "@/lib/health-data";

type Slot = {
  petId: string | null;
  records: HealthRecord[];
  error: unknown;
};

const NO_RECORDS: HealthRecord[] = [];

export function useHealthRecords(petId: string | null, reloadKey: number = 0) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const genRef = useRef(0);
  /** Last successfully loaded records per pet (instant pet switch-back). */
  const cacheRef = useRef(new Map<string, HealthRecord[]>());

  const load = useCallback(
    async (mode: "auto" | "refresh") => {
      const gen = ++genRef.current;
      if (!petId) {
        setSlot({ petId: null, records: NO_RECORDS, error: null });
        setRefreshing(false);
        return;
      }
      if (mode === "refresh") setRefreshing(true);
      try {
        const records = await listHealthRecords(petId);
        if (gen !== genRef.current) return; // a newer pet/request won
        cacheRef.current.set(petId, records);
        setSlot({ petId, records, error: null });
      } catch (err) {
        if (gen !== genRef.current) return;
        setSlot({
          petId,
          records: cacheRef.current.get(petId) ?? NO_RECORDS,
          error: err,
        });
      } finally {
        if (gen === genRef.current) setRefreshing(false);
      }
    },
    [petId],
  );

  // Pet change or reloadKey bump → (re)load. reloadKey is a deliberate
  // re-trigger dep (bumped after a HealthForm save / pull-to-refresh).
  useEffect(() => {
    void load("auto");
  }, [load, reloadKey]);

  const reload = useCallback(() => load("auto"), [load]);
  const refresh = useCallback(() => load("refresh"), [load]);

  const current = slot && slot.petId === petId ? slot : null;
  const cached = petId ? cacheRef.current.get(petId) : undefined;
  const records = current?.records ?? cached ?? NO_RECORDS;
  const loading = petId !== null && current === null && cached === undefined;

  return {
    /** True only while nothing is known yet for this pet (first load). */
    loading,
    records,
    /** Last load error for this pet (records kept), else null. */
    error: current?.error ?? null,
    /** Pull-to-refresh in flight. */
    refreshing,
    /** Silent reload (keeps the list on screen). */
    reload,
    /** Reload with `refreshing` set (pull-to-refresh). */
    refresh,
  };
}
