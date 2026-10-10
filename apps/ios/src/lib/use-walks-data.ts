/**
 * WalksHome data hook — loads pets + walks for the active scope and derives
 * today/week/streak stats. Mirrors apps/web/src/app/app/walks/page.tsx
 * (refresh keyed on [user, family], waits for the family scope, allSettled
 * pets/walks, primaryPet + activePet + goalMin + todayProgress + streak + week
 * flags).
 *
 * Scope comes from FamilyContext via useScopedData (R08): a family switch /
 * join / leave reloads this hook, stale responses are dropped, a scope read
 * failure is surfaced as `error` (never personal mode), and the tab refetches
 * on focus when stale. Writers must gate on `scopeReady` and pass `familyId`.
 *
 * Walk history (WALKS-12): see listWalksForStats — stats always match web's
 * full-history numbers; the list holds the newest 60 unless `walksComplete`.
 * Call `loadAllWalks()` before showing the full "view all" list.
 *
 * Active-pet selection persists under the web localStorage key
 * (`mango.walks.lastPetId`, AsyncStorage). Day-dependent stats recompute when
 * the app returns to the foreground on a new day (WALKS-2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPetWalkGoalMinutes } from "@mango/shared-business";
import type { Pet, Walk } from "@mango/shared-types";

import {
  getAutoPhotoShare,
  listPetsForScope,
  listWalksForScope,
  listWalksForStats,
} from "@/lib/walk-data";
import {
  scopeKeyOf,
  useScopedData,
  type ScopedFetcher,
} from "@/lib/use-family-scope";
import {
  computeStreak,
  getTodayProgress,
  getWeeklyAvgMinutes,
  getWeekDayDoneFlags,
  getWeekKm,
  getWeekWalkCount,
  todayIdxLocal,
} from "@/lib/walk-stats";

function petCreatedMs(p: Pet): number {
  const ts = p.createdAt as { toMillis?: () => number } | undefined;
  return ts?.toMillis?.() ?? 0;
}

type WalksPayload = {
  pets: Pet[];
  walks: Walk[];
  /** walks is the full history (not just the newest page). */
  walksComplete: boolean;
  autoPhotoShare: boolean;
};

const EMPTY: WalksPayload = {
  pets: [],
  walks: [],
  walksComplete: false,
  autoPhotoShare: true,
};

export type WalksData = ReturnType<typeof useWalksData>;

/** Same key as web walks/page.tsx. */
const LAST_PET_KEY = "mango.walks.lastPetId";

/** Local calendar day — bumps the day-dependent stats after midnight. */
function useDayKey(): string {
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") setDayKey(new Date().toDateString());
    });
    return () => sub.remove();
  }, []);
  return dayKey;
}

