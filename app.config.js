// app.config.js
require("dotenv").config();

module.exports = {
  expo: {
    name: "hopln",
    slug: "hopln",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/hopln.png",
    scheme: "hopln",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    plugins: [
      "expo-router",
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN || ""
        }
      ]
    ],

    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "We use your location to show nearby stages."
        // If you ever add background tracking, also add:
        // UIBackgroundModes: ["location"]
      }
    },

    android: {
        package: "com.arden28.hopln",
        adaptiveIcon: {
            backgroundColor: "#E6F4FE",
            foregroundImage: "./assets/images/android-icon-foreground.png",
            monochromeImage: "./assets/images/android-icon-monochrome.png"
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
    },

    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },

    // You don't *need* to forward EXPO_PUBLIC_* via extra,
    // but it's handy for non-public vars or for reading in code via Constants.expoConfig.extra.
    extra: {
      router: {},
      mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,         // optional mirror
      mapboxStyleUrl: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL,  // optional mirror
      eas: { projectId: "acc62a4b-150f-4ea6-b0f3-296dca0d6683" }
    },

    owner: "arden28"
  }
};
