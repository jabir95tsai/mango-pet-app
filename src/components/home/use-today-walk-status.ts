"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { listPersonalWalks, listWalks } from "@/lib/firebase/walks";
import { getPetWalkGoalMinutes } from "@/lib/walk-goals";
import type { Pet, Walk } from "@/lib/types";

/**
 * Walk status for the home stories ring:
 *   - 'done'    → today's total minutes for this pet ≥ goal
 *   - 'pending' → has a walk goal but today's total < goal (or no walks)
 *   - 'tracking'→ reserved for future active-session signaling. Not yet
 *                 wired (no broadcast channel exists); the ring colour
 *                 swap is in place so we can flip it on later without
 *                 touching consumers.
 */
export type WalkStatus = "done" | "pending" | "tracking";

function startOfTodayLocal(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Compute today's walk status per pet for the StoriesBar ring colours.
 * Pulls today's walks once (family or personal mode) and aggregates
 * minutes by petId. Light-weight — caller passes the pets list so we
 * don't re-fetch them here.
 */
export function useTodayWalkStatus(pets: Pet[]): {
  status: Map<string, WalkStatus>;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 50 walks is plenty for "today" filtering on any family — the
      // listWalks helper orders by startedAt desc so today's walks
      // sit at the top.
      const list = family
        ? await listWalks(family.familyId, 50)
        : await listPersonalWalks(user.uid, 50);
      setWalks(list);
    } catch {
      setWalks([]);
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  const status = useMemo(() => {
    const cutoff = startOfTodayLocal();
    const minsByPet = new Map<string, number>();
    for (const w of walks) {
      const t = w.startedAt?.toMillis?.() ?? 0;
      if (t < cutoff) continue; // walks listed desc; once we drop below we could break, but the loop is short
      minsByPet.set(
        w.petId,
        (minsByPet.get(w.petId) ?? 0) + (w.durationMin ?? 0),
      );
    }
    const map = new Map<string, WalkStatus>();
    for (const p of pets) {
      const goal = getPetWalkGoalMinutes(p);
      const done = (minsByPet.get(p.petId) ?? 0) >= goal;
      map.set(p.petId, done ? "done" : "pending");
    }
    return map;
  }, [walks, pets]);

  return { status, loading, refresh };
}
