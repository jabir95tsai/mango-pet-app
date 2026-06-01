import {
  fetchSignInMethodsForEmail,
  FacebookAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  updateProfile,
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

/**
 * Guest (anonymous) sign-in. Creates a throwaway anonymous Firebase user so
 * a visitor can try personal features (pets / walks) without registering.
 * The auth-state callback then upserts a minimal guest `users/{uid}` doc
 * (displayName "訪客"/"Guest", isGuest:true) — see users.ts `upsertUser`.
 * Spec docs/features/guest-login.md §A.
 */
export async function signInAsGuest(): Promise<User> {
  const result = await signInAnonymously(getFirebaseAuth());
  return result.user;
}

/**
 * Outcome of a guest → real-account upgrade.
 *  - `linked`:   the provider was linked to the SAME anonymous uid, so all
 *                guest data (pets/walks) is preserved. `upsertUser` clears
 *                the `isGuest` flag on the next auth-state callback and
 *                community unlocks.
 *  - `switched`: the chosen Google/Apple account already exists, so we
 *                could NOT fold the guest into it. v1 signs INTO the
 *                existing account instead; the guest's anonymous data stays
 *                orphaned under the old uid (the gcAnonymousUsers job reaps
 *                it). NO merge. Spec §E / open question #3.
 */
export type GuestUpgradeResult =
  | { status: "linked"; user: User }
  | { status: "switched"; user: User; kind: AuthProviderKind };

/**
 * Upgrade the current anonymous guest by binding a real OAuth provider.
 * Uses `linkWithPopup` (NOT `signInWithProvider`) so the uid is unchanged
 * and the guest's existing pets/walks carry over. On the hard-boundary
 * conflict (`credential-already-in-use` / `email-already-in-use`) falls
 * back to signing into the pre-existing account (status "switched").
 * Spec docs/features/guest-login.md §E.
 */
export async function upgradeGuestWithProvider(
  kind: AuthProviderKind,
): Promise<GuestUpgradeResult> {
  const auth = getFirebaseAuth();
  const current = auth.currentUser;
  if (!current) throw new Error("No current user to upgrade");
  // Defensive: a real (non-anonymous) user has nothing to upgrade.
  if (!current.isAnonymous) return { status: "linked", user: current };

  const provider = buildProvider(kind);
  try {
    const result = await linkWithPopup(current, provider);
    pendingLink = null;
    return { status: "linked", user: result.user };
  } catch (err) {
    if (
      err instanceof FirebaseError &&
      (err.code === "auth/credential-already-in-use" ||
        err.code === "auth/email-already-in-use")
    ) {
      // This Google/Apple account already exists → can't link into the
      // guest. v1: sign into the existing account; guest data is abandoned
      // under the old anonymous uid (GC cleans). No merge.
      const credential = credentialFromError(kind, err);
      const result = credential
        ? await signInWithCredential(auth, credential)
        : await signInWithPopup(auth, provider);
      pendingLink = null;
      return { status: "switched", user: result.user, kind };
    }
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

/**
 * Firebase fills the top-level `user.photoURL` / `user.displayName` from
 * the account's providers, but for multi-provider accounts (e.g. Google +
 * Apple linked via `linkWithCredential` above) those top-level fields can
 * end up null — Apple returns no photoURL and only a one-shot name — even
 * though a provider entry still carries the real values. Resolve the best
 * available value: top-level first, then the first provider that has one.
 *
 * Use this anywhere we render the *current* user's own avatar / name from
 * the live Auth object (the denormalised copies stored in Firestore docs
 * are unaffected, so other people's avatars don't need this).
 */
export function resolveUserPhotoURL(user: User | null | undefined): string | null {
  if (!user) return null;
  if (user.photoURL) return user.photoURL;
  for (const p of user.providerData) {
    if (p?.photoURL) return p.photoURL;
  }
  return null;
}

export function resolveUserDisplayName(
  user: User | null | undefined,
): string | null {
  if (!user) return null;
  if (user.displayName) return user.displayName;
  for (const p of user.providerData) {
    if (p?.displayName) return p.displayName;
  }
  return null;
}

/**
 * Root-cause fix for the multi-provider null-identity bug: when the
 * top-level `displayName` / `photoURL` are null but a provider entry
 * carries them, write the resolved values back onto the Auth user via
 * `updateProfile`. Run once at login (before `upsertUser`) so that:
 *   - `upsertUser` then denormalises the *real* name/photo into
 *     `users/{uid}` (the doc the leaderboard, friends, etc. read), and
 *   - every action-time denormalised write (post author, walk walker,
 *     expense payer …) that reads top-level `user.photoURL` is correct.
 * Idempotent: the guard makes it a no-op once the top-level is populated,
 * and it never overwrites an existing non-null top-level value.
 */
export async function syncAuthProfileFromProviders(user: User): Promise<void> {
  const patch: { displayName?: string; photoURL?: string } = {};
  if (!user.displayName) {
    const name = resolveUserDisplayName(user);
    if (name) patch.displayName = name;
  }
  if (!user.photoURL) {
    const photo = resolveUserPhotoURL(user);
    if (photo) patch.photoURL = photo;
  }
  if (Object.keys(patch).length === 0) return;
  await updateProfile(user, patch);
}
