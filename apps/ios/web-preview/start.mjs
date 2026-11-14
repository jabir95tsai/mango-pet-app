#!/usr/bin/env node
// `npm run web -w apps/ios` — browser preview of the iOS app (react-native-web).
// See docs/features/ios-web-preview.md.
//
// The browser build talks to Firebase through the JS SDK, which needs the
// project's *web* app config. Rather than committing it, reuse the PWA's local
// apps/web/.env.local (NEXT_PUBLIC_FIREBASE_*) and expose it to Expo as
// EXPO_PUBLIC_FIREBASE_*. Values already set in the environment or in
// apps/ios/.env.local win. Nothing here is written to disk.
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const iosDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEYS = ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "STORAGE_BUCKET", "MESSAGING_SENDER_ID", "APP_ID"];

function parseEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

// A git worktree has no copy of the (gitignored) .env.local, so also look in
// the primary checkout, found via the shared .git directory.
function primaryCheckoutWebEnv() {
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: iosDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return resolve(dirname(commonDir), "apps/web/.env.local");
  } catch {
    return null;
  }
}

const iosEnv = parseEnv(resolve(iosDir, ".env.local"));
const webEnvCandidates = [
  process.env.WEB_PREVIEW_ENV_FILE,
  resolve(iosDir, "../web/.env.local"),
  primaryCheckoutWebEnv(),
].filter(Boolean);
const webEnvFile = webEnvCandidates.find((file) => existsSync(file));
const webEnv = webEnvFile ? parseEnv(webEnvFile) : {};
const env = { ...process.env };
const missing = [];
for (const key of KEYS) {
  const expoKey = `EXPO_PUBLIC_FIREBASE_${key}`;
  if (env[expoKey] || iosEnv[expoKey]) continue;
  const fromWeb = webEnv[`NEXT_PUBLIC_FIREBASE_${key}`];
  if (fromWeb) env[expoKey] = fromWeb;
  else missing.push(expoKey);
}
if (missing.length) {
  // Fail fast: without the config the app only boots into a Firebase error.
  console.error(
    `[web preview] Missing Firebase web config: ${missing.join(", ")}.\n` +
      `  Looked in: apps/ios/.env.local, ${webEnvCandidates.join(", ")}\n` +
      "  Fill apps/web/.env.local (NEXT_PUBLIC_FIREBASE_*) or apps/ios/.env.local (EXPO_PUBLIC_FIREBASE_*).\n" +
      "  See docs/features/ios-web-preview.md.",
  );
  process.exit(1);
}
if (webEnvFile) console.log(`[web preview] Firebase web config from ${webEnvFile}`);

const expoCli = createRequire(import.meta.url).resolve("expo/bin/cli");
const child = spawn(process.execPath, [expoCli, "start", "--web", ...process.argv.slice(2)], {
  cwd: iosDir,
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
