import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "./config";
import type { AppUser, AuthProviderKind } from "@/lib/types";

const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

function inferProvider(user: User): AuthProviderKind {
  const id = user.providerData[0]?.providerId ?? "";
  if (id.includes("google")) return "google";
  if (id.includes("apple")) return "apple";
  if (id.includes("facebook")) return "facebook";
  return "google";
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

  if (existing.displayName !== desiredName) patch.displayName = desiredName;
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
