// babel-preset-expo handles expo-router for SDK 52. react-native-reanimated
// (P3b lightbox) requires its babel plugin, and it MUST be listed last.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
