import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Firebase Storage created after Oct 2024 uses `.firebasestorage.app`; older
// projects use `.appspot.com`. If the env var is missing we fall back to the
// modern default — never to bare project ID, which yields a 404 bucket.
const storageBucketEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const storageBucket =
  storageBucketEnv && storageBucketEnv.includes(".")
    ? storageBucketEnv
    : projectId
      ? `${projectId}.firebasestorage.app`
      : undefined;

// Firebase Web App ID is "1:{senderId}:web:{hash}". The App Hosting console
// originally had this set to just the sender ID (no ":web:" suffix), which
// made the Installations API reject getToken() with INVALID_ARGUMENT. The
// console env takes precedence over apphosting.yaml at build time, so we
// can't override it via yaml alone — guard here. A correctly-set env var
// (containing ":web:") passes through unchanged; a malformed one falls back
// to the known-good hardcoded value (it's public, baked into every bundle).
const APP_ID_KNOWN_GOOD = "1:722604603606:web:9d4efbb3033bfd9811f177";
const appIdEnv = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const appId =
  appIdEnv && appIdEnv.includes(":web:") ? appIdEnv : APP_ID_KNOWN_GOOD;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    (projectId ? `${projectId}.firebaseapp.com` : undefined),
  projectId,
  storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;
let firestore: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let appCheck: AppCheck | undefined;

// App Check (security-hardening #3): attests every request to Firebase AI
// Logic (Gemini), Firestore, Storage so a stolen API key can't be replayed
// from outside the app to burn Gemini quota. Initialised lazily on the first
// `ensureApp()` (client only). GATED on the reCAPTCHA Enterprise site key env
// var: when it's absent the call is a no-op, so this ships safely BEFORE the
// user creates the key + flips enforcement in the console — no breakage, and
// it auto-activates once NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is set.
function ensureAppCheck(app: FirebaseApp): void {
  if (appCheck) return;
  if (typeof window === "undefined") return; // client-only
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return; // not configured yet → no-op (safe pre-rollout)
  // Optional local-dev debug token: set NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG
  // to "true" (then register the printed token in the console) so localhost
  // works without a real reCAPTCHA challenge.
  if (process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG === "true") {
    (
      globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Never let App Check init break app boot (e.g. duplicate init in HMR).
    appCheck = undefined;
  }
}

function ensureApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  ensureAppCheck(firebaseApp);
  return firebaseApp;
}

export function getFirebaseApp(): FirebaseApp {
  return ensureApp();
}

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) firebaseAuth = getAuth(ensureApp());
  return firebaseAuth;
}

export function getDb(): Firestore {
  if (!firestore) firestore = getFirestore(ensureApp());
  return firestore;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(ensureApp());
  return storage;
}
