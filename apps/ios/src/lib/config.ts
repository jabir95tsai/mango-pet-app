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

export const GOOGLE_WEB_CLIENT_ID =
  "722604603606-REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com";
