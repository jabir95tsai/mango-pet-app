import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { resolveUserDisplayName, resolveUserPhotoURL } from "./auth";
import { getDb, getFirebaseApp } from "./config";
import type {
  AppUser,
  AuthProviderKind,
  LeaderboardVisibility,
  Pet,
} from "@/lib/types";

const FN_REGION = "asia-east1";

function fns() {
  return getFunctions(getFirebaseApp(), FN_REGION);
}

/** Owner-only private contact subdoc — holds PII (email, fcmTokens) kept
 *  OUT of the world-readable public profile doc. Security-hardening #2. */
function privateContactRef(uid: string) {
  return doc(getDb(), "users", uid, "private", "contact");
}

const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

function inferProvider(user: User): AuthProviderKind {
  const id = user.providerData[0]?.providerId ?? "";
  if (id.includes("google")) return "google";
  if (id.includes("apple")) return "apple";
  if (id.includes("facebook")) return "facebook";
  return "google";
}

/** Canonical form of `displayName` for case-insensitive prefix search.
 *  Trim first so trailing whitespace doesn't poison the index. Lowercase
 *  is a no-op on Chinese chars, so "蔡智博Jabir" → "蔡智博jabir" and a
 *  search for "蔡" or "jabir" both prefix-match the same field. */
function toDisplayNameLower(name: string): string {
  return name.trim().toLowerCase();
}

/** Default guest display name. zh-TW / en only (the two supported locales).
 *  Kept minimal — guests have no provider identity. */
function guestDisplayName(locale: "zh-TW" | "en"): string {
  return locale === "en" ? "Guest" : "訪客";
}

export async function upsertUser(user: User, locale: "zh-TW" | "en"): Promise<void> {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  const isGuest = user.isAnonymous;

  // Resolve from providerData when the top-level Auth fields are null
  // (multi-provider accounts, e.g. Google + Apple linked). Without this
  // the profile doc — which the leaderboard / friends / etc. read — gets
  // a null photo and an email-prefix name fallback. Guests have no
  // providerData → fall back to the localised "訪客"/"Guest" label.
  const desiredName = isGuest
    ? guestDisplayName(locale)
    : resolveUserDisplayName(user) ?? user.email?.split("@")[0] ?? "Friend";
  const desiredPhoto = resolveUserPhotoURL(user);

  if (!snap.exists()) {
    // Guest profile: minimal, flagged, and DELIBERATELY no displayNameLower
    // (keeps guests out of friend prefix-search — they can't be friended).
    // PII split (security-hardening #2): email + fcmTokens go to the
    // owner-only users/{uid}/private/contact subdoc, NOT the world-readable
    // public profile doc. The public doc keeps only displayName / photoURL /
    // displayNameLower / authProvider / isGuest (+ prefs the app needs).
    await Promise.all([
      setDoc(ref, {
        uid: user.uid,
        displayName: desiredName,
        ...(isGuest ? {} : { displayNameLower: toDisplayNameLower(desiredName) }),
        photoURL: desiredPhoto,
        authProvider: isGuest ? "anonymous" : inferProvider(user),
        ...(isGuest ? { isGuest: true } : {}),
        locale,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        defaultPostVisibility: "friends",
        allowFriendRequests: true,
      }),
      setDoc(privateContactRef(user.uid), {
        email: user.email ?? null,
        fcmTokens: [],
      }),
    ]);
    return;
  }

  const existing = snap.data() as AppUser;
  const patch: Record<string, unknown> = {};

  // ── Upgrade de-flag (linkWithCredential): same uid, was guest, now has a
  // real provider (isAnonymous === false). Clear the guest flag, fix the
  // authProvider, and backfill the real name/photo + search field so the
  // upgraded account becomes a full citizen (community + leaderboards
  // unlock). Spec guest-login.md §E. Idempotent: only fires while the doc
  // still carries isGuest. The client link flow doesn't need to write the
  // profile itself — this runs on the post-link auth-state callback.
  const upgrading = existing.isGuest === true && !isGuest;
  if (upgrading) {
    patch.isGuest = deleteField();
    patch.authProvider = inferProvider(user);
  }

  if (existing.displayName !== desiredName) {
    patch.displayName = desiredName;
    patch.displayNameLower = toDisplayNameLower(desiredName);
  } else if (existing.displayNameLower === undefined && !isGuest) {
    // Defensive backfill on the login path: existing users who haven't
    // logged in since Phase 1 deploy but before the migration runs would
    // otherwise stay invisible to displayName search. One-shot write at
    // next login fixes them even without the migration ever firing.
    // Skipped for guests — they intentionally have no search field.
    patch.displayNameLower = toDisplayNameLower(existing.displayName);
  }
  if (existing.photoURL !== desiredPhoto) patch.photoURL = desiredPhoto;

  const lastSeenMs = (existing.lastSeenAt as Timestamp | undefined)?.toMillis?.() ?? 0;
  if (Date.now() - lastSeenMs > LAST_SEEN_THROTTLE_MS) {
    patch.lastSeenAt = serverTimestamp();
  }

  // Strip any legacy PII still sitting on the public doc (pre-migration
  // accounts wrote email/fcmTokens here). Mirror email into the private
  // subdoc so it isn't lost. fcmTokens are managed by messaging.ts (private),
  // so we only need to delete the stale public copy here.
  if ("email" in existing || "fcmTokens" in existing) {
    patch.email = deleteField();
    patch.fcmTokens = deleteField();
    await setDoc(
      privateContactRef(user.uid),
      { email: user.email ?? (existing as { email?: string | null }).email ?? null },
      { merge: true },
    );
  }

  if (Object.keys(patch).length > 0) {
    await updateDoc(ref, patch);
  }
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}

