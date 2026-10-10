// React Native Firebase v22+ logs a deprecation warning on EVERY namespaced
// call (`firestore()`, `firestore.FieldValue`, ...). The iOS app still uses the
// namespaced API throughout (v25 keeps it; v26 removes it — migrating to the
// modular `getFirestore()` API is a tracked follow-up), so silence the warnings
// until then. Must be imported before any @react-native-firebase module runs,
// i.e. as the FIRST import of app/_layout.tsx.
(globalThis as { RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS?: boolean })
  .RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

export {};
