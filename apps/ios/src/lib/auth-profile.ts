import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { auth, firestore } from "@/lib/firebase";
import { activeLocale } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Bootstrap before exposing an authenticated session to screens or push. */
export async function ensureUserProfile(user: FirebaseAuthTypes.User): Promise<void> {
  const uid = user.uid;
  const isGuest = user.isAnonymous;
  const assertCurrent = () => {
    if (auth().currentUser?.uid !== uid || auth().currentUser?.isAnonymous !== isGuest) throw new Error("Auth session changed");
  };
  assertCurrent();
  const profile = firestore().collection("users").doc(uid);
  const contact = profile.collection("private").doc("contact");
  const provider = user.providerData.find((item) => item.displayName || item.photoURL);
  const appleId = user.providerData.find((item) => item.providerId === "apple.com")?.uid;
  const appleName = appleId ? await AsyncStorage.getItem(`apple-name:${appleId}`) : null;
  const name = user.displayName?.trim() || provider?.displayName?.trim() || appleName || "";
  const photoURL = user.photoURL || provider?.photoURL || null;
  const desiredName = isGuest ? (activeLocale === "en" ? "Guest" : "訪客") : (name || (activeLocale === "en" ? "Friend" : "朋友"));
  await firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(profile);
    const privateSnapshot = await tx.get(contact);
    assertCurrent();
    const previous = snapshot.data() ?? {};
    const upgrading = previous.isGuest === true && !isGuest;
    const displayName = !snapshot.exists() || !previous.displayName || upgrading
      ? desiredName : previous.displayName;
    const data: Record<string, unknown> = {
      uid,
      displayName,
      isGuest,
      authProvider: isGuest ? "anonymous" : (user.providerData[0]?.providerId?.split(".")[0] ?? "apple"),
      ...(!isGuest ? { displayNameLower: String(displayName).trim().toLowerCase() } : {}),
    };
    if (!snapshot.exists()) {
      Object.assign(data, {
        photoURL, locale: activeLocale,
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastSeenAt: firestore.FieldValue.serverTimestamp(),
        defaultPostVisibility: "friends", allowFriendRequests: true,
      });
    } else if ((!previous.photoURL || upgrading) && photoURL) {
      data.photoURL = photoURL;
    }
    tx.set(profile, data, { merge: true });
    // Never reset tokens when authenticating another device or linking a guest.
    const privatePatch: Record<string, unknown> = {};
    const privateEmail = privateSnapshot.data()?.email;
    const email = [user.email, privateEmail, previous.email]
      .find((value) => typeof value === "string" && value.trim().length > 0);
    if (email) privatePatch.email = email;
    const legacyTokens = Array.isArray(previous.fcmTokens)
      ? previous.fcmTokens.filter((token: unknown) => typeof token === "string" && token.length > 0) : [];
    if (legacyTokens.length) privatePatch.fcmTokens = firestore.FieldValue.arrayUnion(...legacyTokens);
    if (Object.keys(privatePatch).length) tx.set(contact, privatePatch, { merge: true });
    const cleanup: Record<string, unknown> = {};
    for (const field of ["email", "fcmTokens"]) {
      if (field in previous) cleanup[field] = firestore.FieldValue.delete();
    }
    if (Object.keys(cleanup).length) tx.update(profile, cleanup);
  });
  assertCurrent();
  if (appleName && !user.displayName) await user.updateProfile({ displayName: appleName });
  if (appleId && appleName) await AsyncStorage.removeItem(`apple-name:${appleId}`);
}

/** web resolveUserPhotoURL — top-level photo, else the first provider's. */
export function resolveUserPhotoURL(user: FirebaseAuthTypes.User | null | undefined): string | null {
  if (!user) return null;
  if (user.photoURL) return user.photoURL;
  return user.providerData.find((p) => p?.photoURL)?.photoURL ?? null;
}

/** web resolveUserDisplayName — top-level name, else the first provider's. */
export function resolveUserDisplayName(user: FirebaseAuthTypes.User | null | undefined): string | null {
  if (!user) return null;
  if (user.displayName) return user.displayName;
  return user.providerData.find((p) => p?.displayName)?.displayName ?? null;
}
