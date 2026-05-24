import {
  collection,
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
import { getDb, getFirebaseApp } from "./config";
import type { AppUser, AuthProviderKind, Pet } from "@/lib/types";

const FN_REGION = "asia-east1";

function fns() {
  return getFunctions(getFirebaseApp(), FN_REGION);
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

export async function upsertUser(user: User, locale: "zh-TW" | "en"): Promise<void> {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  const desiredName = user.displayName ?? user.email?.split("@")[0] ?? "Friend";
  const desiredPhoto = user.photoURL ?? null;

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: desiredName,
      displayNameLower: toDisplayNameLower(desiredName),
      email: user.email,
      photoURL: desiredPhoto,
      authProvider: inferProvider(user),
      locale,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      defaultPostVisibility: "friends",
      allowFriendRequests: true,
      fcmTokens: [],
    });
    return;
  }

  const existing = snap.data() as AppUser;
  const patch: Record<string, unknown> = {};

  if (existing.displayName !== desiredName) {
    patch.displayName = desiredName;
    patch.displayNameLower = toDisplayNameLower(desiredName);
  } else if (existing.displayNameLower === undefined) {
    // Defensive backfill on the login path: existing users who haven't
    // logged in since Phase 1 deploy but before the migration runs would
    // otherwise stay invisible to displayName search. One-shot write at
    // next login fixes them even without the migration ever firing.
    patch.displayNameLower = toDisplayNameLower(existing.displayName);
  }
  if (existing.photoURL !== desiredPhoto) patch.photoURL = desiredPhoto;

  const lastSeenMs = (existing.lastSeenAt as Timestamp | undefined)?.toMillis?.() ?? 0;
  if (Date.now() - lastSeenMs > LAST_SEEN_THROTTLE_MS) {
    patch.lastSeenAt = serverTimestamp();
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
