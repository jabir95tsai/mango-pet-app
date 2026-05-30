import type { Timestamp } from "firebase/firestore";

// ── Shared domain types (P0 seed: web + ios import the same source) ──
// This package is the cross-platform single source of truth for Firestore
// document shapes. P0 extracts only `Pet` (+ its two enums) to prove the
// sharing mechanism end to end; remaining types migrate out of
// apps/web/src/lib/types.ts incrementally in P1+.

export type Species = "dog" | "cat" | "other";
export type Gender = "male" | "female" | "unknown";

export type Pet = {
  petId: string;
  /** Family this pet belongs to. All members of the family can read/write.
   *  `null` means **personal mode** — the pet lives in the creator's
   *  personal namespace; permission gated by `ownerUid == request.auth.uid`
   *  instead of family membership. Created via `createPet(null, uid, …)`. */
  familyId: string | null;
  /** The user who originally created the pet. In family mode this is for
   *  attribution; in personal mode (`familyId === null`) it is **the
   *  permission boundary** — only this user can read/write. */
  ownerUid: string;
  name: string;
  species: Species;
  breed?: string;
  birthday?: Timestamp;
  gender?: Gender;
  weightKg?: number;
  photoURL?: string;
  bio?: string;
  createdAt: Timestamp;
  /** Per-pet daily walk-minute goal. Drives the walks-page dial, week-
   *  strip done flags, A1 evening reminder threshold, and B2 family-
   *  milestone threshold (all of which historically hardcoded 30).
   *
   *  Absent on legacy pets — every read site MUST go through
   *  `getPetWalkGoalMinutes()` in `@/lib/walk-goals` which falls back
   *  to `DEFAULT_WALK_GOAL_MINUTES` (30). Don't read `pet.walkGoal.minutes`
   *  directly without the fallback or legacy pets will throw nil-ptr.
   *
   *  `source: 'computed'` namespace is reserved for a future spec that
   *  derives a recommendation from breed/age/weight; this round only
   *  ever writes `'manual'`. */
  walkGoal?: { minutes: number; source: "manual" | "computed" };
};
