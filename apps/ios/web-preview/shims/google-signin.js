// WEB PREVIEW ONLY (metro.config.js swaps this in when platform === "web").
// The native Google Sign-In SDK does not run in a browser. The stand-in lets
// the sign-in screen render; tapping Google rejects with a clear message.
// Use the guest ("先逛逛") flow in the preview instead.
const unavailable = () =>
  Promise.reject(new Error("Google Sign-In is not available in the browser preview — continue as guest"));

export const statusCodes = {
  SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  IN_PROGRESS: "IN_PROGRESS",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
};

export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: unavailable,
  getTokens: unavailable,
  signOut: async () => null,
  revokeAccess: async () => null,
  hasPreviousSignIn: () => false,
  getCurrentUser: () => null,
};

export const isErrorWithCode = (error) => !!error && typeof error === "object" && "code" in error;
export const isSuccessResponse = (response) => response?.type === "success";
