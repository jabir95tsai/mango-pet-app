import {
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./config";

export type AuthProviderKind = "google" | "apple" | "facebook";

export async function signInWithProvider(kind: AuthProviderKind): Promise<User> {
  const auth = getFirebaseAuth();
  const provider =
    kind === "google"
      ? new GoogleAuthProvider()
      : kind === "apple"
        ? new OAuthProvider("apple.com")
        : new FacebookAuthProvider();

  if (kind === "apple") {
    (provider as OAuthProvider).addScope("email");
    (provider as OAuthProvider).addScope("name");
  }

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutCurrent(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}
