// Native Firebase entry for iOS — @react-native-firebase, NOT the Firebase JS
// web SDK (per ios-app-strategy tech stack: native APNs / background FCM /
// native auth). The app is auto-initialized from GoogleService-Info.plist at
// native launch; these are just typed accessors so screens import one place.
//
// Same Firebase project as web (mango-pet-app) → same Firestore schema, Storage
// bucket, and Cloud Functions. iOS does NOT redefine rules/indexes/functions.
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import messaging from "@react-native-firebase/messaging";

export { auth, firestore, storage, messaging };

export type FirebaseUser = ReturnType<typeof auth>["currentUser"];
