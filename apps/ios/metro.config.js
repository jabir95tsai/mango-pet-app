// Monorepo-aware Metro config for npm workspaces.
// Since SDK 52, expo/metro-config detects the workspace root on its own and
// sets watchFolders + nodeModulesPaths, so shared code in ../../packages/*
// hot-reloads without manual overrides. expo-doctor (SDK 57) flags the old
// manual `disableHierarchicalLookup = true` override, so keep this default.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
