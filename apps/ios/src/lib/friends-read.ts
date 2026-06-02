/**
 * Friends READ layer. `listFriendUids` (P3 feed scope) plus the P6 friends-UI
 * reads — realtime list + requests subscriptions, user search, and the QR
 * add-landing profile lookup. Query shapes mirror apps/web/src/lib/firebase/
 * friends.ts so both platforms hit the same docs + the displayNameLower index.
 */
import firestore from "@react-native-firebase/firestore";
import type {
  Friend,
  FriendRequest,
  PublicUserProfile,
} from "@mango/shared-types";

/** Friend UIDs of the signed-in user (doc ids of users/{uid}/friends). */
export async function listFriendUids(uid: string): Promise<string[]> {
  try {
    const snap = await firestore()
      .collection("users")
      .doc(uid)
      .collection("friends")
      .get();
    return snap.docs.map((d) => d.id);
  } catch {
    return []; // best-effort: feed still shows own + public posts
  }
}

/** Realtime friends list (newest first). Returns the unsubscribe — call it on
 *  unmount. */
export function subscribeFriends(
  uid: string,
  onChange: (friends: Friend[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return firestore()
    .collection("users")
    .doc(uid)
    .collection("friends")
    .orderBy("addedAt", "desc")
    .onSnapshot(
      (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as Friend), uid: d.id }))),
      (e) => onError?.(e),
    );
}

/** Realtime incoming friend requests (newest first). */
export function subscribeFriendRequests(
  uid: string,
  onChange: (requests: FriendRequest[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return firestore()
    .collection("users")
    .doc(uid)
    .collection("friendRequests")
    .orderBy("requestedAt", "desc")
    .onSnapshot(
      (snap) =>
        onChange(
          snap.docs.map((d) => ({ ...(d.data() as FriendRequest), requestId: d.id })),
        ),
      (e) => onError?.(e),
    );
}

/** Search users by exact email OR displayNameLower prefix (mirrors web). */
export async function searchUsers(qStr: string): Promise<PublicUserProfile[]> {
  const term = qStr.trim();
  if (!term) return [];
  const users = firestore().collection("users");
  const qLower = term.toLowerCase();

  const [byEmail, byName] = await Promise.all([
    users.where("email", "==", qLower).limit(5).get(),
    users
      .where("displayNameLower", ">=", qLower)
      .where("displayNameLower", "<=", qLower + "")
      .limit(10)
      .get(),
  ]);

  const merged = new Map<string, PublicUserProfile>();
  for (const d of [...byEmail.docs, ...byName.docs]) {
    const data = d.data() as {
      displayName?: string;
      photoURL?: string | null;
      city?: string;
      isGuest?: boolean;
    };
    merged.set(d.id, {
      uid: d.id,
      displayName: data.displayName ?? "User",
      photoURL: data.photoURL ?? null,
      city: data.city,
      isGuest: data.isGuest,
    });
  }
  return Array.from(merged.values());
}

/** Public profile for the QR add-landing target. */
export async function getUserProfile(
  uid: string,
): Promise<PublicUserProfile | null> {
  const snap = await firestore().collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as {
    displayName?: string;
    photoURL?: string | null;
    city?: string;
    isGuest?: boolean;
  };
  return {
    uid: snap.id,
    displayName: data.displayName ?? "User",
    photoURL: data.photoURL ?? null,
    city: data.city,
    isGuest: data.isGuest,
  };
}
