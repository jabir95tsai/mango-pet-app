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
