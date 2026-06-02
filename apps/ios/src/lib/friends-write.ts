/**
 * Friends MUTATIONS (P6). sendFriendRequest + rejectFriendRequest are direct
 * Firestore writes (mirrors web); acceptFriendRequest + removeFriend are Cloud
 * Functions callables (region asia-east1) that build/tear-down the bidirectional
 * friendship server-side. Same backend the web app uses.
 */
import firestore from "@react-native-firebase/firestore";
import { firebase } from "@react-native-firebase/functions";

const FN_REGION = "asia-east1";

function callable<TIn extends object, TOut>(name: string) {
  return (data: TIn) =>
    firebase
      .app()
      .functions(FN_REGION)
      .httpsCallable(name)(data)
      .then((res) => res.data as TOut);
}

const acceptFn = callable<{ fromUid: string }, { ok: true }>("acceptFriendRequest");
const removeFn = callable<{ friendUid: string }, { ok: true }>("removeFriend");

/** Send a friend request → users/{toUid}/friendRequests/{fromUid}. Direct write
 *  (rules gate guests). Throws on self-add or if already friends. */
export async function sendFriendRequest(
  from: { uid: string; displayName: string | null; photoURL: string | null },
  toUid: string,
): Promise<void> {
  if (from.uid === toUid) throw new Error("不能加自己為好友");
  const db = firestore();
  const existing = await db
    .collection("users")
    .doc(toUid)
    .collection("friends")
    .doc(from.uid)
    .get();
  if (existing.exists) throw new Error("已是好友");
  await db
    .collection("users")
    .doc(toUid)
    .collection("friendRequests")
    .doc(from.uid)
    .set({
      fromUid: from.uid,
      fromName: from.displayName ?? "Friend",
      fromPhotoURL: from.photoURL ?? null,
      requestedAt: firestore.FieldValue.serverTimestamp(),
    });
}

/** Reject (delete) an incoming request — direct delete (mirrors web). */
export async function rejectFriendRequest(
  uid: string,
  requestId: string,
): Promise<void> {
  await firestore()
    .collection("users")
    .doc(uid)
    .collection("friendRequests")
    .doc(requestId)
    .delete();
}

/** Accept an incoming request (callable creates the mutual friendship). */
export function acceptFriendRequest(fromUid: string) {
  return acceptFn({ fromUid });
}

/** Remove a friend (callable tears down both sides). */
export function removeFriend(friendUid: string) {
  return removeFn({ friendUid });
}
