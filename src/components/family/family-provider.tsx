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

      // Personal mode: no family. Nothing to load beyond the empty
      // family list. (The legacy `users/{uid}/...` → top-level migration
      // that used to live in this block was retired 2026-05-23 along
      // with the legacy data + rules; see docs/features/legacy-path-
      // cleanup.md. Stale `mango.migrated.{uid}.{familyId}` localStorage
      // keys are harmless no-ops at this point.)
      if (currentId === null) {
        setFamilies([]);
        setFamily(null);
        return;
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
