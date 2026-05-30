import {
  fetchSignInMethodsForEmail,
  FacebookAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type AuthCredential,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth } from "./config";

export type AuthProviderKind = "google" | "apple" | "facebook";

/**
 * Stored across the redirect/popup flow so we can auto-link when the user
 * comes back via a different provider that owns the same email.
 */
let pendingLink: { credential: AuthCredential; tried: AuthProviderKind } | null = null;

const providerLabel: Record<AuthProviderKind, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

function methodToKind(method: string): AuthProviderKind | null {
  if (method.includes("google")) return "google";
  if (method.includes("apple")) return "apple";
  if (method.includes("facebook")) return "facebook";
  return null;
}

function credentialFromError(
  kind: AuthProviderKind,
  err: FirebaseError,
): AuthCredential | null {
  if (kind === "google") return GoogleAuthProvider.credentialFromError(err);
  if (kind === "facebook") return FacebookAuthProvider.credentialFromError(err);
  return OAuthProvider.credentialFromError(err);
}

function buildProvider(kind: AuthProviderKind) {
  if (kind === "google") return new GoogleAuthProvider();
  if (kind === "facebook") return new FacebookAuthProvider();
  const apple = new OAuthProvider("apple.com");
  apple.addScope("email");
  apple.addScope("name");
  return apple;
}

/** Custom error thrown when this email already belongs to a different provider. */
export class NeedsLinkError extends Error {
  constructor(
    public email: string,
    public existingKind: AuthProviderKind,
    public newKind: AuthProviderKind,
  ) {
    super(
      `Email ${email} already linked to ${providerLabel[existingKind]}. ` +
        `Sign in with ${providerLabel[existingKind]} to link ${providerLabel[newKind]}.`,
    );
    this.name = "NeedsLinkError";
  }
}

export async function signInWithProvider(kind: AuthProviderKind): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = buildProvider(kind);

  try {
    const result = await signInWithPopup(auth, provider);

    // If we previously failed to sign in with a different provider for this
    // email, auto-link that pending credential to the now-authenticated user.
    if (pendingLink) {
      try {
        await linkWithCredential(result.user, pendingLink.credential);
      } catch (linkErr) {
        // "credential-already-in-use" or similar — already linked, fine.
        console.warn("[auth] link skipped:", linkErr);
      } finally {
        pendingLink = null;
      }
    }

    return result.user;
  } catch (err) {
    if (
      err instanceof FirebaseError &&
      err.code === "auth/account-exists-with-different-credential"
    ) {
      const email = (err.customData?.email as string | undefined) ?? "";
      const credential = credentialFromError(kind, err);

      if (email && credential) {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        const existingKind = methods.map(methodToKind).find(Boolean);
        if (existingKind) {
          pendingLink = { credential, tried: kind };
          throw new NeedsLinkError(email, existingKind, kind);
        }
      }
    }
    pendingLink = null;
    throw err;
  }
}

export async function signOutCurrent(): Promise<void> {
  pendingLink = null;
  await signOut(getFirebaseAuth());
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export function clearPendingLink(): void {
  pendingLink = null;
}

export function getPendingLinkInfo(): { tried: AuthProviderKind } | null {
  return pendingLink ? { tried: pendingLink.tried } : null;
}
