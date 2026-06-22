import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";
import {
  arrayUnion,
  doc,
  setDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, getFirebaseApp } from "./config";

const FN_REGION = "asia-east1";

const FCM_SCOPE = "/firebase-cloud-messaging-push-scope";
const FCM_SW_URL = "/firebase-messaging-sw.js";

let cachedMessaging: Messaging | null = null;
let cachedRegistration: ServiceWorkerRegistration | null = null;

async function ensureSwRegistration(): Promise<ServiceWorkerRegistration> {
  if (cachedRegistration) return cachedRegistration;
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported");
  }
  cachedRegistration = await navigator.serviceWorker.register(FCM_SW_URL, {
    scope: FCM_SCOPE,
  });
  // NOTE: don't use `navigator.serviceWorker.ready` here — that waits for a
  // SW matching the *page's* URL scope (e.g. `/app/settings`), but our SW is
  // registered under a sibling scope (`/firebase-cloud-messaging-push-scope`),
  // so the page-scope match never resolves and the whole enablePush() hangs
  // silently. Wait on this registration's own activation instead.
  if (cachedRegistration.active) return cachedRegistration;
  const pending = cachedRegistration.installing ?? cachedRegistration.waiting;
  if (pending) {
    await new Promise<void>((resolve) => {
      const onChange = () => {
        if (pending.state === "activated") {
          pending.removeEventListener("statechange", onChange);
          resolve();
        }
      };
      pending.addEventListener("statechange", onChange);
    });
  }
  return cachedRegistration;
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (cachedMessaging) return cachedMessaging;
  if (!(await isPushSupported())) return null;
  cachedMessaging = getMessaging(getFirebaseApp());
  return cachedMessaging;
}

export async function enablePush(uid: string): Promise<{ token: string } | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY — generate one in Firebase Console → Project Settings → Cloud Messaging → Web push certificates.",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(`Permission ${permission}`);
  }

  const swReg = await ensureSwRegistration();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });
  if (!token) return null;

  // Clear any prior "user turned push off" intent — they just opted back
  // in. fcmTokens are PII → owner-only private subdoc (security-hardening
  // #2); pushPrefs stays on the public doc (read by the Settings probe).
  await Promise.all([
    setDoc(
      doc(getDb(), "users", uid, "private", "contact"),
      { fcmTokens: arrayUnion(token) },
      { merge: true },
    ),
    setDoc(
      doc(getDb(), "users", uid),
      { pushPrefs: { globalDisabled: false } },
      { merge: true },
    ),
  ]);

  return { token };
}

/**
 * Turn push OFF for this account. Clears ALL fcmTokens (not just the
 * current context's — stale tokens from other contexts would otherwise
 * keep receiving push) and records the explicit `globalDisabled` intent
 * so the Settings probe stops re-minting a token via
 * reconcileCurrentToken. The OS notification permission can't be revoked
 * programmatically, so this intent flag is the only thing that makes
 * "off" stick while permission stays "granted".
 */
export async function disablePush(uid: string): Promise<void> {
  // fcmTokens → private subdoc; pushPrefs → public doc (security-hardening #2).
  await Promise.all([
    setDoc(
      doc(getDb(), "users", uid, "private", "contact"),
      { fcmTokens: [] },
      { merge: true },
    ),
    setDoc(
      doc(getDb(), "users", uid),
      { pushPrefs: { globalDisabled: true } },
      { merge: true },
    ),
  ]);
}

/** Reconcile the in-memory FCM token for the **current browser context**
 *  with the persisted set in `user.fcmTokens`.
 *
 *  Context here means "(browser instance, SW registration) tuple": iOS
 *  Safari and the same site added to the home screen as a PWA are
 *  different contexts and produce different FCM tokens, even though
 *  `Notification.permission` is shared. The same is true for Chrome vs
 *  Chrome PWA on desktop.
 *
 *  Backlog `PushToggle probe 把跨 context 的 token 當「已啟用」` —
 *  probe used to declare enabled whenever `Notification.permission ===
 *  "granted"` and any token existed in `user.fcmTokens`; that could be
 *  a sibling context's token, which sends push to that sibling and
 *  silently misses the current one. Calling `getToken` here always
 *  returns *this* context's token (it does NOT prompt the user — if
 *  permission isn't granted it returns null). We arrayUnion to persist;
 *  no-op when the token is already in the set, so cheap to re-run.
 *
 *  Returns the current context's token, or null when the browser can't
 *  produce one (unsupported, permission not granted, VAPID missing,
 *  SW registration failure). Probe code should fall back to "disabled"
 *  on null. */
