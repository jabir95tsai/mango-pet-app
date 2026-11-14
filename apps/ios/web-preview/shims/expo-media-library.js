// WEB PREVIEW ONLY (metro.config.js swaps this in when platform === "web").
// expo-media-library has no web implementation and throws at import time, so
// the browser preview gets an inert stand-in: permission is never granted and
// saving rejects, which the app already surfaces as its normal "can't save"
// state. The iOS build still resolves the real package.
const denied = { status: "denied", granted: false, canAskAgain: false, expires: "never" };

export const PermissionStatus = { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" };

export async function getPermissionsAsync() {
  return denied;
}
export async function requestPermissionsAsync() {
  return denied;
}
export function usePermissions() {
  return [denied, requestPermissionsAsync, getPermissionsAsync];
}
export async function saveToLibraryAsync() {
  throw new Error("Saving to Photos is not available in the browser preview");
}
