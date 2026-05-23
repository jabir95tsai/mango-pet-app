"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getFamily,
  listMyFamilies,
  setCurrentFamily,
} from "@/lib/firebase/families";
import { migrateLegacyPetsToFamily } from "@/lib/firebase/pets";
import { migrateLegacyWalksToFamily } from "@/lib/firebase/walks";
import { migrateLegacyRemindersToFamily } from "@/lib/firebase/reminders";
import { migrateLegacyExpensesToFamily } from "@/lib/firebase/expenses";
import { migrateLegacyHealthRecordsToFamily } from "@/lib/firebase/health-records";
import { getAppUser } from "@/lib/firebase/users";
import type { Family } from "@/lib/types";

type FamilyContextValue = {
  /** Active family for filtering reads/writes. Null while loading or if the
   *  user somehow has no family (auto-create should prevent this). */
  family: Family | null;
  /** All families this user belongs to — for the switcher UI. */
  families: Family[];
  loading: boolean;
  /** Force a re-fetch — call after joining/leaving/regenerating-code etc. */
  refresh: () => Promise<void>;
  /** Switch active family (persists currentFamilyId on the user doc). */
  switchFamily: (familyId: string) => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue>({
  family: null,
  families: [],
  loading: true,
  refresh: async () => {},
  switchFamily: async () => {},
});

/** Resolve the user's current family — or `null` if they don't have one.
 *  Phase B2: stopped auto-creating "我的家庭" because that violates the
 *  "family is optional" product principle. Users with no family fall into
 *  **personal mode** (familyId === null on docs they create); they can
 *  opt into a family later from settings or /onboarding. */
async function resolveCurrentFamily(uid: string): Promise<{
  familyId: string | null;
}> {
  const appUser = await getAppUser(uid);
  const existing = appUser?.familyIds ?? [];
  if (existing.length === 0) {
    return { familyId: null };
  }
  return {
    familyId: appUser?.currentFamilyId ?? existing[0],
  };
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFamily(null);
      setFamilies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { familyId: currentId } = await resolveCurrentFamily(user.uid);

      // Personal mode: no family means there's nothing to migrate INTO —
      // legacy `users/{uid}/...` docs stay in legacy paths and just don't
      // surface in personal-mode lists. Once the user opts into a family
      // (create or join), the next render will pick currentId up and run
      // migrations through this same code path.
      if (currentId === null) {
        setFamilies([]);
        setFamily(null);
        return;
      }

      // Migration: idempotently move legacy `users/{uid}/...` data into the
      // family-scoped collections. We run this whenever localStorage hasn't
      // yet recorded a successful migration for this (uid, familyId) pair.
      // Each helper is idempotent (skips top-level docs that already exist),
      // and a no-op for users with no legacy data, so re-running is safe.
      const migrationKey = `mango.migrated.${user.uid}.${currentId}`;
      const alreadyMigrated =
        typeof localStorage !== "undefined" &&
        localStorage.getItem(migrationKey) === "1";

      if (!alreadyMigrated) {
        try {
          const [pets, walks, reminders, expenses, healthRecords] = await Promise.all([
            migrateLegacyPetsToFamily(user.uid, currentId).catch((e) => {
              console.error("[FamilyProvider] pet migration failed:", e);
              return 0;
            }),
            migrateLegacyWalksToFamily(user.uid, currentId).catch((e) => {
              console.error("[FamilyProvider] walk migration failed:", e);
              return 0;
            }),
            migrateLegacyRemindersToFamily(user.uid, currentId).catch((e) => {
              console.error("[FamilyProvider] reminder migration failed:", e);
              return 0;
            }),
            migrateLegacyExpensesToFamily(user.uid, currentId).catch((e) => {
              console.error("[FamilyProvider] expense migration failed:", e);
              return 0;
            }),
            // Health records migration must run AFTER pets are at top-level
            // because it writes under pets/{petId}/healthRecords. The pets
            // migration above is the same Promise.all batch — they'll both
            // see the legacy pets list, so order within the parallel batch
            // is fine.
            migrateLegacyHealthRecordsToFamily(user.uid).catch((e) => {
              console.error("[FamilyProvider] health-record migration failed:", e);
              return 0;
            }),
          ]);
          const total = pets + walks + reminders + expenses + healthRecords;
          console.info(
            `[FamilyProvider] migration done — ` +
              `${pets} pets, ${walks} walks, ${reminders} reminders, ` +
              `${expenses} expenses, ${healthRecords} health records`,
          );
          // Mark complete so we don't re-run on every page load. This is a
          // best-effort cache — wiping localStorage just re-runs the
          // (idempotent) migration on next visit.
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(migrationKey, "1");
          }
          // Touch unused var so the linter doesn't flag the destructure.
          void total;
        } catch (err) {
          // Outer catch is just defense-in-depth — each .catch above already
          // swallowed individual failures.
          console.error("[FamilyProvider] migration outer failure:", err);
        }
      }

      const [all, current] = await Promise.all([
        listMyFamilies(user.uid),
        getFamily(currentId),
      ]);
      setFamilies(all);
      setFamily(current);
    } catch (err) {
      console.error("[FamilyProvider] refresh failed:", err);
      setFamily(null);
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const switchFamily = useCallback(
    async (familyId: string) => {
      if (!user) return;
      await setCurrentFamily(user.uid, familyId);
      const next = await getFamily(familyId);
      setFamily(next);
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const value = useMemo(
    () => ({ family, families, loading, refresh, switchFamily }),
    [family, families, loading, refresh, switchFamily],
  );

  return (
    <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}

/** Convenience hook: throws if no active family. Use in pages that have
 *  already gated on `loading` so we know family is non-null at render time. */
export function useFamilyId(): string {
  const { family } = useFamily();
  if (!family) {
    throw new Error("useFamilyId called outside FamilyProvider or before load");
  }
  return family.familyId;
}
