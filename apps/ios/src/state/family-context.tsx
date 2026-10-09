/**
 * Family context — the SINGLE source of the active data scope (R08), mirroring
 * the web FamilyProvider (apps/web/src/components/family/family-provider.tsx).
 *
 * Scope resolution (one users/{uid} read, see families-read loadFamilyScope):
 *   no familyIds → personal mode (currentFamilyId = null)
 *   else currentFamilyId ?? familyIds[0] (falls back to the first readable
 *   family when that doc is gone, so UI + data hooks agree on one id).
 *
 * Unlike the previous version, a READ FAILURE IS NOT PERSONAL MODE: status
 * becomes "error" (previous family kept for display) and every data hook /
 * write path must treat the scope as unknown until `refresh()` succeeds.
 *
 * Data hooks consume this via `useFamilyScope()` (src/lib/use-family-scope.ts)
 * instead of reading users/{uid}.currentFamilyId themselves, so a switch / join
 * / leave / create reaches every mounted tab at once.
 *
 * `markDataChanged()` / `dataRevision` is a tiny cross-tab invalidation signal:
 * call it after any write (the data hooks' `reloadAfterWrite()` does) and every
 * other mounted screen refetches the next time it gains focus.
 *
 * One-shot reads, no onSnapshot.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { Family } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { getFamily, loadFamilyScope, setCurrentFamily } from "@/lib/families-read";

export type FamilyStatus = "loading" | "ready" | "error";

export type FamilyContextValue = {
  /** Active family (null = personal mode when status === "ready"). While
   *  status is "loading"/"error" this is the last known family (or null). */
  family: Family | null;
  /** All families this user belongs to — for the switcher UI. */
  families: Family[];
  /** Active scope id = family?.familyId ?? null. Only authoritative when
   *  status === "ready"; never write with it otherwise. */
  currentFamilyId: string | null;
  /** "loading" while resolving (initial or after refresh()), "ready" when the
   *  scope is known (incl. personal mode), "error" when the read failed. */
  status: FamilyStatus;
  /** The read error when status === "error", else null. */
  error: unknown;
  /** Back-compat: status === "loading". */
  loading: boolean;
  /** Increments every time a scope resolution (refresh / switch) succeeds. */
  scopeVersion: number;
  /** familyId currently being switched to (pill busy state), else null. */
  switchingFamilyId: string | null;
  /** Cross-tab "data changed" counter (see markDataChanged). */
  dataRevision: number;
  /** Synchronous read of the latest dataRevision (not render-lagged). */
  getDataRevision: () => number;
  /** Mark scope data as changed after a write; returns the new revision.
   *  Mounted data hooks refetch on their next focus. */
  markDataChanged: () => number;
  /** Re-resolve the scope (call after join/leave/create/regen…). Never
   *  rejects; failures land in status "error". Identity is stable per uid. */
  refresh: () => Promise<void>;
  /** Persist currentFamilyId and switch every consumer at once. REJECTS when
   *  the write fails (scope unchanged) — callers must catch and surface it. */
  switchFamily: (familyId: string) => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue>({
  family: null,
  families: [],
  currentFamilyId: null,
  status: "loading",
  error: null,
  loading: true,
  scopeVersion: 0,
  switchingFamilyId: null,
  dataRevision: 0,
  getDataRevision: () => 0,
  markDataChanged: () => 0,
  refresh: async () => {},
  switchFamily: async () => {},
});

type ScopeState = {
  /** uid this state was resolved for (null = signed out). */
  uid: string | null;
  status: FamilyStatus;
  family: Family | null;
  families: Family[];
  error: unknown;
};

const NO_FAMILIES: Family[] = [];

