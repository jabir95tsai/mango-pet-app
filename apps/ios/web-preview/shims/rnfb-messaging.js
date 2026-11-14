// WEB PREVIEW ONLY (metro.config.js swaps this in when platform === "web").
// @react-native-firebase/messaging has no web implementation (APNs / native
// FCM). The stand-in reports push permission as "not determined" and never
// hands out a token, so src/lib/push.ts stays in its idle state and never
// writes an FCM token to Firestore from the preview.
const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  EPHEMERAL: 3,
};

const instance = {
  hasPermission: async () => AuthorizationStatus.NOT_DETERMINED,
  requestPermission: async () => AuthorizationStatus.DENIED,
  registerDeviceForRemoteMessages: async () => {},
  getToken: async () => {
    throw new Error("Push notifications are not available in the browser preview");
  },
  deleteToken: async () => {},
  onTokenRefresh: () => () => {},
  onMessage: () => () => {},
  onNotificationOpenedApp: () => () => {},
  getInitialNotification: async () => null,
  setBackgroundMessageHandler: () => {},
};

function messaging() {
  return instance;
}
messaging.AuthorizationStatus = AuthorizationStatus;

export { AuthorizationStatus };
export default messaging;