export async function reconcileCurrentToken(
  uid: string,
): Promise<string | null> {
  if (currentPermission() !== "granted") return null;
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  // Prefer the already-registered SW (typical case after the user
  // enabled push at least once). Fall back to a fresh registration so
  // a brand-new context can still mint a token without the user having
  // to click "啟用" first — getToken needs a registration regardless.
  const swReg =
    (await findExistingFcmSwRegistration()) ?? (await ensureSwRegistration());

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return null;
    // arrayUnion is idempotent at the doc level — already-present
    // tokens make this a no-op write that still updates server time.
    // Acceptable: probe runs once per Settings page open. fcmTokens →
    // owner-only private subdoc (security-hardening #2). setDoc/merge
    // (not updateDoc) so the subdoc is created on first write.
    await setDoc(
      doc(getDb(), "users", uid, "private", "contact"),
      { fcmTokens: arrayUnion(token) },
      { merge: true },
    );
    return token;
  } catch {
    return null;
  }
}

export async function subscribeForegroundMessages(
  cb: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  return onMessage(messaging, cb);
}

/** Re-cache the previously-registered FCM service worker after a page reload.
 *  `enablePush()` writes to `cachedRegistration`, but that cache is in-memory
 *  only — a fresh tab needs to look the registration back up. */
async function findExistingFcmSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (cachedRegistration) return cachedRegistration;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(FCM_SCOPE);
    if (reg) {
      cachedRegistration = reg;
      // Force an update check on app load. Installed PWAs (esp. iOS) keep
      // running a stale FCM SW for a long time, so push-SW fixes (e.g. the
      // duplicate-notification fix) never reach the device. The new SW
      // self.skipWaiting()s, so once this fetch installs it, it activates
      // and replaces the old one. Fire-and-forget — never blocks lookup.
      reg.update().catch(() => {});
    }
    return reg ?? null;
  } catch {
    return null;
  }
}

/** Wire up the foreground push handler. When the page is FOREGROUND, the
 *  Firebase SDK fires `onMessage` in the main thread instead of the SW's
 *  `onBackgroundMessage`, so without this handler foreground pushes (e.g.
 *  clicking the "測試" button while sitting on Settings) get silently
 *  dropped. We show the same OS notification the SW would have shown,
 *  routed through the existing FCM SW registration so click handling
 *  (`notificationclick` in `firebase-messaging-sw.js`) still works.
 *
 *  Safe to call on every render where `user` is set — it no-ops on
 *  unsupported browsers and when the SW isn't yet registered (the user
 *  hasn't enabled push). */
export async function setupPushMessageListener(): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  return onMessage(messaging, async (payload) => {
    const reg = await findExistingFcmSwRegistration();
    if (!reg) return;
    const n = payload.notification;
    const title = n?.title ?? "Mango Pet";
    await reg.showNotification(title, {
      body: n?.body ?? "",
      icon: n?.icon ?? "/web-app-manifest-192x192.png",
      badge: "/favicon-96x96.png",
      data: payload.data ?? {},
    });
  });
}

export type TestPushResult = {
  ok: boolean;
  sent: number;
  failed: number;
  invalidTokens: number;
};

/** Sends a sanity-check push to the current user's own tokens via Cloud Function. */
export async function sendTestPush(): Promise<TestPushResult> {
  const fns = getFunctions(getFirebaseApp(), FN_REGION);
  const fn = httpsCallable<void, TestPushResult>(fns, "sendTestPush");
  const result = await fn();
  return result.data;
}
