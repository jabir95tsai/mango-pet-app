// Monorepo-aware Metro config for npm workspaces.
// Expo lives in apps/ios; shared code in ../../packages/*. Metro must watch the
// workspace root and resolve modules from BOTH the app and the hoisted root
// node_modules. Mirrors the official Expo "monorepo" guide.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so changes to packages/* hot-reload).
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Don't let Metro walk up past the workspace root.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
