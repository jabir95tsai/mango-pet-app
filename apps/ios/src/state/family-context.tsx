/**
 * Family context (P4a) — read + switch, mirroring the web FamilyProvider shape
 * (apps/web/src/components/family/family-provider.tsx). Resolves the active
 * family from users/{uid} (currentFamilyId ?? familyIds[0]; personal mode when
 * no familyIds). Mutations (create/join/leave/...) are callables added in P4b
 * and call refresh() afterwards. One-shot reads, no onSnapshot.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Family } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { resolveCurrentFamilyId } from "@/lib/walk-data";
import { listMyFamilies, setCurrentFamily } from "@/lib/families-read";

type FamilyContextValue = {
  family: Family | null;
  families: Family[];
  loading: boolean;
  refresh: () => Promise<void>;
  switchFamily: (familyId: string) => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue>({
  family: null,
  families: [],
  loading: true,
  refresh: async () => {},
  switchFamily: async () => {},
});

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFamilies([]);
      setFamily(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, activeId] = await Promise.all([
        listMyFamilies(user.uid),
        resolveCurrentFamilyId(user.uid),
      ]);
      setFamilies(list);
      setFamily(
        activeId ? list.find((f) => f.familyId === activeId) ?? list[0] ?? null : null,
      );
    } catch {
      setFamilies([]);
      setFamily(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchFamily = useCallback(
    async (familyId: string) => {
      if (!user) return;
      await setCurrentFamily(user.uid, familyId);
      setFamily(families.find((f) => f.familyId === familyId) ?? null);
    },
    [user, families],
  );

  const value = useMemo(
    () => ({ family, families, loading, refresh, switchFamily }),
    [family, families, loading, refresh, switchFamily],
  );
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  return useContext(FamilyContext);
}
