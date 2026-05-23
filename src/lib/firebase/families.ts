import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, getFirebaseApp } from "./config";
import type { AppUser, Family, FamilyMember } from "@/lib/types";

const FN_REGION = "asia-east1";

function fns() {
  return getFunctions(getFirebaseApp(), FN_REGION);
}

// ────────────────────────────────────────────────────────────────────
// Reads
// ────────────────────────────────────────────────────────────────────

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(getDb(), "families", familyId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Family), familyId: snap.id };
}

/** Subscribe-once list of all families a user belongs to. Reads from the
 *  user doc's `familyIds` field, then fans out to each family doc. */
export async function listMyFamilies(uid: string): Promise<Family[]> {
  const userSnap = await getDoc(doc(getDb(), "users", uid));
  if (!userSnap.exists()) return [];
  const data = userSnap.data() as AppUser;
  const ids = data.familyIds ?? [];
  if (ids.length === 0) return [];
  const families = await Promise.all(ids.map((id) => getFamily(id)));
  return families.filter((f): f is Family => f !== null);
}

/** Resolve the member uids in a family to their AppUser docs. Returns
 *  a stripped FamilyMember shape (no email / fcmTokens). */
export async function listFamilyMembers(
  family: Family,
): Promise<FamilyMember[]> {
  if (family.memberUids.length === 0) return [];
  // Firestore `in` supports up to 30 values; we chunk for safety even though
  // realistic family sizes are tiny.
  const chunks: string[][] = [];
  for (let i = 0; i < family.memberUids.length; i += 30) {
    chunks.push(family.memberUids.slice(i, i + 30));
  }
  const usersCol = collection(getDb(), "users");
  // `__name__` queries are awkward via `where("uid", "in", ...)`; we instead
  // fetch each by doc ref. For very small lists this is just as fast.
  const docs = await Promise.all(
    family.memberUids.map((uid) => getDoc(doc(usersCol, uid))),
  );
  const out: FamilyMember[] = [];
  for (const d of docs) {
    if (!d.exists()) continue;
    const u = d.data() as AppUser;
    out.push({
      uid: u.uid,
      displayName: u.displayName,
      photoURL: u.photoURL,
      // joinedAt isn't tracked on the user doc yet — we surface createdAt as
      // a reasonable proxy; future schema can add `joinedFamilyAt` per
      // membership.
      joinedAt: u.createdAt,
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Mutations — all go through callables so server controls invite-code
// uniqueness, membership invariants, and migration of existing data.
// ────────────────────────────────────────────────────────────────────

type CreateFamilyResult = {
  familyId: string;
  inviteCode: string;
};

export async function createFamily(name: string): Promise<CreateFamilyResult> {
  const fn = httpsCallable<{ name: string }, CreateFamilyResult>(
    fns(),
    "createFamily",
  );
  const res = await fn({ name: name.trim() || "我的家庭" });
  return res.data;
}

type JoinFamilyResult = {
  familyId: string;
  alreadyMember: boolean;
};

export async function joinFamilyByCode(
  inviteCode: string,
): Promise<JoinFamilyResult> {
  const fn = httpsCallable<{ inviteCode: string }, JoinFamilyResult>(
    fns(),
    "joinFamilyByCode",
  );
  const res = await fn({ inviteCode: inviteCode.trim() });
  return res.data;
}

export async function leaveFamily(familyId: string): Promise<void> {
  const fn = httpsCallable<{ familyId: string }, { ok: true }>(
    fns(),
    "leaveFamily",
  );
  await fn({ familyId });
}

export async function regenerateInviteCode(
  familyId: string,
): Promise<{ inviteCode: string }> {
  const fn = httpsCallable<{ familyId: string }, { inviteCode: string }>(
    fns(),
    "regenerateInviteCode",
  );
  const res = await fn({ familyId });
  return res.data;
}

export async function removeMember(
  familyId: string,
  memberUid: string,
): Promise<void> {
  const fn = httpsCallable<
    { familyId: string; memberUid: string },
    { ok: true }
  >(fns(), "removeFamilyMember");
  await fn({ familyId, memberUid });
}

export async function setCurrentFamily(
  uid: string,
  familyId: string,
): Promise<void> {
  // Client-direct write — `users/{uid}` rules already allow self-write,
  // and currentFamilyId only affects this user's reads. No server hop.
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(getDb(), "users", uid), { currentFamilyId: familyId });
}

// ────────────────────────────────────────────────────────────────────
// Phase B3: import personal-mode docs into a family
// ────────────────────────────────────────────────────────────────────

export type ImportPersonalType = "pets" | "walks" | "reminders" | "expenses";

export type ImportPersonalCounts = Record<ImportPersonalType, number>;

/** Calls the importPersonalToFamily callable to bulk-move the signed-in
 *  user's personal-mode docs into the target family. Pass `types` to
 *  limit which collections move; omit it to import everything.
 *
 *  Returns the per-collection moved counts. Does NOT detect duplicates —
 *  that's B4's pet-merge wizard, which calls this AFTER its own merge
 *  pass for any matching pets. */
export async function importPersonalToFamily(
  familyId: string,
  types?: ImportPersonalType[],
): Promise<{ counts: ImportPersonalCounts }> {
  const fn = httpsCallable<
    { familyId: string; types?: ImportPersonalType[] },
    { counts: ImportPersonalCounts }
  >(fns(), "importPersonalToFamily");
  const res = await fn({ familyId, types });
  return res.data;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/** Walks the user doc to find the effective family id. Used by code paths
 *  outside the React tree (Cloud Function callers, scripts). UI should use
 *  FamilyProvider context. */
export async function resolveCurrentFamilyId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  const u = snap.data() as AppUser;
  if (u.currentFamilyId) return u.currentFamilyId;
  return u.familyIds?.[0] ?? null;
}

// Re-exports for callers that need the raw types
export type { Family, FamilyMember, Timestamp };
// Quiet unused-import linter while the `where`/`query`/`serverTimestamp`
// imports are kept for future query helpers in this module.
export const __FAMILIES_INTERNAL = { where, query, serverTimestamp };