/** Toggle one engagement-push type. ON ⇒ ensure the id is NOT in
 *  `pushPrefs.engagementOptOut`; OFF ⇒ ensure it IS. We use
 *  arrayUnion/arrayRemove so concurrent writes (two tabs flipping
 *  different toggles) don't clobber each other. Spec
 *  docs/features/engagement-push-notifications.md Phase 4. */
export async function updateEngagementOptOut(
  uid: string,
  pushType: string,
  optOut: boolean,
): Promise<void> {
  const { arrayRemove, arrayUnion, setDoc } = await import(
    "firebase/firestore"
  );
  const ref = doc(getDb(), "users", uid);
  await setDoc(
    ref,
    {
      pushPrefs: {
        engagementOptOut: optOut ? arrayUnion(pushType) : arrayRemove(pushType),
      },
    },
    { merge: true },
  );
}

/** Walks-auto-photo-share toggle. ON ⇒ start + end prompts fire on
 *  every walk; OFF ⇒ both prompts skipped silently. Absent (= ON by
 *  default) is normalised here so we can always write an explicit
 *  boolean — keeps Settings reads + walks-page reads both honest
 *  about user intent. Spec docs/features/walks-auto-photo-share.md. */
export async function updateWalkAutoPhotoShare(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await setDoc(
    doc(getDb(), "users", uid),
    { walkPrefs: { autoPhotoShare: enabled } },
    { merge: true },
  );
}

/** Dog-leaderboard visibility master switch (leaderboard v2). Writes
 *  `users/{uid}.leaderboardVisibility`. The backend's
 *  `syncDogEntryVisibility` onWrite trigger fans the new value out to
 *  every dog entry's denormalised `ownerVisibility` — the client never
 *  touches dog entries directly. Absent value is treated as `'public'`
 *  everywhere it's read, so writing `'public'` is the explicit opt-in.
 *  Spec docs/features/leaderboard-v2-dog-centric.md ③. */
export async function updateLeaderboardVisibility(
  uid: string,
  value: LeaderboardVisibility,
): Promise<void> {
  await setDoc(
    doc(getDb(), "users", uid),
    { leaderboardVisibility: value },
    { merge: true },
  );
}

// ────────────────────────────────────────────────────────────────────
// Delete account — D1 (full hard delete cascade)
// ────────────────────────────────────────────────────────────────────

export type DeleteAccountImpact = {
  /** Personal-mode pets the user created (familyId === null). */
  personalPets: number;
  /** Family-mode pets the user created. Each of these cascade-deletes
   *  every walk/reminder/expense/healthRecord that any family member
   *  added under it — surface this loud to the user via cascadeWarning. */
  familyPets: number;
  /** Walks the user logged where the parent pet was created by someone
   *  else (so the parent pet itself survives, but the walk is gone). */
  familyWalks: number;
  familyReminders: number;
  familyExpenses: number;
  /** Posts authored by the user (reactions on those posts ride along). */
  posts: number;
};

/** Fetches the current user's "what's about to disappear" counts for the
 *  delete-account confirmation dialog. Each count is a separate Firestore
 *  query — total ~5 reads, runs once when the dialog opens.
 *
 *  Counts shown to the user are approximations of what the
 *  deleteUserAccount callable will actually do. Specifically:
 *  - reactions on others' posts and restaurant reviews aren't queried
 *    here (would require collection-group single-field indexes we don't
 *    keep enabled). They still get cleaned up server-side.
 *  - walks/reminders/expenses owned by the user against their OWN family
 *    pets are counted under "familyPets" (cascade) rather than
 *    "familyWalks/Reminders/Expenses" (which means "owned by user, parent
 *    pet survives"), matching the callable's bookkeeping. */
