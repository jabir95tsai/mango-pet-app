/**
 * iOS family READ layer (P4a) — direct Firestore, mirroring the read/switch
 * half of apps/web/src/lib/firebase/families.ts. The MUTATIONS (createFamily /
 * joinFamilyByCode / leaveFamily / removeFamilyMember / regenerateInviteCode)
 * are Cloud Functions callables and live in families-write.ts (P4b, needs the
 * @react-native-firebase/functions native dep). currentFamilyId is a self-write
 * (users/{uid} rules already allow it) so switching family needs no callable.
 */
import firestore from "@react-native-firebase/firestore";
import type { Family, FamilyMember } from "@mango/shared-types";

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await firestore().collection("families").doc(familyId).get();
  if (!snap.exists()) return null;
  return { ...(snap.data() as Family), familyId: snap.id };
}

/** True for the Firestore "you can no longer read this doc" error (e.g. a
 *  stale users/{uid}.familyIds entry after being removed from a family). */
function isPermissionDenied(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "firestore/permission-denied" || code === "permission-denied";
}

/**
 * getFamily that treats an unreadable family (missing doc / permission-denied)
 * as "not a family of mine" (null) but RETHROWS every other failure (offline,
 * unavailable, …) so a transient read error can never masquerade as
 * personal mode.
 */
async function getFamilyIfReadable(familyId: string): Promise<Family | null> {
  try {
    return await getFamily(familyId);
  } catch (err) {
    if (isPermissionDenied(err)) return null;
    throw err;
  }
}

/** All families the user belongs to (users/{uid}.familyIds → fan out). */
export async function listMyFamilies(uid: string): Promise<Family[]> {
  const userSnap = await firestore().collection("users").doc(uid).get();
  if (!userSnap.exists()) return [];
  const ids = (userSnap.data() as { familyIds?: string[] }).familyIds ?? [];
  if (ids.length === 0) return [];
  const families = await Promise.all(ids.map((id) => getFamilyIfReadable(id)));
  return families.filter((f): f is Family => f !== null);
}

export type FamilyScopeSnapshot = {
  /** Every family the user belongs to (switcher list). */
  families: Family[];
  /** The active family, or null = personal mode. */
  family: Family | null;
};

/**
 * Resolve the active scope with ONE users/{uid} read (web family-provider
 * `resolveCurrentFamily` + listMyFamilies + getFamily, minus the duplicate
 * user-doc read):
 *   - no familyIds                      → personal mode (family: null)
 *   - else wanted = currentFamilyId ?? familyIds[0]
 *   - wanted unreadable / missing       → first readable family (so the UI and
 *     every data hook agree on ONE id instead of disagreeing on a stale one)
 *   - no readable family at all         → personal mode
 * Throws on any real read failure (offline etc.) — callers must surface that
 * as an error state, never as personal mode.
 */
export async function loadFamilyScope(uid: string): Promise<FamilyScopeSnapshot> {
  const userSnap = await firestore().collection("users").doc(uid).get();
  const data = (userSnap.data() ?? {}) as {
    familyIds?: string[];
    currentFamilyId?: string | null;
  };
  const ids = data.familyIds ?? [];
  if (ids.length === 0) return { families: [], family: null };
  const wanted = data.currentFamilyId ?? ids[0];
  const fetchIds = ids.includes(wanted) ? ids : [...ids, wanted];
  const fetched = await Promise.all(fetchIds.map((id) => getFamilyIfReadable(id)));
  const byId = new Map<string, Family>();
  fetchIds.forEach((id, i) => {
    const fam = fetched[i];
    if (fam) byId.set(id, fam);
  });
  const families = ids
    .map((id) => byId.get(id))
    .filter((f): f is Family => f !== undefined);
  const family = byId.get(wanted) ?? families[0] ?? null;
  return { families, family };
}

/** Resolve member uids → stripped FamilyMember docs (no email/fcmTokens). */
export async function listFamilyMembers(family: Family): Promise<FamilyMember[]> {
  if (family.memberUids.length === 0) return [];
  const db = firestore();
  const members = await Promise.all(
    family.memberUids.map(async (uid) => {
      try {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists()) return null;
        const d = snap.data() as {
          displayName?: string;
          photoURL?: string | null;
          createdAt?: unknown;
        };
        return {
          uid,
          displayName: d.displayName ?? "Member",
          photoURL: d.photoURL ?? null,
          joinedAt: d.createdAt as FamilyMember["joinedAt"],
        } satisfies FamilyMember;
      } catch {
        return null;
      }
    }),
  );
  return members.filter((m): m is FamilyMember => m !== null);
}

/** Switch the active family (self-write; no callable). Screens must go through
 *  FamilyContext.switchFamily so every mounted data hook follows the switch. */
export async function setCurrentFamily(
  uid: string,
  familyId: string,
): Promise<void> {
  await firestore().collection("users").doc(uid).update({ currentFamilyId: familyId });
}
