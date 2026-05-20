// plugins/withGoogleMapsIOS.js
//
// Expo config plugin that wires react-native-maps to the GoogleMaps iOS SDK.
// Runs automatically during `eas build` / `expo prebuild`. No manual Podfile
// or Xcode edits needed.
//
// What it does:
//   1. Switches the react-native-maps pod to its GoogleMaps subspec
//   2. Adds the GoogleMaps + Google-Maps-iOS-Utils CocoaPods
//   3. Injects [GMSServices provideAPIKey:] into AppDelegate before super call

const { withAppDelegate, withDangerousMod } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

// ─── 1. Podfile ───────────────────────────────────────────────────────────────

function withGoogleMapsPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Already patched — skip.
      if (podfile.includes("GoogleMaps")) return config;

      // Replace the bare react-native-maps pod line with the GoogleMaps subspec.
      const RNM_RE = /(pod ['"]react-native-maps['"].*)\n/;
      if (!RNM_RE.test(podfile)) {
        console.warn(
          "[withGoogleMapsIOS] Could not find react-native-maps pod line in Podfile.",
        );
        return config;
      }

      podfile = podfile.replace(
        RNM_RE,
        [
          "  pod 'react-native-maps', :path => '../node_modules/react-native-maps', :subspecs => ['GoogleMaps']",
          "  pod 'GoogleMaps', '~> 9.0'",
          "  pod 'Google-Maps-iOS-Utils', '~> 4.0'",
          "",
        ].join("\n"),
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
}

// ─── 2. AppDelegate ───────────────────────────────────────────────────────────

function withGoogleMapsAppDelegate(config, { apiKey }) {
  return withAppDelegate(config, (config) => {
    let { contents } = config.modResults;

    // Already patched — skip.
    if (contents.includes("GMSServices provideAPIKey")) return config;

    // Add import after the first #import line.
    if (!contents.includes("#import <GoogleMaps/GoogleMaps.h>")) {
      contents = contents.replace(
        /#import "AppDelegate\.h"/,
        '#import "AppDelegate.h"\n#import <GoogleMaps/GoogleMaps.h>',
      );
    }

    // Inject the API-key call just before the [super didFinishLaunching...] line.
    contents = contents.replace(
      /return \[super application:application didFinishLaunchingWithOptions:launchOptions\];/,
      `[GMSServices provideAPIKey:@"${apiKey}"];\n  return [super application:application didFinishLaunchingWithOptions:launchOptions];`,
    );

    config.modResults.contents = contents;
    return config;
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * @param {import('@expo/config-plugins').ConfigPlugin} config
 * @param {{ apiKey: string }} options
 */
function withGoogleMapsIOS(config, { apiKey } = {}) {
  if (!apiKey) {
    throw new Error(
      "[withGoogleMapsIOS] `apiKey` is required. Pass EXPO_PUBLIC_GOOGLE_MAPS_API_KEY via your app.config.js.",
    );
  }
  config = withGoogleMapsPodfile(config);
  config = withGoogleMapsAppDelegate(config, { apiKey });
  return config;
}

module.exports = withGoogleMapsIOS;
