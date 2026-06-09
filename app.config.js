// app.config.js
require("dotenv").config();

const IS_DEV = process.env.APP_ENV === "development";
const IS_PREVIEW = process.env.APP_ENV === "preview";

const getBundleId = () => {
  // if (IS_DEV) return "com.navigo.ke.dev";
  // if (IS_PREVIEW) return "com.navigo.ke.preview";
  return "com.navigo.ke";
};

module.exports = {
  expo: {
    name: "Navigo",
    slug: "navigo",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/navigo.png",
    scheme: "navigo",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      usesAppleSignIn: true,
      bundleIdentifier: "com.navigo.ke",
      buildNumber: "1",
      supportsTablet: true,
      // iOS Maps Config
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "We use your location to show nearby stages.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "We use your location to show nearby stages.",
        NSLocationAlwaysUsageDescription: "We use your location to show nearby stages.",
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to use your camera to take transit stop photos and update your profile picture.",
        NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photo library to upload stop photos and choose a profile picture.",
        NSPhotoLibraryAddUsageDescription: "Allow $(PRODUCT_NAME) to save photos to your library.",
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["location", "remote-notification"],
      },
    },

    android: {
      package: "com.navigo.ke",
      versionCode: 1,
      // Android Maps Config (Added to fix potential blank map issues)
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        },
      },
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
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
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
      "expo-task-manager",
      "expo-apple-authentication",
      [
        "expo-image-picker",
        {
          photosPermission: "Allow $(PRODUCT_NAME) to access your photo library to upload stop photos and choose a profile picture.",
          cameraPermission: "Allow $(PRODUCT_NAME) to use your camera to take transit stop photos and update your profile picture.",
          isAccessMediaLocationEnabled: true,
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location to show nearby stops and pick map locations.",
          backgroundPermission: "Navigo uses your location in the background to keep your journey on track.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/navigo.png",
          color: "#FF6F00",
          iosDisplayInForeground: true,
        },
      ],
      // Deleted the react-native-maps plugin block from here!
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
        projectId: "4f1cbaeb-8f43-4f47-9479-ac2fde23a3c2",
      },
    },

    owner: "navigo-kenya",
  },
};