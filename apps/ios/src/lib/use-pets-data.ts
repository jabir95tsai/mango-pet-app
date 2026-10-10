/**
 * Pets-screen data hook — loads pets + reminders + expenses + walks for the
 * active scope (personal / family), picks the active pet, and exposes
 * pull-to-refresh. Mirrors the web pets page data flow
 * (apps/web/src/app/app/pets/page.tsx + pets-page-content.tsx refreshData:
 * one-shot getDocs + Promise.allSettled, expenses/walks capped at 200, NOT
 * onSnapshot).
 *
 * Scope comes from FamilyContext via useScopedData (R08): switching / joining /
 * leaving a family reloads this hook, stale responses are dropped, read
 * failures surface as `error` (data kept) instead of an empty list, and the tab
 * refetches on focus when stale. Every write (PetForm / ReminderForm /
 * ExpenseForm) must gate on `scopeReady` and use `familyId` from here, then call
 * `reloadAfterWrite()`.
 *
 * Active-pet selection is in-memory (web persists via localStorage).
 */
import { useMemo, useState } from "react";
import type { Expense, Pet, Reminder, Walk } from "@mango/shared-types";

import { listPetsForScope, listWalksForScope } from "@/lib/walk-data";
import { listExpensesForScope, listRemindersForScope } from "@/lib/pets-data";
import { useScopedData, type ScopedFetcher } from "@/lib/use-family-scope";

/** Same 200-walk window web's pets page pulls (listWalks(familyId, 200)). */
const PETS_WALKS_LIMIT = 200;

function petCreatedMs(p: Pet): number {
  const ts = p.createdAt as { toMillis?: () => number } | undefined;
  return ts?.toMillis?.() ?? 0;
}

type PetsPayload = {
  pets: Pet[];
  reminders: Reminder[];
  expenses: Expense[];
  walks: Walk[];
  /** The pets read itself failed (0 pets is then unknown). */
  petsFailed: boolean;
};

const EMPTY: PetsPayload = { pets: [], reminders: [], expenses: [], walks: [], petsFailed: false };

const fetchPetsScreen: ScopedFetcher<PetsPayload> = async (
  { uid, familyId },
  prev,
) => {
  const [petsR, remindersR, expensesR, walksR] = await Promise.allSettled([
    listPetsForScope(familyId, uid),
    listRemindersForScope(familyId, uid),
    listExpensesForScope(familyId, uid),
    listWalksForScope(familyId, uid, PETS_WALKS_LIMIT),
  ]);
  const firstError = [petsR, remindersR, expensesR, walksR].find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  )?.reason;
  return {
    data: {
      pets: petsR.status === "fulfilled" ? petsR.value : (prev?.pets ?? []),
      reminders:
        remindersR.status === "fulfilled"
          ? remindersR.value
          : (prev?.reminders ?? []),
      expenses:
        expensesR.status === "fulfilled" ? expensesR.value : (prev?.expenses ?? []),
      walks: walksR.status === "fulfilled" ? walksR.value : (prev?.walks ?? []),
      petsFailed: petsR.status === "rejected",
    },
    error: firstError,
  };
};

export type PetsData = ReturnType<typeof usePetsData>;

export function usePetsData() {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const scoped = useScopedData<PetsPayload>({
    initial: EMPTY,
    fetch: fetchPetsScreen,
  });
  const { pets, reminders, expenses, walks, petsFailed } = scoped.data;

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
    loading: scoped.loading,
    refreshing: scoped.refreshing,
    /** Scope read error or last load error (previous data kept). */
    error: scoped.error,
    /** Pets could not be read (scope error or pets query failure) — never
     *  show the add-first-pet state then. Other partial failures don't count. */
    petsUnknown: scoped.scopeStatus === "error" || petsFailed,
    /** Gate every write (add pet / reminder / expense / health) on this. */
    scopeReady: scoped.scopeReady,
    scopeStatus: scoped.scopeStatus,
    pets,
    reminders,
    expenses,
    walks,
    /** Active scope (null = personal). Only authoritative when scopeReady. */
    familyId: scoped.familyId,
    family: scoped.family,
    activePet,
    hasMultiplePets: pets.length > 1,
    selectPet: setSelectedPetId,
    /** Pull-to-refresh / retry (re-resolves a failed family scope first). */
    refresh: scoped.refresh,
    /** Silent reload. */
    reload: scoped.reload,
    /** After a write: reload here + mark other tabs stale. */
    reloadAfterWrite: scoped.reloadAfterWrite,
  };
}
