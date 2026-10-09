/**
 * Refetch-on-focus for Expo Router screens (XCUT-2).
 *
 * Web routes remount on every navigation, so their data is always fresh. Expo
 * Router keeps tab screens mounted, so a screen must refetch itself when it
 * regains focus — but not on every tab tap. `useFocusRefresh` calls `onStale()`
 * when the screen gains focus (or the app returns to the foreground while the
 * screen is focused) AND `isStale()` says so. Typical staleness rule (see
 * `isDataStale`): loaded >= 15 s ago, or the shared FamilyContext dataRevision
 * moved since the last load (another tab wrote something).
 *
 * The data hooks in src/lib (useWalksData / usePetsData / useFeedData) already
 * wire this internally — screens only need it for their own ad-hoc loads.
 */
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";

/** Minimum time between two focus-triggered refetches of the same screen. */
export const FOCUS_REFRESH_MIN_INTERVAL_MS = 15_000;

export type FocusRefreshOptions = {
  /** When false, focus / foreground events are ignored (e.g. scope unknown). */
  enabled?: boolean;
  /** Return true when the data should be reloaded now. */
  isStale: () => boolean;
  /** Called at most once per focus / foreground event when isStale() is true. */
  onStale: () => void;
};

export function useFocusRefresh({
  enabled = true,
  isStale,
  onStale,
}: FocusRefreshOptions): void {
  const latest = useRef({ enabled, isStale, onStale });
  latest.current = { enabled, isStale, onStale };
  const focused = useRef(false);

  const check = useCallback(() => {
    const cur = latest.current;
    if (!cur.enabled) return;
    if (cur.isStale()) cur.onStale();
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      check();
      return () => {
        focused.current = false;
      };
    }, [check]),
  );

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      const cameBack = prev !== "active" && next === "active";
      prev = next;
      if (cameBack && focused.current) check();
    });
    return () => sub.remove();
  }, [check]);
}

/**
 * Standard staleness rule: never loaded, loaded >= `minIntervalMs` ago, or the
 * shared data revision changed since the load.
 */
export function isDataStale(
  lastLoadedAt: number,
  loadedRevision: number,
  currentRevision: number,
  minIntervalMs: number = FOCUS_REFRESH_MIN_INTERVAL_MS,
): boolean {
  if (lastLoadedAt <= 0) return true;
  if (loadedRevision !== currentRevision) return true;
  return Date.now() - lastLoadedAt >= minIntervalMs;
}