export function useWalksData() {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const dayKey = useDayKey();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LAST_PET_KEY)
      .then((v) => {
        // A pick made before storage answered wins.
        if (alive && v) setSelectedPetId((cur) => cur ?? v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const selectPet = useCallback((petId: string) => {
    setSelectedPetId(petId);
    AsyncStorage.setItem(LAST_PET_KEY, petId).catch(() => {});
  }, []);
  /** Scope key for which the user asked for the full history ("view all"). */
  const wantAllKeyRef = useRef<string | null>(null);

  const fetchWalksHome = useCallback<ScopedFetcher<WalksPayload>>(
    async ({ uid, familyId }, prev) => {
      const wantAll = wantAllKeyRef.current === scopeKeyOf(uid, familyId);
      const [petsR, walksR, autoR] = await Promise.allSettled([
        listPetsForScope(familyId, uid),
        wantAll
          ? listWalksForScope(familyId, uid, null).then((walks) => ({
              walks,
              complete: true,
            }))
          : listWalksForStats(familyId, uid),
        // Best-effort, default ON (web: only an explicit false disables).
        getAutoPhotoShare(uid),
      ]);
      const error =
        petsR.status === "rejected"
          ? petsR.reason
          : walksR.status === "rejected"
            ? walksR.reason
            : undefined;
      return {
        data: {
          pets: petsR.status === "fulfilled" ? petsR.value : (prev?.pets ?? []),
          walks:
            walksR.status === "fulfilled" ? walksR.value.walks : (prev?.walks ?? []),
          walksComplete:
            walksR.status === "fulfilled"
              ? walksR.value.complete
              : (prev?.walksComplete ?? false),
          autoPhotoShare:
            autoR.status === "fulfilled"
              ? autoR.value
              : (prev?.autoPhotoShare ?? true),
        },
        error,
      };
    },
    [],
  );

  const scoped = useScopedData<WalksPayload>({
    initial: EMPTY,
    fetch: fetchWalksHome,
  });
  const { pets, walks, walksComplete, autoPhotoShare } = scoped.data;
  const { reload } = scoped;

  /** Load the full walk history for "view all" (no-op when already complete). */
  const { uid: scopeUid, scopeReady, familyId } = scoped;
  const loadAllWalks = useCallback(async () => {
    if (walksComplete || !scopeUid || !scopeReady) return;
    wantAllKeyRef.current = scopeKeyOf(scopeUid, familyId);
    await reload();
  }, [walksComplete, reload, scopeUid, scopeReady, familyId]);

  // Primary pet = earliest createdAt (same anchor web + cloud functions use).
  const primaryPet = useMemo<Pet | null>(() => {
    if (pets.length === 0) return null;
    return [...pets].sort((a, b) => petCreatedMs(a) - petCreatedMs(b))[0];
  }, [pets]);

  const activePet = useMemo<Pet | null>(() => {
    if (pets.length === 0) return null;
    if (selectedPetId) {
      const found = pets.find((p) => p.petId === selectedPetId);
      if (found) return found;
    }
    return primaryPet;
  }, [pets, selectedPetId, primaryPet]);

  const goalMin = useMemo(() => getPetWalkGoalMinutes(activePet), [activePet]);
  /* eslint-disable react-hooks/exhaustive-deps -- dayKey re-runs the
     date-relative helpers after midnight */
  const todayProgress = useMemo(
    () => getTodayProgress(walks, goalMin),
    [walks, goalMin, dayKey],
  );
  const streakDays = useMemo(
    () =>
      computeStreak(
        walks
          .map((w) => {
            const ts = w.startedAt as { toMillis?: () => number } | undefined;
            return ts?.toMillis ? new Date(ts.toMillis()) : null;
          })
          .filter((d): d is Date => d !== null),
      ),
    [walks, dayKey],
  );
  const weekDayFlags = useMemo(
    () => getWeekDayDoneFlags(walks, goalMin),
    [walks, goalMin, dayKey],
  );
  const weekKm = useMemo(() => getWeekKm(walks), [walks, dayKey]);
  const weekCount = useMemo(() => getWeekWalkCount(walks), [walks, dayKey]);
  const weeklyAvgMin = useMemo(() => getWeeklyAvgMinutes(walks), [walks, dayKey]);
  const todayIdx = useMemo(() => todayIdxLocal(), [walks, dayKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    loading: scoped.loading,
    /** Pull-to-refresh in flight. */
    refreshing: scoped.refreshing,
    /** Scope read error or last load error (data kept). */
    error: scoped.error,
    /** Gate every write (start walk / manual log) on this. */
    scopeReady: scoped.scopeReady,
    scopeStatus: scoped.scopeStatus,
    pets,
    walks,
    walksComplete,
    /** Active scope (null = personal). Only authoritative when scopeReady. */
    familyId: scoped.familyId,
    family: scoped.family,
    activePet,
    hasMultiplePets: pets.length > 1,
    selectPet,
    goalMin,
    todayProgress,
    streakDays,
    weekDayFlags,
    weekKm,
    weekCount,
    weeklyAvgMin,
    autoPhotoShare,
    todayIdx,
    /** Pull-to-refresh / retry (re-resolves a failed family scope first). */
    refresh: scoped.refresh,
    /** Silent reload. */
    reload,
    /** After saving a walk: reload here + mark other tabs stale. */
    reloadAfterWrite: scoped.reloadAfterWrite,
    loadAllWalks,
  };
}
