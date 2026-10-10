// babel-preset-expo handles expo-router, and since SDK 54 it also adds the
// react-native-worklets plugin that Reanimated 4 needs, so it must NOT be
// listed here again (a duplicate worklets plugin breaks the build).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
