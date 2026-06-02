/**
 * Account export + delete (P5) — Cloud Functions callables (region asia-east1),
 * the SAME ones web invokes. previewDeleteAccountImpact + deleteUserAccount land
 * in P5a (functions module already installed P4b); exportUserData is used by the
 * P5b data-export flow (needs expo-file-system to persist the JSON).
 */
import { firebase } from "@react-native-firebase/functions";
import type {
  DeleteAccountImpact,
  DeleteAccountSummary,
  UserDataExport,
} from "@mango/shared-types";

const FN_REGION = "asia-east1";

function call<TOut>(name: string) {
  return (data?: object) =>
    firebase
      .app()
      .functions(FN_REGION)
      .httpsCallable(name)(data ?? {})
      .then((res) => res.data as TOut);
}

/** Count what a delete would remove (preview before confirm). Nice-to-have —
 *  callers may proceed even if this throws. */
export function previewDeleteAccountImpact() {
  return call<DeleteAccountImpact>("previewDeleteAccountImpact")();
}

/** Hard-delete the account. Server re-validates `confirmDisplayName` before
 *  touching data. Caller signs out + returns to login on success. */
export function deleteUserAccount(confirmDisplayName: string) {
  return call<{ summary: DeleteAccountSummary }>("deleteUserAccount")({
    confirmDisplayName,
  });
}

/** Full JSON export of the user's data (P5b consumer writes it to a file). */
export function exportUserData() {
  return call<UserDataExport>("exportUserData")();
}
