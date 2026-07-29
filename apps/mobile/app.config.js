export default ({ config }) => ({
  ...config,
  name: "StaffTrack",
  slug: "stafftrack",
  owner: "bishnusahu",
  version: "1.0.8",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: ["**/*"],
  plugins: [
    [
      "expo-location",
      {
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
        locationAlwaysAndWhenInUsePermission:
          "StaffTrack uses your location during work hours for attendance and route tracking."
      }
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "StaffTrack uses receipt photos for expense submissions."
      }
    ],
    [
      "expo-camera",
      {
        cameraPermission: "StaffTrack uses the camera to capture expense receipts."
      }
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/logo.png",
        color: "#10B981"
      }
    ],
    "expo-asset"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.yourcompany.stafftrack",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "StaffTrack uses your location for attendance check-ins and task travel tracking.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "StaffTrack tracks your location during work hours in the background.",
      NSPhotoLibraryUsageDescription: "StaffTrack uses receipt photos for expense submissions.",
      NSCameraUsageDescription: "StaffTrack uses the camera to capture receipt photos.",
      UIBackgroundModes: ["location"]
    }
  },
  android: {
    package: "com.stafftrack.staff",
    googleServicesFile: "./google-services.json",
    versionCode: 11,
    largeHeap: true,
    notification: {
      icon: "./assets/logo.png",
      color: "#10B981"
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "POST_NOTIFICATIONS",
      "CAMERA",
      "READ_EXTERNAL_STORAGE"
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    }
  },
  web: {
    bundler: "metro"
  },
  extra: {
    apiBaseUrl: process.env.API_BASE_URL,
    eas: {
      projectId: "ef520f6b-8937-4515-8788-a1a6aceeba77"
    }
  }
});
