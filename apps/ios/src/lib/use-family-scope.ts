/**
 * Family-scope consumption for data hooks (R08 / XCUT-1).
 *
 *  - `useFamilyScope()` — auth uid + FamilyContext scope in one object. The
 *    ONLY way data code should learn the active familyId (never read
 *    users/{uid}.currentFamilyId directly).
 *  - `useScopedData()` — the shared loader the screen data hooks are built on:
 *      · waits until the scope is known (status "ready"); a scope read error is
 *        surfaced as `error`, never silently treated as personal mode;
 *      · (re)loads whenever uid / familyId (/ variant) changes and hides data
 *        that belongs to another scope (so a family switch can never pair
 *        family-B's familyId with family-A's pets);
 *      · discards stale responses (request generation);
 *      · keeps the last data on a failed reload and reports `error`;
 *      · refetches on screen focus / app foreground when stale (>= 15 s, or the
 *        shared dataRevision moved because another screen wrote);
 *      · `refresh()` for pull-to-refresh (also retries a failed scope read),
 *        `reloadAfterWrite()` after a write (marks other tabs stale too).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Family } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily, type FamilyStatus } from "@/state/family-context";
import {
  FOCUS_REFRESH_MIN_INTERVAL_MS,
  isDataStale,
  useFocusRefresh,
} from "@/lib/use-focus-refresh";

export type FamilyScope = {
  /** Signed-in uid (null when signed out). */
  uid: string | null;
  /** Active family id (null = personal mode). Only authoritative when
   *  `scopeReady` — never write with it otherwise. */
  familyId: string | null;
  /** Active family doc (name, memberUids, …) or null. */
  family: Family | null;
  status: FamilyStatus;
  /** uid present AND status === "ready": familyId may be used for reads/writes. */
  scopeReady: boolean;
  /** Stable string identifying (uid, familyId) when ready, else null. */
  scopeKey: string | null;
  /** Scope read error when status === "error", else null. */
  error: unknown;
  /** Re-resolve the scope (FamilyContext.refresh). */
  retry: () => Promise<void>;
  dataRevision: number;
  getDataRevision: () => number;
  markDataChanged: () => number;
};

export function scopeKeyOf(uid: string, familyId: string | null): string {
  return `${uid}|${familyId ?? "~personal"}`;
}

export function useFamilyScope(): FamilyScope {
  const { user } = useAuth();
  const {
    family,
    currentFamilyId,
    status,
    error,
    refresh,
    dataRevision,
    getDataRevision,
    markDataChanged,
  } = useFamily();
  const uid = user?.uid ?? null;
  const scopeReady = uid !== null && status === "ready";
  const scopeKey = scopeReady && uid ? scopeKeyOf(uid, currentFamilyId) : null;

  return useMemo(
    () => ({
      uid,
      familyId: currentFamilyId,
      family,
      status,
      scopeReady,
      scopeKey,
      error: status === "error" ? error : null,
      retry: refresh,
      dataRevision,
      getDataRevision,
      markDataChanged,
    }),
    [
      uid,
      currentFamilyId,
      family,
      status,
      scopeReady,
      scopeKey,
      error,
      refresh,
      dataRevision,
      getDataRevision,
      markDataChanged,
    ],
  );
}

// ───────────────────────────── useScopedData ─────────────────────────────

export type ScopeArgs = { uid: string; familyId: string | null };

/** A fetcher resolves with whatever it could load plus an optional error
 *  (partial failure). `previous` is the last data loaded for the SAME scope
 *  (null on first load / after a scope change) — use it to keep a source's
 *  old value when only that source failed. Rejecting is treated as a total
 *  failure (previous data kept, error reported). */
export type ScopedFetcher<T> = (
  scope: ScopeArgs,
  previous: T | null,
) => Promise<{ data: T; error?: unknown }>;

export type ScopedDataOptions<T> = {
  /** Value exposed before the first load / for another scope. Captured once. */
  initial: T;
  fetch: ScopedFetcher<T>;
  /** Extra cache-key segment (e.g. "home" vs "feed"); a change reloads. */
  variant?: string;
  /** Refetch on focus / foreground when stale (default true). */
  focusRefresh?: boolean;
  minIntervalMs?: number;
  /** Extra staleness signal checked on focus (OR'ed with the default rule). */
  isStale?: () => boolean;
};

export type ScopedData<T> = {
  data: T;
  /** Signed-in uid (null when signed out). */
  uid: string | null;
  /** True until data for the CURRENT scope has loaded (false on error). */
  loading: boolean;
  /** True while a pull-to-refresh (`refresh()`) is in flight. */
  refreshing: boolean;
  /** Scope read error, else the last load's error (partial or total). */
  error: unknown;
  /** Scope known AND familyId authoritative — gate every write on this. */
  scopeReady: boolean;
  /** Active familyId (null = personal). Only valid when scopeReady. */
  familyId: string | null;
  family: Family | null;
  scopeStatus: FamilyStatus;
  /** Pull-to-refresh / retry: reloads (re-resolves the scope first if it
   *  failed). Sets `refreshing`. */
  refresh: () => Promise<void>;
  /** Silent reload (no spinner). */
  reload: () => Promise<void>;
  /** Call after a write: marks every other screen stale (they refetch on
   *  focus) and silently reloads this one. */
  reloadAfterWrite: () => Promise<void>;
  /** Local optimistic update of the loaded data. */
  mutate: (fn: (prev: T) => T) => void;
  /** Mark other screens stale without reloading this one (e.g. after a local
   *  optimistic removal). */
  markChanged: () => void;
};

