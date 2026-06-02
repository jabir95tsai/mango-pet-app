// Auth client IDs.
//
// iOS OAuth client id comes straight from GoogleService-Info.plist (CLIENT_ID).
// The Firebase Google provider, however, validates the Google idToken against
// the project's **Web** OAuth client id (the "Web client (auto created by
// Google Service)" in GCP / Firebase console) — that value is NOT in the plist.
//
// ⚠️ HANDOFF (iOS Backend): supply the Web client id for project 722604603606
//    and replace the placeholder below (or wire it via EAS env / app config).
//    Google Sign-In → Firebase credential will fail until this is real.
export const GOOGLE_IOS_CLIENT_ID =
  "722604603606-ai03auqrk0l88utpvb090imkibsqsn4u.apps.googleusercontent.com";

// "Web client (auto created by Google Service)" for project 722604603606,
// fetched from the Identity Platform google.com IdP config. Public value
// (it ships in every client) — safe to commit; the matching client *secret*
// stays server-side only and is NOT stored here.
export const GOOGLE_WEB_CLIENT_ID =
  "722604603606-oepafc9cc8r6i5dgtg9rlk2l75pdv0lr.apps.googleusercontent.com";

// Production web origin (App Hosting). Used to build shareable invite links +
// QR payloads — a family invite QR encodes `${SITE_URL}/join/{code}` and a
// friend QR `${SITE_URL}/app/friends/add?uid=...`, so a scan from any camera
// opens the web flow (cross-platform). In-app deep links use the `mangopet://`
// scheme via expo-router; universal-link routing into the app
// (apple-app-site-association) is a later P7 item.
export const SITE_URL = "https://mango-pet--mango-pet-app.asia-east1.hosted.app";
