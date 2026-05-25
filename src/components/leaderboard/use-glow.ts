"use client";

import { useEffect, useRef, useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";

/** Glow window — kept in sync with the leaderboardGlow keyframe in
 *  globals.css. The keyframe runs 1500ms; we clear the glow flag at
 *  that mark so React un-applies the className and a subsequent diff
 *  on the same uid can re-trigger it. */
const GLOW_DURATION_MS = 1500;

/** Fresh-write threshold. A realtime trigger write should land on the
 *  client within ~1-2s; the daily cron runs at 00:30 when basically
 *  nobody is on the page. Anything older than 5s is treated as "you
 *  arrived after the write happened" → no glow (avoids the page-mount
 *  flash). */
const FRESH_WINDOW_MS = 5_000;

/** Track per-uid lastUpdatedAt across snapshots, glow when it ticks
 *  forward AND the write is fresh.
 *
 *  Returns a Set of uids currently in the glow window. Caller passes
 *  `set.has(entry.uid)` to the LeaderboardRow's `isGlowing` prop.
 *
 *  Edge case (spec): the first snapshot post-mount has no baseline,
 *  so we record every uid's lastUpdatedAt without glowing — otherwise
 *  every row would flash on page open. From snapshot #2 onward, any
 *  new lastUpdatedAt value triggers glow. */
export function useLeaderboardEntryGlow(
  entries: LeaderboardEntry[],
): Set<string> {
  // Last-seen lastUpdatedAt per uid (millis). Ref instead of state so
  // updates inside the effect don't trigger an extra re-render.
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  // Mount-baseline guard — first snapshot only records, never glows.
  const baselineSetRef = useRef(false);
  const [glowing, setGlowing] = useState<Set<string>>(() => new Set());
  // Per-uid clear-timer handles so we can cancel + restart on rapid
  // back-to-back writes from the same walker.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const now = Date.now();
    const lastSeen = lastSeenRef.current;
    const timers = timersRef.current;
    const newlyGlowing: string[] = [];

    for (const e of entries) {
      const tsMs = e.lastUpdatedAt?.toMillis?.();
      if (typeof tsMs !== "number") continue;

      const prev = lastSeen.get(e.uid);
      lastSeen.set(e.uid, tsMs);

      // Mount-baseline pass — record but don't glow.
      if (!baselineSetRef.current) continue;

      // Glow if the timestamp moved forward AND the write is fresh.
      if (prev != null && tsMs > prev && now - tsMs < FRESH_WINDOW_MS) {
        newlyGlowing.push(e.uid);
      }
    }
    baselineSetRef.current = true;

    if (newlyGlowing.length > 0) {
      setGlowing((prev) => {
        const next = new Set(prev);
        for (const uid of newlyGlowing) next.add(uid);
        return next;
      });
      for (const uid of newlyGlowing) {
        const existing = timers.get(uid);
        if (existing) clearTimeout(existing);
        timers.set(
          uid,
          setTimeout(() => {
            setGlowing((prev) => {
              if (!prev.has(uid)) return prev;
              const next = new Set(prev);
              next.delete(uid);
              return next;
            });
            timers.delete(uid);
          }, GLOW_DURATION_MS),
        );
      }
    }
  }, [entries]);

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
