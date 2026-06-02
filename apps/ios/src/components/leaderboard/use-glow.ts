/**
 * Row-glow hook (P4a) — ported from web apps/web/src/components/leaderboard/
 * use-glow.ts (pure React, no DOM). Tracks per-key lastUpdatedAt across
 * onSnapshot pushes and returns the Set of keys whose score just changed AND
 * is fresh (<5s), so a row can flash. The first snapshot post-mount only
 * records a baseline (no flash on open).
 */
import { useEffect, useRef, useState } from "react";
import type { DogLeaderboardEntry, LeaderboardEntry } from "@mango/shared-types";

const GLOW_DURATION_MS = 1500;
const FRESH_WINDOW_MS = 5_000;

function useGlow<T>(
  items: T[],
  getKey: (item: T) => string,
  getTsMs: (item: T) => number | undefined,
): Set<string> {
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const baselineSetRef = useRef(false);
  const [glowing, setGlowing] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const now = Date.now();
    const lastSeen = lastSeenRef.current;
    const timers = timersRef.current;
    const newlyGlowing: string[] = [];

    for (const item of items) {
      const tsMs = getTsMs(item);
      if (typeof tsMs !== "number") continue;
      const key = getKey(item);
      const prev = lastSeen.get(key);
      lastSeen.set(key, tsMs);
      if (!baselineSetRef.current) continue;
      if (prev != null && tsMs > prev && now - tsMs < FRESH_WINDOW_MS) {
        newlyGlowing.push(key);
      }
    }
    baselineSetRef.current = true;

    if (newlyGlowing.length > 0) {
      setGlowing((prev) => {
        const next = new Set(prev);
        for (const key of newlyGlowing) next.add(key);
        return next;
      });
      for (const key of newlyGlowing) {
        const existing = timers.get(key);
        if (existing) clearTimeout(existing);
        timers.set(
          key,
          setTimeout(() => {
            setGlowing((prev) => {
              if (!prev.has(key)) return prev;
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
            timers.delete(key);
          }, GLOW_DURATION_MS),
        );
      }
    }
    // Mirror web: only re-run when the snapshot array changes; getKey/getTsMs
    // are stateless and stable enough to capture from first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return glowing;
}

export function useLeaderboardEntryGlow(
  entries: LeaderboardEntry[],
): Set<string> {
  return useGlow(
    entries,
    (e) => e.uid,
    (e) => e.lastUpdatedAt?.toMillis?.(),
  );
}

export function useDogEntryGlow(entries: DogLeaderboardEntry[]): Set<string> {
  return useGlow(
    entries,
    (e) => e.petId,
    (e) => e.lastUpdatedAt?.toMillis?.(),
  );
}
