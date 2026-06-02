/**
 * Pets-screen data hook — loads pets + reminders + expenses + walks for the
 * active scope (personal / family), picks the active pet, and exposes a
 * pull-to-refresh. Mirrors apps/web/src/app/app/pets/page.tsx data flow
 * (one-shot getDocs + Promise.all, NOT onSnapshot — the web page is also
 * one-shot; matches the shipped iOS walks pattern in use-walks-data).
 *
 * Active-pet selection is in-memory (web persists via localStorage; iOS would
 * need AsyncStorage which is already installed — a persistence upgrade is a
 * later polish, kept in-memory here for parity with use-walks-data).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Expense, Pet, Reminder, Walk } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import {
  listPetsForScope,
  listWalksForScope,
  resolveCurrentFamilyId,
} from "@/lib/walk-data";
import { listExpensesForScope, listRemindersForScope } from "@/lib/pets-data";

function petCreatedMs(p: Pet): number {
  const ts = p.createdAt as { toMillis?: () => number } | undefined;
  return ts?.toMillis?.() ?? 0;
}

export type PetsData = ReturnType<typeof usePetsData>;

export function usePetsData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const fam = await resolveCurrentFamilyId(user.uid);
        setFamilyId(fam);
        const [petList, reminderList, expenseList, walkList] =
          await Promise.all([
            listPetsForScope(fam, user.uid).catch(() => [] as Pet[]),
            listRemindersForScope(fam, user.uid).catch(() => [] as Reminder[]),
            listExpensesForScope(fam, user.uid).catch(() => [] as Expense[]),
            listWalksForScope(fam, user.uid, 200).catch(() => [] as Walk[]),
          ]);
        setPets(petList);
        setReminders(reminderList);
        setExpenses(expenseList);
        setWalks(walkList);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  // Primary pet = earliest createdAt (same anchor web + cloud functions use;
  // listPetsForScope already orders createdAt asc, so pets[0], but sort to be
  // robust against any reorder).
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

  return {
    loading,
    refreshing,
    pets,
    reminders,
    expenses,
    walks,
    familyId,
    activePet,
    hasMultiplePets: pets.length > 1,
    selectPet: setSelectedPetId,
    refresh,
  };
}
