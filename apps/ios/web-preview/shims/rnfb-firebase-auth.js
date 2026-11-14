// WEB PREVIEW ONLY (metro.config.js routes RNFB's own `firebase/auth` import
// here when platform === "web").
//
// RNFB's web fallback creates the JS SDK Auth with initializeAuth(app, {}),
// i.e. in-memory persistence: every browser reload would sign the guest out
// and create yet another anonymous user + profile doc. Default the
// persistence to the browser's IndexedDB/localStorage so one preview guest
// survives reloads. Everything else is the stock Firebase Auth SDK.
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth as initializeAuthSdk,
} from "@firebase/auth";

export * from "@firebase/auth";

export function initializeAuth(app, deps = {}) {
  return initializeAuthSdk(app, {
    ...deps,
    persistence: deps.persistence ?? [indexedDBLocalPersistence, browserLocalPersistence],
  });
}
