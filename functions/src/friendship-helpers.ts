/**
 * Friendship helpers — server-side.
 *
 * The friendship schema is two mirror docs:
 *   `users/{a}/friends/{b}` = { uid: b, displayName, photoURL, addedAt }
 *   `users/{b}/friends/{a}` = { uid: a, displayName, photoURL, addedAt }
 *
 * Bidirectional writes only happen server-side (Admin SDK bypasses
 * the per-user rules) — manual flow goes through `acceptFriendRequest`
 * callable; the auto-friend trigger reuses this helper to do the same
 * transaction without the friendship-request handshake.
 *
 * Spec docs/features/auto-friend-family-members.md. Cannot
 * cross-import from src/ — Functions and Next.js have separate
 * module graphs.
 */

import { Timestamp, type Firestore } from "firebase-admin/firestore";

/** Outcome of a single createMutualFriendship call — used by the
 *  caller to build an audit doc per trigger run. */
export type CreateFriendshipResult = {
  created: boolean;
  /** Why we didn't create:
   *    - 'self' — same uid on both sides; sanity guard
   *    - 'exists' — at least one direction already present (idempotent skip)
   *    - 'missing-profile' — user doc missing for either side; can't
   *      fill displayName/photoURL so we don't write a half-bad friend
   *      doc that would render as "Friend" forever */
  reason?: "self" | "exists" | "missing-profile" | "deleting" | "membership-changed";
};

/** Write the two mirror friend docs for (uidA, uidB) atomically.
 *
 *  Idempotent: probes `users/{a}/friends/{b}` first; if present,
 *  returns `{ created: false, reason: 'exists' }` without writing.
 *  The probe, profiles, live family and deletion fences share a transaction:
 *  a delayed event cannot recreate a deleted account's children, and
 *  concurrent triggers cannot both pass the initial probe.
 *
 *  Profile lookup pulls displayName / photoURL from each user doc so
 *  the friend list renders properly without needing a join — same
 *  denormalization the acceptFriendRequest callable uses. */
export async function createMutualFriendship(
  uidA: string,
  uidB: string,
  db: Firestore,
  familyId: string,
): Promise<CreateFriendshipResult> {
  if (uidA === uidB) return { created: false, reason: "self" };

  // Stable doc references — direction A→B is probed; if it's missing
  // we still write both halves (covers the half-broken state where
  // one direction was deleted manually).
  const aFriendOfB = db.doc(`users/${uidA}/friends/${uidB}`);
  const bFriendOfA = db.doc(`users/${uidB}/friends/${uidA}`);

  return db.runTransaction<CreateFriendshipResult>(async (tx) => {
    const [existing, aSnap, bSnap, aDeletion, bDeletion, family] = await Promise.all([
      tx.get(aFriendOfB), tx.get(db.doc(`users/${uidA}`)), tx.get(db.doc(`users/${uidB}`)),
      tx.get(db.doc(`deletedAccounts/${uidA}`)), tx.get(db.doc(`deletedAccounts/${uidB}`)),
      tx.get(db.doc(`families/${familyId}`)),
    ]);
    if (aDeletion.exists || bDeletion.exists) return { created: false, reason: "deleting" };
    const members = family.data()?.memberUids;
    if (!Array.isArray(members) || !members.includes(uidA) || !members.includes(uidB)) {
      return { created: false, reason: "membership-changed" };
    }
    if (existing.exists) return { created: false, reason: "exists" };
    const a = aSnap.data();
    const b = bSnap.data();
    if (!a || !b) return { created: false, reason: "missing-profile" };

    const now = Timestamp.now();
    tx.set(aFriendOfB, {
      uid: uidB,
      displayName: (b.displayName as string) ?? "Friend",
      photoURL: (b.photoURL as string | null) ?? null,
      addedAt: now,
    });
    tx.set(bFriendOfA, {
      uid: uidA,
      displayName: (a.displayName as string) ?? "Friend",
      photoURL: (a.photoURL as string | null) ?? null,
      addedAt: now,
    });
    return { created: true };
  });
}

/** Deterministic stable id for a (a, b) pair — sorted so the same
 *  pair from either direction produces the same key. Used by audit
 *  docs to dedupe across multiple trigger fires for the same pair
 *  (e.g., same person joins / leaves / rejoins quickly). */
export function pairId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}
