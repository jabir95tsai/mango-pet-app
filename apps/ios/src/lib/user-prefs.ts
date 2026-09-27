/**
 * User preference reads/writes (P5a) — direct Firestore merge writes on
 * users/{uid}, mirroring apps/web/src/lib/firebase/users.ts. The backend
 * crons/triggers read these before sending APNs; the leaderboard visibility
 * write is fanned to dog entries by the syncDogEntryVisibility trigger (client
 * never touches dog entries). No callables.
 */
import firestore from "@react-native-firebase/firestore";
import type {
  EngagementPushType,
  LeaderboardVisibility,
  PushPrefs,
  WalkPrefs,
} from "@mango/shared-types";

export type UserPrefs = {
  pushPrefs?: PushPrefs;
  walkPrefs?: WalkPrefs;
  leaderboardVisibility?: LeaderboardVisibility;
  isGuest?: boolean;
  displayName?: string;
  blockedUids?: string[];
};

function userRef(uid: string) {
  return firestore().collection("users").doc(uid);
}

export async function getUserPrefs(uid: string): Promise<UserPrefs> {
  const snap = await userRef(uid).get();
  return (snap.data() as UserPrefs | undefined) ?? {};
}

/** Opt in/out of one engagement push type (arrayUnion/arrayRemove). */
export async function setEngagementOptOut(
  uid: string,
  pushType: EngagementPushType,
  optOut: boolean,
): Promise<void> {
  await userRef(uid).set(
    {
      pushPrefs: {
        engagementOptOut: optOut
          ? firestore.FieldValue.arrayUnion(pushType)
          : firestore.FieldValue.arrayRemove(pushType),
      },
    },
    { merge: true },
  );
}

/** Walk auto-photo prompts on/off (default on; only explicit false disables). */
export async function setWalkAutoPhoto(uid: string, enabled: boolean): Promise<void> {
  await userRef(uid).set({ walkPrefs: { autoPhotoShare: enabled } }, { merge: true });
}

/** Leaderboard visibility (public/friends/off). */
export async function setLeaderboardVisibility(
  uid: string,
  value: LeaderboardVisibility,
): Promise<void> {
  await userRef(uid).set({ leaderboardVisibility: value }, { merge: true });
}

// ── UGC moderation: block / unblock (App Store Guideline 1.2) ────────
// Spec docs/features/ugc-moderation.md. Self-managed on `users/{uid}
// .blockedUids` — web parity (apps/web/src/lib/firebase/users.ts).

export async function blockUser(myUid: string, targetUid: string): Promise<void> {
  if (myUid === targetUid) return;
  await userRef(myUid).set(
    { blockedUids: firestore.FieldValue.arrayUnion(targetUid) },
    { merge: true },
  );
}

export async function unblockUser(myUid: string, targetUid: string): Promise<void> {
  await userRef(myUid).set(
    { blockedUids: firestore.FieldValue.arrayRemove(targetUid) },
    { merge: true },
  );
}

/** Cheap single-doc read used by feed/comment loaders to filter content
 *  before render. */
export async function getBlockedUids(uid: string): Promise<string[]> {
  const snap = await userRef(uid).get();
  return (snap.data()?.blockedUids as string[] | undefined) ?? [];
}

export type UserProfileLite = { displayName: string; photoURL: string | null };

/** Resolve a uid's public displayName/photoURL — used by the blocked-users
 *  settings list (Firestore has no reverse "who is this uid" other than a
 *  doc read). */
export async function getUserProfileLite(uid: string): Promise<UserProfileLite | null> {
  const snap = await userRef(uid).get();
  const d = snap.data();
  if (!d) return null;
  return {
    displayName: (d.displayName as string | undefined) ?? uid,
    photoURL: (d.photoURL as string | null | undefined) ?? null,
  };
}
