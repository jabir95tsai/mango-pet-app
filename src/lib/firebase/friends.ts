import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, getFirebaseApp } from "./config";
import type { AppUser, Friend, FriendRequest } from "@/lib/types";

const FRIEND_FN_REGION = "asia-east1";

function getFns() {
  return getFunctions(getFirebaseApp(), FRIEND_FN_REGION);
}

export async function searchUsers(qStr: string): Promise<AppUser[]> {
  const term = qStr.trim();
  if (!term) return [];

  const ref = collection(getDb(), "users");

  // Try exact email match first. Firebase Auth normalizes email to
  // lowercase, so we lowercase the input on this comparison only.
  const byEmail = await getDocs(
    query(ref, where("email", "==", term.toLowerCase()), limit(5)),
  );
  if (!byEmail.empty) {
    return byEmail.docs.map((d) => d.data() as AppUser);
  }

  // Otherwise prefix-match displayName (Firestore doesn't have full text)
  const high = term + "";
  const byName = await getDocs(
    query(
      ref,
      where("displayName", ">=", term),
      where("displayName", "<=", high),
      limit(10),
    ),
  );
  return byName.docs.map((d) => d.data() as AppUser);
}

export async function sendFriendRequest(
  fromUser: { uid: string; displayName: string; photoURL: string | null },
  toUid: string,
): Promise<void> {
  if (fromUser.uid === toUid) throw new Error("Cannot friend yourself");
  // Skip if already friends
  const existing = await getDoc(
    doc(getDb(), "users", toUid, "friends", fromUser.uid),
  );
  if (existing.exists()) throw new Error("已是好友");

  await setDoc(
    doc(getDb(), "users", toUid, "friendRequests", fromUser.uid),
    {
      fromUid: fromUser.uid,
      fromName: fromUser.displayName,
      fromPhotoURL: fromUser.photoURL,
      requestedAt: serverTimestamp(),
    },
  );
}

export async function listFriendRequests(uid: string): Promise<FriendRequest[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), "users", uid, "friendRequests"),
      orderBy("requestedAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({
    ...(d.data() as FriendRequest),
    requestId: d.id,
  }));
}

export async function listFriends(uid: string): Promise<Friend[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), "users", uid, "friends"),
      orderBy("addedAt", "desc"),
    ),
  );
  return snap.docs.map((d) => d.data() as Friend);
}

export async function rejectFriendRequest(
  uid: string,
  requestId: string,
): Promise<void> {
  await deleteDoc(doc(getDb(), "users", uid, "friendRequests", requestId));
}

export async function acceptFriendRequest(fromUid: string): Promise<void> {
  const fn = httpsCallable<{ fromUid: string }, { ok: true }>(
    getFns(),
    "acceptFriendRequest",
  );
  await fn({ fromUid });
}

export async function removeFriend(friendUid: string): Promise<void> {
  const fn = httpsCallable<{ friendUid: string }, { ok: true }>(
    getFns(),
    "removeFriend",
  );
  await fn({ friendUid });
}
