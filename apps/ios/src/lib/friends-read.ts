/**
 * Read-only friends helper (P3 feed scope). The full friends UI — list /
 * search / requests / QR — is P6. P3 only needs the set of friend UIDs to
 * scope the feed (listFeedPosts friend-visible posts), so this is a minimal
 * one-shot read of `users/{uid}/friends` doc ids. The doc id IS the friend's
 * uid (web sendFriendRequest writes users/{toUid}/friends/{fromUid}), so we
 * don't even need the doc body. No writes, no new dep.
 */
import firestore from "@react-native-firebase/firestore";

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
