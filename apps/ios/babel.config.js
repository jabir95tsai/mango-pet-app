// babel-preset-expo already includes the expo-router & reanimated-free setup
// for Expo SDK 52. Keep this minimal; add plugins only when a dep requires it.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
