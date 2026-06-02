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
  if (!snap.exists) return null;
  return { ...(snap.data() as Family), familyId: snap.id };
}

/** All families the user belongs to (users/{uid}.familyIds → fan out). */
export async function listMyFamilies(uid: string): Promise<Family[]> {
  const userSnap = await firestore().collection("users").doc(uid).get();
  if (!userSnap.exists) return [];
  const ids = (userSnap.data() as { familyIds?: string[] }).familyIds ?? [];
  if (ids.length === 0) return [];
  const families = await Promise.all(ids.map((id) => getFamily(id)));
  return families.filter((f): f is Family => f !== null);
}

/** Resolve member uids → stripped FamilyMember docs (no email/fcmTokens). */
export async function listFamilyMembers(family: Family): Promise<FamilyMember[]> {
  if (family.memberUids.length === 0) return [];
  const db = firestore();
  const members = await Promise.all(
    family.memberUids.map(async (uid) => {
      try {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) return null;
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

/** Switch the active family (self-write; no callable). */
export async function setCurrentFamily(
  uid: string,
  familyId: string,
): Promise<void> {
  await firestore().collection("users").doc(uid).update({ currentFamilyId: familyId });
}
