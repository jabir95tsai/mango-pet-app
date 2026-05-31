"use client";

import { useEffect, useRef, useState } from "react";
import type { DogLeaderboardEntry, LeaderboardEntry } from "@/lib/types";

/** Glow window — kept in sync with the leaderboardGlow keyframe in
 *  globals.css. The keyframe runs 1500ms; we clear the glow flag at
 *  that mark so React un-applies the className and a subsequent diff
 *  on the same key can re-trigger it. */
const GLOW_DURATION_MS = 1500;

/** Fresh-write threshold. A realtime trigger write should land on the
 *  client within ~1-2s; the daily cron runs at 00:30 when basically
 *  nobody is on the page. Anything older than 5s is treated as "you
 *  arrived after the write happened" → no glow (avoids the page-mount
 *  flash). */
const FRESH_WINDOW_MS = 5_000;

/** Track a per-key lastUpdatedAt across snapshots, glow when it ticks
 *  forward AND the write is fresh.
 *
 *  Returns a Set of keys currently in the glow window. Callers pass
 *  `set.has(entryKey)` to a row's `isGlowing` prop.
 *
 *  Edge case (spec): the first snapshot post-mount has no baseline, so
 *  we record every key's lastUpdatedAt without glowing — otherwise
 *  every row would flash on page open. From snapshot #2 onward, any new
 *  lastUpdatedAt value triggers glow.
 *
 *  Generic over the entry type so both the walker board (keyed by uid)
 *  and the dog board (keyed by petId) share one timer-managed core —
 *  the caller supplies a key accessor and a millis accessor. */
function useGlow<T>(
  items: T[],
  getKey: (item: T) => string,
  getTsMs: (item: T) => number | undefined,
): Set<string> {
  // Last-seen lastUpdatedAt per key (millis). Ref instead of state so
  // updates inside the effect don't trigger an extra re-render.
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  // Mount-baseline guard — first snapshot only records, never glows.
  const baselineSetRef = useRef(false);
  const [glowing, setGlowing] = useState<Set<string>>(() => new Set());
  // Per-key clear-timer handles so we can cancel + restart on rapid
  // back-to-back writes from the same source.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

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

      // Mount-baseline pass — record but don't glow.
      if (!baselineSetRef.current) continue;

      // Glow if the timestamp moved forward AND the write is fresh.
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
  }, [items]);

  useEffect(() => {
    // Cleanup pending timers on unmount.
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return glowing;
}

/** Walker (human) board glow — keyed by `uid`. Behaviour unchanged from
 *  the original implementation; the page passes `set.has(entry.uid)`. */
export function useLeaderboardEntryGlow(
  entries: LeaderboardEntry[],
): Set<string> {
  return useGlow(
    entries,
    (e) => e.uid,
    (e) => e.lastUpdatedAt?.toMillis?.(),
  );
}

/** Dog board glow (leaderboard v2) — keyed by `petId`. The dog entries
 *  carry the same `lastUpdatedAt` denormalisation the walker board uses,
 *  so the realtime recomputeDogLeaderboards trigger flashes a dog's row
 *  the same way. Pass `set.has(entry.petId)`. */
export function useDogEntryGlow(
  entries: DogLeaderboardEntry[],
): Set<string> {
  return useGlow(
    entries,
    (e) => e.petId,
    (e) => e.lastUpdatedAt?.toMillis?.(),
  );
}
