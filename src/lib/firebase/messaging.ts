import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";
import {
  arrayRemove,
  arrayUnion,
  doc,
  updateDoc,
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
  await navigator.serviceWorker.ready;
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

  await updateDoc(doc(getDb(), "users", uid), {
    fcmTokens: arrayUnion(token),
  });

  return { token };
}

export async function disablePush(uid: string, token: string): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid), {
    fcmTokens: arrayRemove(token),
  });
}

export async function subscribeForegroundMessages(
  cb: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  return onMessage(messaging, cb);
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
