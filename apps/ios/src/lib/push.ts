/** Native push identity is stored only in the owner-only private/contact doc. */
import messaging from "@react-native-firebase/messaging";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { auth } from "@/lib/firebase";

export type PushStatus = "enabled" | "disabled" | "notDetermined" | "denied" | "checking" | "error";
type Registration = { uid: string; token: string; previousToken?: string };
const REGISTRATION_KEY = "mango.push.registration.v1";
let pending: Promise<unknown> = Promise.resolve();
let suspendedUid: string | null = null;
const listeners = new Set<(uid: string, status: PushStatus) => void>();
function publish(uid: string, status: PushStatus) {
  for (const listener of listeners) listener(uid, status);
  return status;
}
function serialized<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(action);
  pending = result.catch(() => undefined);
  return result;
}
function assertCurrent(uid: string, allowSuspended = false) {
  if (auth().currentUser?.uid !== uid || (!allowSuspended && suspendedUid === uid)) {
    throw new Error("Push session changed");
  }
}
function userRef(uid: string) { return firestore().collection("users").doc(uid); }
function contactRef(uid: string) { return userRef(uid).collection("private").doc("contact"); }
async function storedRegistration(): Promise<Registration | null> {
  const raw = await AsyncStorage.getItem(REGISTRATION_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw) as Registration;
  if (typeof data.uid !== "string" || typeof data.token !== "string") throw new Error("Invalid push registration");
  return data;
}
function permissionState(value: number): PushStatus {
  if (value === messaging.AuthorizationStatus.NOT_DETERMINED) return "notDetermined";
  if (value === messaging.AuthorizationStatus.AUTHORIZED || value === messaging.AuthorizationStatus.PROVISIONAL) return "enabled";
  return "denied";
}
export async function hasPushPermission(): Promise<boolean> {
  return permissionState(await messaging().hasPermission()) === "enabled";
}
async function register(uid: string, enable = false): Promise<PushStatus> {
  assertCurrent(uid);
  const profile = await userRef(uid).get();
  assertCurrent(uid);
  if (!profile.exists) throw new Error("Profile is not ready");
  if (!enable && profile.data()?.pushPrefs?.globalDisabled) return publish(uid, "disabled");
  let previous = await storedRegistration();
  if (previous && previous.uid !== uid) {
    // An external auth change cannot edit the former owner's private document.
    // Revoke that installation token before assigning a fresh token to this UID.
    await messaging().deleteToken();
    await AsyncStorage.removeItem(REGISTRATION_KEY);
    previous = null;
  }
  assertCurrent(uid);
  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  if (!token) throw new Error("FCM returned no token");
  assertCurrent(uid);
  // Persist before the write, so a failed/ambiguous acknowledgement is still
  // removable on logout or retry after a process restart.
  const previousToken = previous?.previousToken ?? previous?.token;
  await AsyncStorage.setItem(REGISTRATION_KEY, JSON.stringify({ uid, token, ...(previousToken && previousToken !== token ? { previousToken } : {}) }));
  assertCurrent(uid);
  const registered = await firestore().runTransaction(async (tx) => {
    const currentProfile = await tx.get(userRef(uid));
    const snapshot = await tx.get(contactRef(uid));
    assertCurrent(uid);
    if (!currentProfile.exists) throw new Error("Profile is not ready");
    // Another device may have switched the global preference off since getToken.
    if (!enable && currentProfile.data()?.pushPrefs?.globalDisabled) return false;
    const tokens: string[] = (snapshot.data()?.fcmTokens ?? []).filter((item: unknown) => typeof item === "string");
    const current = tokens.filter((item) => !previous || previous.uid !== uid || (item !== previous.token && item !== previous.previousToken));
    tx.set(contactRef(uid), { fcmTokens: [...new Set([...current, token])] }, { merge: true });
    if (enable) tx.update(userRef(uid), { "pushPrefs.globalDisabled": false });
    return true;
  });
  await AsyncStorage.setItem(REGISTRATION_KEY, JSON.stringify({ uid, token }));
  assertCurrent(uid);
  return publish(uid, registered ? "enabled" : "disabled");
}
function operation(uid: string, action: () => Promise<PushStatus>): Promise<PushStatus> {
  return serialized(action).catch((error) => {
    if (auth().currentUser?.uid === uid && suspendedUid !== uid) publish(uid, "error");
    throw error;
  });
}
export function probePushStatus(uid: string): Promise<PushStatus> {
  return operation(uid, async () => {
    assertCurrent(uid);
    const permission = permissionState(await messaging().hasPermission());
    assertCurrent(uid);
    if (permission !== "enabled") return publish(uid, permission);
    return register(uid);
  });
}
export function enablePush(uid: string): Promise<PushStatus> {
  return operation(uid, async () => {
    assertCurrent(uid);
    const permission = permissionState(await messaging().requestPermission());
    assertCurrent(uid);
    if (permission !== "enabled") return publish(uid, permission);
    return register(uid, true);
  });
}
export async function reconcilePushToken(uid: string): Promise<void> { await probePushStatus(uid); }
export function disablePush(uid: string): Promise<PushStatus> {
  return operation(uid, async () => {
    assertCurrent(uid);
    const batch = firestore().batch();
    batch.update(userRef(uid), { "pushPrefs.globalDisabled": true });
    // This is the existing account-wide off preference, unlike logout.
    batch.set(contactRef(uid), { fcmTokens: [] }, { merge: true });
    await batch.commit();
    assertCurrent(uid);
    return publish(uid, "disabled");
  });
}
/** Stop refresh registration synchronously, then remove only this installation. */
export async function detachPushToken(uid: string, accountDeleted = false): Promise<void> {
  suspendedUid = uid;
  try {
    await serialized(async () => {
      assertCurrent(uid, true);
      const previous = await storedRegistration();
      let token = previous?.uid === uid ? previous.token : null;
      // Covers installations registered by an older build before local tracking.
      if (!token && !accountDeleted && await hasPushPermission()) {
        await messaging().registerDeviceForRemoteMessages();
        token = await messaging().getToken();
      }
      assertCurrent(uid, true);
      if (token && !accountDeleted) {
        await contactRef(uid).set({ fcmTokens: firestore.FieldValue.arrayRemove(token, ...(previous?.previousToken ? [previous.previousToken] : [])) }, { merge: true });
      }
      // Revocation also makes a leftover token under a previous UID unusable.
      if (token || previous) await messaging().deleteToken();
      await AsyncStorage.removeItem(REGISTRATION_KEY);
    });
  } catch (error) {
    suspendedUid = null;
    publish(uid, "error");
    throw error;
  }
}
export function resumePushSession(uid: string): void {
  if (suspendedUid === uid) suspendedUid = null;
}
/** AuthProvider owns this listener, including while Settings is not mounted. */
export function startPushSession(uid: string, onStatus: (status: PushStatus) => void): () => void {
  resumePushSession(uid);
  let active = true;
  const listener = (owner: string, status: PushStatus) => { if (active && owner === uid) onStatus(status); };
  listeners.add(listener);
  const reconcile = () => {
    if (!active) return;
    // operation() publishes an explicit error state; foreground/retry retries it.
    void probePushStatus(uid).catch(() => undefined);
  };
  const unsubscribe = messaging().onTokenRefresh(reconcile);
  const appState = AppState.addEventListener("change", (state) => { if (state === "active") reconcile(); });
  reconcile();
  return () => { active = false; listeners.delete(listener); unsubscribe(); appState.remove(); };
}
