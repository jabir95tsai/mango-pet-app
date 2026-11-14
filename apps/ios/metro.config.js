// Monorepo-aware Metro config for npm workspaces.
// Since SDK 52, expo/metro-config detects the workspace root on its own and
// sets watchFolders + nodeModulesPaths, so shared code in ../../packages/*
// hot-reloads without manual overrides. expo-doctor (SDK 57) flags the old
// manual `disableHierarchicalLookup = true` override, so keep this default.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Browser preview (`npm run web -w apps/ios`, docs/features/ios-web-preview.md):
// native-only packages that throw at import time on web are swapped for inert
// stand-ins in web-preview/shims. Gated on platform === "web", so the iOS
// bundle resolves exactly as before.
const WEB_SHIMS = {
  "expo-media-library": "expo-media-library.js",
  "expo-glass-effect": "expo-glass-effect.js",
  "@react-native-firebase/messaging": "rnfb-messaging.js",
  "@react-native-google-signin/google-signin": "google-signin.js",
};

// On web, RNFB runs on its own nested Firebase JS SDK copy, but shared
// @firebase/* packages hoisted to the root would import the root's
// @firebase/app — two app registries, so "Component auth has not been
// registered yet". Pin every web import of @firebase/app to RNFB's copy.
const RNFB_FIREBASE_ORIGIN = path.join(
  path.dirname(require.resolve("@react-native-firebase/app/package.json")),
  "node_modules",
  "firebase",
  "package.json",
);

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (platform === "web") {
    if (WEB_SHIMS[moduleName]) {
      return {
        type: "sourceFile",
        filePath: path.join(__dirname, "web-preview", "shims", WEB_SHIMS[moduleName]),
      };
    }
    if (moduleName === "firebase/auth" && context.originModulePath.includes("@react-native-firebase")) {
      return {
        type: "sourceFile",
        filePath: path.join(__dirname, "web-preview", "shims", "rnfb-firebase-auth.js"),
      };
    }
    // Inside the iphone.html device frame, report real iPhone safe-area insets.
    if (
      moduleName === "./NativeSafeAreaProvider" &&
      context.originModulePath.includes("react-native-safe-area-context")
    ) {
      return {
        type: "sourceFile",
        filePath: path.join(__dirname, "web-preview", "shims", "safe-area-native-provider.js"),
      };
    }
    if (moduleName === "@firebase/app") {
      return resolve({ ...context, originModulePath: RNFB_FIREBASE_ORIGIN }, moduleName, platform);
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