type Slot<T> = {
  /** `${scopeKey}|${variant}` the data was loaded for. */
  key: string | null;
  uid: string | null;
  loaded: boolean;
  data: T;
  error: unknown;
};

type LoadMode = "initial" | "refresh" | "silent";

export function useScopedData<T>(options: ScopedDataOptions<T>): ScopedData<T> {
  const scope = useFamilyScope();
  const {
    uid,
    familyId,
    family,
    status,
    scopeReady,
    scopeKey,
    retry,
    getDataRevision,
    markDataChanged,
  } = scope;
  const variant = options.variant ?? "";
  const key = scopeKey ? `${scopeKey}|${variant}` : null;
  const minIntervalMs = options.minIntervalMs ?? FOCUS_REFRESH_MIN_INTERVAL_MS;

  const initialRef = useRef(options.initial);
  const fetchRef = useRef(options.fetch);
  fetchRef.current = options.fetch;
  const extraStaleRef = useRef(options.isStale);
  extraStaleRef.current = options.isStale;

  const [slot, setSlot] = useState<Slot<T>>(() => ({
    key: null,
    uid: null,
    loaded: false,
    data: initialRef.current,
    error: null,
  }));
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const [refreshing, setRefreshing] = useState(false);

  const genRef = useRef(0);
  /** Key of the most recently STARTED load. */
  const requestedKeyRef = useRef<string | null>(null);
  const lastLoadedAtRef = useRef(0);
  const loadedRevisionRef = useRef(-1);
  /** A refresh/reload requested while the scope was not ready. */
  const pendingRef = useRef<Exclude<LoadMode, "initial"> | null>(null);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!uid || !scopeReady || !key) {
        if (mode !== "initial") {
          pendingRef.current =
            pendingRef.current === "refresh" || mode === "refresh"
              ? "refresh"
              : "silent";
        }
        return;
      }
      const gen = ++genRef.current;
      requestedKeyRef.current = key;
      lastLoadedAtRef.current = Date.now();
      loadedRevisionRef.current = getDataRevision();
      if (mode === "refresh") setRefreshing(true);
      const prev = slotRef.current;
      const previous = prev.loaded && prev.key === key ? prev.data : null;
      let result: { data: T; error?: unknown };
      try {
        result = await fetchRef.current({ uid, familyId }, previous);
      } catch (err) {
        result = { data: previous ?? initialRef.current, error: err };
      }
      if (gen !== genRef.current) return; // superseded by a newer load
      setSlot({
        key,
        uid,
        loaded: true,
        data: result.data,
        error: result.error ?? null,
      });
      setRefreshing(false);
    },
    [uid, familyId, scopeReady, key, getDataRevision],
  );

  // Load on scope (uid / familyId / variant) change; run deferred refreshes.
  useEffect(() => {
    if (!uid) return;
    if (status === "error") {
      pendingRef.current = null;
      setRefreshing(false);
      return;
    }
    if (!scopeReady || !key) return;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (requestedKeyRef.current !== key) {
      void load(pending === "refresh" ? "refresh" : "initial");
    } else if (pending) {
      void load(pending);
    }
  }, [uid, status, scopeReady, key, load]);

  // Declared AFTER the load effect so the mount load counts as "fresh".
  useFocusRefresh({
    enabled: (options.focusRefresh ?? true) && scopeReady,
    isStale: () =>
      key !== null &&
      requestedKeyRef.current === key &&
      (isDataStale(
        lastLoadedAtRef.current,
        loadedRevisionRef.current,
        getDataRevision(),
        minIntervalMs,
      ) ||
        (extraStaleRef.current?.() ?? false)),
    onStale: () => {
      void load("silent");
    },
  });

  const refresh = useCallback(async () => {
    if (!uid) return;
    if (status === "error") {
      pendingRef.current = "refresh";
      setRefreshing(true);
      await retry();
      return;
    }
    if (!scopeReady) {
      pendingRef.current = "refresh";
      setRefreshing(true);
      return;
    }
    await load("refresh");
  }, [uid, status, scopeReady, retry, load]);

  const reload = useCallback(() => load("silent"), [load]);

  const reloadAfterWrite = useCallback(async () => {
    markDataChanged();
    await load("silent");
  }, [markDataChanged, load]);

  const mutate = useCallback((fn: (prev: T) => T) => {
    setSlot((s) => (s.loaded ? { ...s, data: fn(s.data) } : s));
  }, []);

  const markChanged = useCallback(() => {
    loadedRevisionRef.current = markDataChanged();
  }, [markDataChanged]);

  // Only expose data that belongs to the current scope. While the scope is
  // re-resolving (key null) the same user's last data stays visible, but
  // scopeReady is false so writes are blocked.
  const visible =
    slot.loaded && slot.uid === uid && (key === null || slot.key === key)
      ? slot
      : null;

  return {
    data: visible ? visible.data : initialRef.current,
    uid,
    loading: status === "error" ? false : visible === null,
    refreshing,
    error: status === "error" ? scope.error : (visible?.error ?? null),
    scopeReady,
    familyId,
    family,
    scopeStatus: status,
    refresh,
    reload,
    reloadAfterWrite,
    mutate,
    markChanged,
  };
}
