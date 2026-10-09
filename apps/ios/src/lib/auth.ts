// Auth flow — Google + Apple Sign-In, both bridged into the SAME Firebase auth
// session via @react-native-firebase/auth credentials. Apple Sign-In is
// mandatory by App Store guideline 4.8 whenever a third-party social login
// (Google) is offered (parity-checklist §A: "parity + native upgrade").
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { auth } from "@/lib/firebase";
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@/lib/config";
import { detachPushToken, resumePushSession, revokePushForUnreadySession } from "@/lib/push";

let configured = false;

/** Call once before any Google sign-in attempt (idempotent). */
export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    // Firebase validates the idToken audience against the Web client id.
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  configured = true;
}

// ── Cancellation (SHELL-5 / SETTINGS-19) ─────────────────────────────
// A user backing out of the Google / Apple sheet is NOT an error. Every
// provider surfaces it differently:
//   - @react-native-google-signin v13 RESOLVES `{ type: "cancelled" }` (older
//     versions threw `statusCodes.SIGN_IN_CANCELLED`, "-5" on iOS =
//     kGIDSignInErrorCodeCanceled);
//   - expo-apple-authentication rejects with code "ERR_REQUEST_CANCELED"
//     (some versions "ERR_CANCELED").
// Both are normalised to SignInCancelledError (code "auth/canceled") so callers
// can stay silent via isSignInCancelled().

/** Thrown when the user dismissed the provider sheet. code = "auth/canceled". */
export class SignInCancelledError extends Error {
  readonly code = "auth/canceled";
  constructor() {
    super("Sign-in cancelled");
    this.name = "SignInCancelledError";
  }
}

const CANCEL_CODES = new Set([
  "auth/canceled",
  "auth/cancelled",
  "ERR_REQUEST_CANCELED",
  "ERR_CANCELED",
  "SIGN_IN_CANCELLED",
  "-5",
  "12501",
]);

/** True when `err` means "the user backed out" (any provider) — show nothing. */
export function isSignInCancelled(err: unknown): boolean {
  if (err instanceof SignInCancelledError) return true;
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (code === undefined || code === null) return false;
  return CANCEL_CODES.has(String(code));
}

/** Google sheet → idToken. Throws SignInCancelledError when dismissed. */
async function getGoogleIdToken(): Promise<string> {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices();
  let response: unknown;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    if (isSignInCancelled(err)) throw new SignInCancelledError();
    throw err;
  }
  // v13: { type: "success", data: User } | { type: "cancelled", data: null }.
  const res = response as
    | { type?: string; data?: { idToken?: string | null } | null }
    | null
    | undefined;
  if (res && typeof res.type === "string" && res.type !== "success") {
    throw new SignInCancelledError();
  }
  let idToken = res?.data?.idToken ?? null;
  // Older SDKs resolve without the token on the response → ask for it.
  if (!idToken) idToken = (await GoogleSignin.getTokens()).idToken ?? null;
  if (!idToken) throw new Error("Google sign-in returned no idToken");
  return idToken;
}

/** Google → Firebase credential sign-in. Resolves to the Firebase uid. */
export async function signInWithGoogle(): Promise<string> {
  const idToken = await getGoogleIdToken();
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const result = await signInCredential(credential);
  return result.user.uid;
}

/** True only on real/simulated iOS 13+ where Apple Sign-In is available. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Apple → Firebase credential sign-in with a hashed nonce (replay defense). */
export async function signInWithApple(): Promise<string> {
  const credential = await buildAppleCredential();
  const result = await signInCredential(credential);
  return result.user.uid;
}

export async function signOut(options: { accountDeleted?: boolean } = {}): Promise<void> {
  const uid = auth().currentUser?.uid;
  if (uid) {
    try { await detachPushToken(uid, options.accountDeleted); }
    catch (error) {
      if (!options.accountDeleted) throw error;
      // The server already removed this account and private tokens. Do not
      // trap the user in a deleted session if native token revocation is offline.
      // Keep the local registration so the next login retries revocation.
      console.warn("[push] Device token revocation will retry on next sign-in after account deletion");
    }
  }
  try {
    await auth().signOut();
  } catch (error) {
    if (uid) resumePushSession(uid);
    throw error;
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google — ignore.
  }
}

// ── Guest login + upgrade (P5) ───────────────────────────────────────
// isGuest = the Firebase user's `isAnonymous`. Upgrading LINKS the social
// credential onto the SAME anonymous uid so pets/walks/etc. are preserved
// (mirrors web upgradeGuestWithProvider). If the social account already exists
// we can't merge — we sign into it instead ("switched"); the orphaned guest
// uid is reaped by the gcAnonymousUsers cron. Google + Apple only (no Facebook).

/** Anonymous sign-in. The auth listener + profile upsert mark the user guest. */
export async function signInAsGuest(): Promise<string> {
  const result = await auth().signInAnonymously();
  return result.user.uid;
}

export type GuestUpgradeResult =
  | { status: "linked"; uid: string }
  | { status: "switched"; uid: string };

async function buildGoogleCredential() {
  const idToken = await getGoogleIdToken();
  return auth.GoogleAuthProvider.credential(idToken);
}

async function buildAppleCredential() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isSignInCancelled(err)) throw new SignInCancelledError();
    throw err;
  }
  const { identityToken } = appleCredential;
  if (!identityToken) throw new Error("Apple sign-in returned no identityToken");
  const fullName = [appleCredential.fullName?.givenName, appleCredential.fullName?.familyName]
    .filter(Boolean).join(" ").trim();
  // Apple supplies this once. Retain it across a failed Firebase/profile write.
  if (fullName) await AsyncStorage.setItem(`apple-name:${appleCredential.user}`, fullName);
  return auth.AppleAuthProvider.credential(identityToken, rawNonce);
}

async function linkOrSwitch(
  credential: FirebaseAuthCredential,
): Promise<GuestUpgradeResult> {
  const current = auth().currentUser;
  if (!current) throw new Error("No current user to upgrade");
  try {
    const res = await current.linkWithCredential(credential);
    return { status: "linked", uid: res.user.uid };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (
      code === "auth/credential-already-in-use" ||
      code === "auth/email-already-in-use"
    ) {
      // Pre-existing account — sign into it (no merge; guest data orphaned).
      await detachPushToken(current.uid);
      try {
        const res = await auth().signInWithCredential(credential);
        return { status: "switched", uid: res.user.uid };
      } catch (error) {
        resumePushSession(current.uid);
        throw error;
      }
    }
    throw e;
  }
}

export function upgradeGuestWithGoogle(): Promise<GuestUpgradeResult> {
  return buildGoogleCredential().then(linkOrSwitch);
}

export function upgradeGuestWithApple(): Promise<GuestUpgradeResult> {
  return buildAppleCredential().then(linkOrSwitch);
}

type FirebaseAuthCredential = ReturnType<typeof auth.GoogleAuthProvider.credential>;

async function signInCredential(credential: FirebaseAuthCredential) {
  const uid = auth().currentUser?.uid;
  if (uid) await detachPushToken(uid);
  try { return await auth().signInWithCredential(credential); }
  catch (error) { if (uid) resumePushSession(uid); throw error; }
}

/** Escape failed bootstrap without assuming that the account was deleted. */
export async function signOutUnreadySession(): Promise<void> {
  const uid = auth().currentUser?.uid;
  if (uid) await revokePushForUnreadySession(uid);
  try { await auth().signOut(); }
  catch (error) { if (uid) resumePushSession(uid); throw error; }
  try { await GoogleSignin.signOut(); }
  catch { /* No Google session is expected for Apple/guest accounts. */ }
}
