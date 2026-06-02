// Auth flow — Google + Apple Sign-In, both bridged into the SAME Firebase auth
// session via @react-native-firebase/auth credentials. Apple Sign-In is
// mandatory by App Store guideline 4.8 whenever a third-party social login
// (Google) is offered (parity-checklist §A: "parity + native upgrade").
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { auth } from "@/lib/firebase";
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@/lib/config";

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

/** Google → Firebase credential sign-in. Resolves to the Firebase uid. */
export async function signInWithGoogle(): Promise<string> {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices();
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();
  if (!idToken) throw new Error("Google sign-in returned no idToken");
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const result = await auth().signInWithCredential(credential);
  return result.user.uid;
}

/** True only on real/simulated iOS 13+ where Apple Sign-In is available. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Apple → Firebase credential sign-in with a hashed nonce (replay defense). */
export async function signInWithApple(): Promise<string> {
  // Firebase requires the SHA-256 hash of the nonce in the Apple request and
  // the raw nonce in the credential it builds.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const { identityToken } = appleCredential;
  if (!identityToken) throw new Error("Apple sign-in returned no identityToken");

  const credential = auth.AppleAuthProvider.credential(identityToken, rawNonce);
  const result = await auth().signInWithCredential(credential);
  return result.user.uid;
}

export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google — ignore.
  }
  await auth().signOut();
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
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices();
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();
  if (!idToken) throw new Error("Google sign-in returned no idToken");
  return auth.GoogleAuthProvider.credential(idToken);
}

async function buildAppleCredential() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  const { identityToken } = appleCredential;
  if (!identityToken) throw new Error("Apple sign-in returned no identityToken");
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
      const res = await auth().signInWithCredential(credential);
      return { status: "switched", uid: res.user.uid };
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
