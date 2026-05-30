// Proves the cross-platform shared domain types resolve on the iOS side.
// The `Pet` shape is defined ONCE in @mango/shared-types and imported by both
// apps/web and apps/ios. Real Firestore pet queries land in P2 (Pets phase);
// P0 only needs a typed surface to validate the sharing mechanism end to end.
import type { Pet } from "@mango/shared-types";

export type { Pet };

/** P0 placeholder list — replaced by a live Firestore query in P2. */
export const NO_PETS: readonly Pet[] = [];
