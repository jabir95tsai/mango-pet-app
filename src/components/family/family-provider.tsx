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
  createFamily as callCreateFamily,
  getFamily,
  listMyFamilies,
  setCurrentFamily,
} from "@/lib/firebase/families";
import { migrateLegacyPetsToFamily } from "@/lib/firebase/pets";
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

/** Auto-creates a default family for users who don't have one yet. This
 *  bootstraps existing users (who pre-date the family feature) and new
 *  signups on a first login — every user ends up with at least one family,
 *  so all data reads/writes can unconditionally assume `family != null`. */
async function ensureDefaultFamily(uid: string): Promise<{
  familyId: string;
  justCreated: boolean;
}> {
  const appUser = await getAppUser(uid);
  const existing = appUser?.familyIds ?? [];
  if (existing.length > 0) {
    return {
      familyId: appUser?.currentFamilyId ?? existing[0],
      justCreated: false,
    };
  }
  // No family yet — create one via the callable. Name defaults to 我的家庭
  // on the server; user can rename later from settings.
  const { familyId } = await callCreateFamily("我的家庭");
  return { familyId, justCreated: true };
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
      // Ensure user has at least one family (auto-creates if none).
      const { familyId: currentId, justCreated } = await ensureDefaultFamily(
        user.uid,
      );

      // First-login migration: when we just created the default family for
      // an existing user, move their legacy pets/walks/etc. into it. Each
      // migration helper is idempotent and a no-op for users with no
      // legacy data, so running it on every fresh-family creation is safe.
      if (justCreated) {
        try {
          const moved = await migrateLegacyPetsToFamily(user.uid, currentId);
          if (moved > 0) {
            console.info(`[FamilyProvider] migrated ${moved} legacy pets`);
          }
        } catch (err) {
          // Non-fatal — user can still use the app; legacy data stays
          // visible via the back-compat read paths until next attempt.
          console.error("[FamilyProvider] pet migration failed:", err);
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
