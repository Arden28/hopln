// app.config.js
require("dotenv").config();

const IS_DEV = process.env.APP_ENV === "development";
const IS_PREVIEW = process.env.APP_ENV === "preview";

const getBundleId = () => {
  if (IS_DEV) return "com.hopln.app.dev";
  if (IS_PREVIEW) return "com.hopln.app.preview";
  return "com.hopln.app";
};

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

    ios: {
      bundleIdentifier: getBundleId(),
      buildNumber: "1",
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "We use your location to show nearby stages.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: getBundleId(),
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN || "",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      router: {},
      mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
      mapboxStyleUrl: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL,
      eas: {
        projectId: "acc62a4b-150f-4ea6-b0f3-296dca0d6683",
      },
    },

    owner: "arden28",
  },
};
