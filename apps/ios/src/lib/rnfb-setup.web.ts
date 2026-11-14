// WEB PREVIEW ONLY — Metro picks this file over rnfb-setup.ts when bundling
// for the browser (`npm run web -w apps/ios`, docs/features/ios-web-preview.md).
//
// On iOS, @react-native-firebase is auto-initialised from
// GoogleService-Info.plist at native launch. In a browser there is no native
// app, so RNFB falls back to the Firebase JS SDK and needs an explicit
// initializeApp() with the project's *web* app config. That config comes from
// EXPO_PUBLIC_FIREBASE_* env vars (filled by web-preview/start.mjs from
// apps/web/.env.local, or set in apps/ios/.env.local) — nothing is hardcoded.
// Same Firebase project as the PWA; no new paid API is called.
import firebase from "@react-native-firebase/app";

// Native-only props (accessibilityElementsHidden, importantForAccessibility,
// react-native-svg's transform-origin, ...) reach the DOM under
// react-native-web and trigger dev-only React prop warnings whose Expo overlay
// toast covers the tab bar in the preview. Harmless on web; drop just those
// (react-native-web's LogBox.ignoreLogs is a no-op).
const DOM_PROP_WARNING = /^(React does not recognize the|Invalid DOM property)/;
const consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && DOM_PROP_WARNING.test(args[0])) return;
  consoleError(...args);
};

(globalThis as { RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS?: boolean })
  .RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// RNFB's web event bridge calls setImmediate, which React Native provides but
// browsers do not.
const g = globalThis as { setImmediate?: (fn: (...args: unknown[]) => void, ...args: unknown[]) => unknown };
if (typeof g.setImmediate !== "function") {
  g.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

// Literal process.env.EXPO_PUBLIC_* reads so Expo inlines them at bundle time.
const options = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  // RNFB validates databaseURL even though the app never uses Realtime
  // Database; the default-instance URL is derived, never connected to.
  databaseURL: `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
};

if (firebase.apps.length === 0) {
  if (!options.apiKey || !options.projectId || !options.appId) {
    console.error(
      "[web preview] Missing EXPO_PUBLIC_FIREBASE_* config. Start with `npm run web -w apps/ios` " +
        "(reads apps/web/.env.local) or create apps/ios/.env.local — see docs/features/ios-web-preview.md.",
    );
  } else {
    // Registers [DEFAULT] synchronously; the JS SDK app is created right after.
    void firebase.initializeApp(options as Parameters<typeof firebase.initializeApp>[0]).catch((error: unknown) => {
      console.error("[web preview] Firebase initializeApp failed", error);
    });
  }
}

export {};
