const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 1. Add 3D model file extensions to the asset resolver
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "glb",
  "gltf"
];

// Ensure Node.js built-in names always resolve to their npm polyfills,
// not Node's actual runtime modules.  Needed for expo-notifications'
// transitive dependency chain: @ide/backoff → assert → util → support/types.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  assert: require.resolve("assert"),
  util:   require.resolve("util"),
};

module.exports = config;