const INITIAL_STATE: ScopeState = {
  uid: null,
  status: "loading",
  family: null,
  families: NO_FAMILIES,
  error: null,
};

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const uid = user?.uid ?? null;

  const [state, setState] = useState<ScopeState>(INITIAL_STATE);
  const [scopeVersion, setScopeVersion] = useState(0);
  const [switchingFamilyId, setSwitchingFamilyId] = useState<string | null>(null);
  const [dataRevision, setDataRevision] = useState(0);

  // Latest-value refs so async callbacks never act on a superseded user/scope.
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Bumped by every refresh/switch; a resolution only lands if still current. */
  const genRef = useRef(0);
  const revisionRef = useRef(0);

  const getDataRevision = useCallback(() => revisionRef.current, []);
  const markDataChanged = useCallback(() => {
    revisionRef.current += 1;
    setDataRevision(revisionRef.current);
    return revisionRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++genRef.current;
    if (!uid) {
      setState({ ...INITIAL_STATE, status: "ready" });
      return;
    }
    // Keep the last known family for display while re-resolving the SAME
    // user; a different user starts from scratch.
    setState((prev) =>
      prev.uid === uid
        ? { ...prev, status: "loading", error: null }
        : { ...INITIAL_STATE, uid },
    );
    try {
      const { families, family } = await loadFamilyScope(uid);
      if (gen !== genRef.current || uidRef.current !== uid) return;
      setState({ uid, status: "ready", family, families, error: null });
      setScopeVersion((v) => v + 1);
    } catch (err) {
      if (gen !== genRef.current || uidRef.current !== uid) return;
      console.warn("[FamilyProvider] scope read failed:", err);
      // Do NOT fall back to personal mode — the scope is unknown.
      setState((prev) =>
        prev.uid === uid
          ? { ...prev, status: "error", error: err }
          : { ...INITIAL_STATE, uid, status: "error", error: err },
      );
    }
  }, [uid]);

  // Wait for auth to settle (web gates on authLoading), then resolve.
  useEffect(() => {
    if (initializing) return;
    void refresh();
  }, [initializing, refresh]);

  // A failed scope read retries itself when the app comes back to the
  // foreground (typical cause: launched offline).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const s = stateRef.current;
      if (uidRef.current && s.uid === uidRef.current && s.status === "error") {
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const switchFamily = useCallback(
    async (familyId: string) => {
      const switchUid = uidRef.current;
      if (!switchUid) return;
      const cur = stateRef.current;
      if (
        cur.uid === switchUid &&
        cur.status === "ready" &&
        cur.family?.familyId === familyId
      ) {
        return; // already active
      }
      setSwitchingFamilyId(familyId);
      try {
        // Throws → nothing changed server-side → the scope stays as it was and
        // the caller surfaces the error.
        await setCurrentFamily(switchUid, familyId);
        // From here the server-side scope IS familyId: invalidate any refresh
        // that read the user doc before this write.
        const gen = ++genRef.current;
        let next: Family | null = null;
        try {
          next = await getFamily(familyId);
        } catch {
          next = null; // fall back to the cached copy below
        }
        if (gen !== genRef.current || uidRef.current !== switchUid) return;
        const resolved =
          next ??
          stateRef.current.families.find((f) => f.familyId === familyId) ??
          null;
        if (!resolved) {
          // Neither a fresh nor a cached copy — re-resolve from the user doc.
          await refresh();
          return;
        }
        setState((prev) => ({
          uid: switchUid,
          status: "ready",
          error: null,
          family: resolved,
          families: prev.families.some((f) => f.familyId === resolved.familyId)
            ? prev.families.map((f) =>
                f.familyId === resolved.familyId ? resolved : f,
              )
            : [...prev.families, resolved],
        }));
        setScopeVersion((v) => v + 1);
      } finally {
        setSwitchingFamilyId((current) => (current === familyId ? null : current));
      }
    },
    [refresh],
  );

  // Derive the render-time view so a user change is never served the previous
  // user's scope (child effects run before this provider's refresh effect).
  let status: FamilyStatus;
  let family: Family | null = null;
  let families: Family[] = NO_FAMILIES;
  let error: unknown = null;
  if (!uid) {
    status = initializing ? "loading" : "ready";
  } else if (state.uid !== uid) {
    status = "loading";
  } else {
    status = state.status;
    family = state.family;
    families = state.families;
    error = state.error;
  }
  const currentFamilyId = family?.familyId ?? null;

  const value = useMemo<FamilyContextValue>(
    () => ({
      family,
      families,
      currentFamilyId,
      status,
      error,
      loading: status === "loading",
      scopeVersion,
      switchingFamilyId,
      dataRevision,
      getDataRevision,
      markDataChanged,
      refresh,
      switchFamily,
    }),
    [
      family,
      families,
      currentFamilyId,
      status,
      error,
      scopeVersion,
      switchingFamilyId,
      dataRevision,
      getDataRevision,
      markDataChanged,
      refresh,
      switchFamily,
    ],
  );
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  return useContext(FamilyContext);
}
