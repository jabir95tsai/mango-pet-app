// WEB PREVIEW ONLY. Shared flags for the browser preview stand-ins.
//
// iphone.html (apps/ios/public) embeds the app in an <iframe data-device="iphone">.
// Reading the flags off the frame element (same origin) instead of the URL
// keeps them across in-app navigation and reloads inside the frame.
function frameData() {
  try {
    return globalThis.frameElement?.dataset ?? {};
  } catch {
    return {};
  }
}

function query(name) {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get(name);
  } catch {
    return null;
  }
}

const data = frameData();

/** Running inside the iphone.html device frame. */
export const IN_IPHONE_FRAME = data.device === "iphone";

/** iPhone 15 / 16 safe-area insets (portrait, Dynamic Island). */
export const IPHONE_INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

/** Liquid Glass on unless ?glass=0 (page URL or the frame page's URL). */
export const GLASS_ENABLED = query("glass") !== "0" && data.glass !== "0";
