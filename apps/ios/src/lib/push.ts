/**
 * iOS push registration (P5a) — native APNs via @react-native-firebase/messaging
 * (the iOS upgrade over web's残缺 PWA web-push). Mirrors the token lifecycle of
 * apps/web/src/lib/firebase/messaging.ts: get a token, arrayUnion it into
 * users/{uid}.fcmTokens, and respect pushPrefs.globalDisabled so a disabled user
 * doesn't get re-minted on every settings open.
 *
 * ⚠️ ENABLING PUSH (DevOps, NOT code) — three steps, none doable from a
 * non-interactive build, so the aps-environment entitlement was REMOVED from
 * app.json to keep EAS builds green. This code stays dormant until:
 *   1. Apple Developer: enable the Push Notifications capability on App ID
 *      com.mangopet.app, then regenerate the provisioning profile. The easiest
 *      path is `eas credentials` (or an interactive `eas build`) while signed
 *      into Apple — EAS adds the capability + new profile automatically.
 *   2. app.json: re-add  ios.entitlements = { "aps-environment": "development" }
 *      (use "production" for TestFlight/App Store) + UIBackgroundModes
 *      "remote-notification".
 *   3. Firebase Console → Cloud Messaging: register the APNs auth key/cert for
 *      the iOS app.
 * Until all three are done getToken() throws on device (probe → "denied"), which
 * the settings toggle handles gracefully.
 */
import messaging from "@react-native-firebase/messaging";
import firestore from "@react-native-firebase/firestore";

export type PushStatus = "enabled" | "disabled" | "denied" | "checking";

function userRef(uid: string) {
  return firestore().collection("users").doc(uid);
}

/** OS-level permission granted (AUTHORIZED or PROVISIONAL)? */
export async function hasPushPermission(): Promise<boolean> {
  const status = await messaging().hasPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/** Probe the current state for the settings toggle, without minting a token
 *  if the user has explicitly disabled push. */
export async function probePushStatus(uid: string): Promise<PushStatus> {
  if (!(await hasPushPermission())) return "denied";
  const snap = await userRef(uid).get();
  const disabled = (snap.data() as { pushPrefs?: { globalDisabled?: boolean } } | undefined)
    ?.pushPrefs?.globalDisabled;
  if (disabled) return "disabled";
  // Permission granted + not disabled → reconcile the token so this device is
  // registered (idempotent arrayUnion).
  await reconcilePushToken(uid);
  return "enabled";
}

/** Request permission (if needed), mint the APNs/FCM token, and register it.
 *  Returns the new status. */
export async function enablePush(uid: string): Promise<PushStatus> {
  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) return "denied";
  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  await userRef(uid).set(
    {
      fcmTokens: firestore.FieldValue.arrayUnion(token),
      pushPrefs: { globalDisabled: false },
    },
    { merge: true },
  );
  return "enabled";
}

/** Idempotently add this device's token to the user's fcmTokens (no permission
 *  prompt). No-op if permission isn't granted. */
export async function reconcilePushToken(uid: string): Promise<void> {
  if (!(await hasPushPermission())) return;
  try {
    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    await userRef(uid).set(
      { fcmTokens: firestore.FieldValue.arrayUnion(token) },
      { merge: true },
    );
  } catch {
    // best-effort
  }
}

/** Turn push off: clear tokens + set the explicit disable flag so the probe
 *  won't re-mint while the OS permission stays granted (mirrors web disablePush). */
export async function disablePush(uid: string): Promise<void> {
  await userRef(uid).set(
    { fcmTokens: [], pushPrefs: { globalDisabled: true } },
    { merge: true },
  );
}