export async function previewDeleteAccountImpact(
  uid: string,
): Promise<DeleteAccountImpact> {
  const db = getDb();

  const [petsSnap, walksSnap, remindersSnap, expensesSnap, postsSnap] =
    await Promise.all([
      getDocs(query(collection(db, "pets"), where("ownerUid", "==", uid))),
      getDocs(query(collection(db, "walks"), where("walkerUid", "==", uid))),
      getDocs(
        query(collection(db, "reminders"), where("createdByUid", "==", uid)),
      ),
      getDocs(
        query(collection(db, "expenses"), where("payerUid", "==", uid)),
      ),
      getDocs(query(collection(db, "posts"), where("authorUid", "==", uid))),
    ]);

  // Partition pets so the secondary queries can correctly attribute
  // walks/reminders/expenses to either "cascade" (parent is user's pet)
  // or "free-standing" (parent is someone else's pet).
  const myPetIds = new Set<string>(petsSnap.docs.map((d) => d.id));
  let personalPets = 0;
  let familyPets = 0;
  for (const p of petsSnap.docs) {
    const pet = p.data() as Pet;
    if (pet.familyId === null) personalPets++;
    else familyPets++;
  }

  const countFreeStanding = (
    snap: { docs: { data: () => { petId?: string } }[] },
  ) =>
    snap.docs.filter((d) => {
      const pid = d.data().petId;
      return !pid || !myPetIds.has(pid);
    }).length;

  return {
    personalPets,
    familyPets,
    familyWalks: countFreeStanding(walksSnap),
    familyReminders: countFreeStanding(remindersSnap),
    familyExpenses: countFreeStanding(expensesSnap),
    posts: postsSnap.size,
  };
}

export type DeleteAccountSummary = {
  personalPetsHardDeleted: number;
  personalWalksHardDeleted: number;
  personalRemindersHardDeleted: number;
  personalExpensesHardDeleted: number;
  familyPetsHardDeleted: number;
  familyPetSubcollectionsCascaded: number;
  familyWalksHardDeleted: number;
  familyRemindersHardDeleted: number;
  familyRemindersDoneByCleared: number;
  familyExpensesHardDeleted: number;
  postsHardDeleted: number;
  reactionsHardDeleted: number;
  reviewsHardDeleted: number;
  restaurantsSubmittedByCleared: number;
  familiesLeft: number;
  familiesDissolved: number;
  storagePhotosDeleted: number;
};

// ────────────────────────────────────────────────────────────────────
// Data export — read-only snapshot of the same scope as delete-account
// ────────────────────────────────────────────────────────────────────

/** Shape returned by the `exportUserData` callable. Keep flexible — the
 *  callable is the source of truth and the JSON is also surfaced to
 *  end users as a download, so adding new fields is non-breaking. */
export type UserDataExport = {
  meta: {
    exportedAt: string;
    schemaVersion: "v1";
    uid: string;
  };
  user: Record<string, unknown>;
  friends: Record<string, unknown>[];
  friendRequests: {
    received: Record<string, unknown>[];
    sent: Record<string, unknown>[];
  };
  favoriteRestaurants: Record<string, unknown>[];
  knowledgeBookmarks: Record<string, unknown>[];
  pets: Record<string, unknown>[];
  walks: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  postReactionsOnOthers: Record<string, unknown>[];
  restaurantReviews: Record<string, unknown>[];
  families: Record<string, unknown>[];
};

/** Calls the exportUserData callable and returns the full JSON object
 *  for the caller to serialise. Server side only authenticates and
 *  scopes to req.auth.uid — no other parameters. */
export async function exportMyData(): Promise<UserDataExport> {
  const fn = httpsCallable<void, UserDataExport>(fns(), "exportUserData");
  const res = await fn();
  return res.data;
}

/** Calls the deleteUserAccount callable. The server verifies
 *  `confirmDisplayName` matches the user's profile displayName before
 *  it does anything destructive — so the input mismatch case errors
 *  out cleanly before any data is touched. */
export async function deleteAccount(
  confirmDisplayName: string,
): Promise<{ summary: DeleteAccountSummary }> {
  const fn = httpsCallable<
    { confirmDisplayName: string },
    { summary: DeleteAccountSummary }
  >(fns(), "deleteUserAccount");
  const res = await fn({ confirmDisplayName });
  return res.data;
}
