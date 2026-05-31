// EAS Build hook (runs as `eas-build-post-install`, after `npm ci` and
// before prebuild / `pod install`).
//
// Why: this is an npm-workspaces monorepo. apps/ios pins react-native
// 0.76.9, but several deps declare `peerDependencies: { "react-native": "*" }`
// (@react-native-firebase/*, @react-native-google-signin, @expo/metro-runtime,
// expo-linking, …). npm satisfies that loose peer by installing react-native
// *latest* (0.85.3) hoisted at the monorepo ROOT node_modules, while apps/ios
// keeps its own nested 0.76.9. That duplicate react-native can confuse
// CocoaPods autolinking — a documented cause of
//   "[!] Unable to find a specification for `ReactAppDependencyProvider`
//        depended upon by `ExpoModulesCore`"
// at the Install pods step.
//
// Fix (lockfile-safe): at build time, delete the stray root react-native so
// only apps/ios's 0.76.9 remains. We do NOT touch package-lock.json, and
// apps/web (Next.js) doesn't use react-native, so removing the root copy is
// safe. Guarded: only removes the root copy if it is NOT the pinned version.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PINNED = "0.76.9";
// this file: apps/ios/scripts/ → monorepo root is three levels up
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const rootRN = join(root, "node_modules", "react-native");
const rootRNPkg = join(rootRN, "package.json");

try {
  if (!existsSync(rootRNPkg)) {
    console.log("[eas-dedupe-rn] no react-native at monorepo root — nothing to do");
  } else {
    const version = JSON.parse(readFileSync(rootRNPkg, "utf8")).version;
    if (version === PINNED) {
      console.log(`[eas-dedupe-rn] root react-native is ${version} (pinned) — kept`);
    } else {
      rmSync(rootRN, { recursive: true, force: true });
      console.log(
        `[eas-dedupe-rn] removed stray root react-native ${version}; ` +
          `apps/ios keeps its nested ${PINNED}`,
      );
    }
  }
} catch (err) {
  // Never fail the build over the dedupe attempt.
  console.log(`[eas-dedupe-rn] skipped (${err.message})`);
}
