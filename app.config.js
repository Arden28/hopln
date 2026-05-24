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
      config: {
        googleMapsApiKey: "AIzaSyCu4R4EoyuIdNiY8K-SBKiP6vDc15AqRWU",
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "We use your location to show nearby stages.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "We use your location to show nearby stages.",
        NSLocationAlwaysUsageDescription: "We use your location to show nearby stages.",
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to use your camera to take stop photos.",
        NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photo library to upload stop photos.",
        NSPhotoLibraryAddUsageDescription: "Allow $(PRODUCT_NAME) to save photos to your library.",
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
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
      ],
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          photosPermission: "Allow $(PRODUCT_NAME) to access your photo library to upload stop photos.",
          cameraPermission: "Allow $(PRODUCT_NAME) to use your camera to take stop photos.",
          isAccessMediaLocationEnabled: true,
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location to show nearby stops and pick map locations.",
        },
      ],
      [
        "react-native-maps",
        {
          iosGoogleMapsApiKey: "AIzaSyCu4R4EoyuIdNiY8K-SBKiP6vDc15AqRWU",
          androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
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
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: "acc62a4b-150f-4ea6-b0f3-296dca0d6683",
      },
    },

    owner: "arden28",
  },
};
