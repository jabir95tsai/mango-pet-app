// Story-ring walk status — pure logic shared by web + iOS home StoriesBar
// (and reusable by leaderboard). Extracted from the web hook
// apps/web/src/components/home/use-today-walk-status.ts useMemo so both
// platforms classify rings identically. No React, no platform APIs — the
// caller (web hook / iOS hook) owns fetching the walks + pets list.
import type { Pet, Walk } from "@mango/shared-types";
import { getPetWalkGoalMinutes } from "./walk-goals";

/**
 * Walk status for the home stories ring:
 *   - 'done'     → today's total minutes for this pet ≥ goal
 *   - 'pending'  → has a walk goal but today's total < goal (or no walks)
 *   - 'tracking' → reserved for an active session in progress. Callers pass
 *                  `trackingPetIds` to flip a pet's ring while a live walk
 *                  is recording; not yet wired on either platform.
 */
export type WalkStatus = "done" | "pending" | "tracking";

function startOfTodayLocalMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Compute today's walk status per pet for the StoriesBar rings.
 * Aggregates today's walk minutes by petId (walks listed desc by startedAt;
 * we skip any before local midnight), then compares each pet's total to its
 * goal. `trackingPetIds` (optional) forces 'tracking' for pets with a live
 * session regardless of accumulated minutes.
 */
export function computeTodayWalkStatus(
  pets: Pet[],
  walks: Walk[],
  trackingPetIds?: ReadonlySet<string>,
): Map<string, WalkStatus> {
  const cutoff = startOfTodayLocalMs();
  const minsByPet = new Map<string, number>();
  for (const w of walks) {
    const t = w.startedAt?.toMillis?.() ?? 0;
    if (t < cutoff) continue;
    minsByPet.set(w.petId, (minsByPet.get(w.petId) ?? 0) + (w.durationMin ?? 0));
  }
  const map = new Map<string, WalkStatus>();
  for (const p of pets) {
    if (trackingPetIds?.has(p.petId)) {
      map.set(p.petId, "tracking");
      continue;
    }
    const goal = getPetWalkGoalMinutes(p);
    map.set(p.petId, (minsByPet.get(p.petId) ?? 0) >= goal ? "done" : "pending");
  }
  return map;
}
