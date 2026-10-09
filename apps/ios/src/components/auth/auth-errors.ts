/**
 * Auth error → user copy. Ports web friendlyError (sign-in-buttons.tsx) and
 * friendlyUpgradeError (guest-upgrade.tsx) to the native error codes.
 *
 * A cancelled provider sheet maps to `null` = show nothing (web shows
 * "cancelled" because a closed popup is ambiguous there; on iOS the user
 * deliberately backed out of a system sheet, so silence is the native norm).
 * Unknown errors fall back to the generic line instead of a raw native
 * message (web shows err.message for non-Firebase errors; the native ones are
 * not user-presentable).
 */
import { isSignInCancelled } from "@/lib/auth";
import { t } from "@/lib/i18n";

function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return code === undefined || code === null ? "" : String(code);
}

/** Sign-in screen copy (Auth.errors.*), or null when the user cancelled. */
export function signInErrorMessage(err: unknown): string | null {
  if (isSignInCancelled(err)) return null;
  switch (errorCode(err)) {
    case "auth/network-request-failed":
      return t("Auth.errors.network");
    case "auth/account-exists-with-different-credential":
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
      return t("Auth.errors.differentCredential");
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return t("Auth.errors.providerDisabled");
    case "auth/internal-error":
    case "auth/invalid-api-key":
    case "auth/app-not-authorized":
      return t("Auth.errors.config");
    default:
      return t("Auth.errors.generic");
  }
}

/** Guest → Google/Apple bind copy (Guest.upgrade.errors.*), or null on cancel. */
export function upgradeErrorMessage(err: unknown): string | null {
  if (isSignInCancelled(err)) return null;
  switch (errorCode(err)) {
    case "auth/network-request-failed":
      return t("Guest.upgrade.errors.network");
    default:
      return t("Guest.upgrade.errors.generic");
  }
}
