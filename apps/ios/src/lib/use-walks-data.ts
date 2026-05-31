/**
 * WalksHome data hook — loads pets + recent walks for the active scope and
 * derives today/week/streak stats. Mirrors apps/web/src/app/app/walks/page.tsx
 * (refresh + primaryPet + activePet + goalMin + todayProgress + streak + week
 * flags). Active-pet selection is in-memory for P1a (web persists via
 * localStorage; iOS persistence needs AsyncStorage = a new dep → deferred,
 * see ship note handoff).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPetWalkGoalMinutes } from "@mango/shared-business";
import type { Pet, Walk } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import {
  listPetsForScope,
  listWalksForScope,
  resolveCurrentFamilyId,
} from "@/lib/walk-data";
import {
  computeStreak,
  getTodayProgress,
  getWeekDayDoneFlags,
  getWeekKm,
  getWeekWalkCount,
  todayIdxLocal,
} from "@/lib/walk-stats";

function petCreatedMs(p: Pet): number {
  const ts = p.createdAt as { toMillis?: () => number } | undefined;
  return ts?.toMillis?.() ?? 0;
}

export function useWalksData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fam = await resolveCurrentFamilyId(user.uid);
      setFamilyId(fam);
      const [petList, walkList] = await Promise.all([
        listPetsForScope(fam, user.uid).catch(() => [] as Pet[]),
        listWalksForScope(fam, user.uid).catch(() => [] as Walk[]),
      ]);
      setPets(petList);
      setWalks(walkList);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
  const todayProgress = useMemo(
    () => getTodayProgress(walks, goalMin),
    [walks, goalMin],
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
    [walks],
  );
  const weekDayFlags = useMemo(
    () => getWeekDayDoneFlags(walks, goalMin),
    [walks, goalMin],
  );
  const weekKm = useMemo(() => getWeekKm(walks), [walks]);
  const weekCount = useMemo(() => getWeekWalkCount(walks), [walks]);
  const todayIdx = useMemo(() => todayIdxLocal(), []);

  return {
    loading,
    pets,
    walks,
    familyId,
    activePet,
    hasMultiplePets: pets.length > 1,
    selectPet: setSelectedPetId,
    goalMin,
    todayProgress,
    streakDays,
    weekDayFlags,
    weekKm,
    weekCount,
    todayIdx,
    refresh,
  };
}
