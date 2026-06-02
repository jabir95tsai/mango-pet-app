/**
 * iOS family MUTATIONS (P4b) — Cloud Functions callables, mirroring the
 * mutation half of apps/web/src/lib/firebase/families.ts. These are the SAME
 * callables the web app invokes (region asia-east1), so behaviour + validation
 * + the auto-friend trigger all stay server-authoritative. Needs the
 * @react-native-firebase/functions native module (P4b gate). Reads + switch are
 * in families-read.ts.
 */
import { firebase } from "@react-native-firebase/functions";

const FN_REGION = "asia-east1";

function callable<TIn extends object, TOut>(name: string) {
  return (data: TIn) =>
    firebase
      .app()
      .functions(FN_REGION)
      .httpsCallable(name)(data)
      .then((res) => res.data as TOut);
}

const createFamilyFn = callable<{ name: string }, { familyId: string; inviteCode: string }>(
  "createFamily",
);
const joinFamilyByCodeFn = callable<
  { inviteCode: string },
  { familyId: string; alreadyMember: boolean }
>("joinFamilyByCode");
const leaveFamilyFn = callable<{ familyId: string }, { ok: true }>("leaveFamily");
const regenerateInviteCodeFn = callable<{ familyId: string }, { inviteCode: string }>(
  "regenerateInviteCode",
);
const removeFamilyMemberFn = callable<
  { familyId: string; memberUid: string },
  { ok: true }
>("removeFamilyMember");

/** Create a family. Empty name → server defaults to「我的家庭」. */
export function createFamily(name: string) {
  return createFamilyFn({ name: name.trim() });
}

/** Join by 6-digit code. `alreadyMember` true when already in that family. */
export function joinFamilyByCode(inviteCode: string) {
  return joinFamilyByCodeFn({ inviteCode: inviteCode.trim() });
}

export function leaveFamily(familyId: string) {
  return leaveFamilyFn({ familyId });
}

/** Owner-only (server-enforced). Returns the new invite code. */
export function regenerateInviteCode(familyId: string) {
  return regenerateInviteCodeFn({ familyId });
}

/** Owner-only (server-enforced). */
export function removeFamilyMember(familyId: string, memberUid: string) {
  return removeFamilyMemberFn({ familyId, memberUid });
}
