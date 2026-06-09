// services/backgroundLocation.ts
import * as Location from "expo-location";
import { BACKGROUND_LOCATION_TASK } from "@/tasks/locationTask";

export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === "granted";
}

export async function startBackgroundTracking(): Promise<boolean> {
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (already) return true;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Navigo Navigation",
        notificationBody: "Tracking your journey in the background",
        notificationColor: "#FF6F00",
      },
    });
    return true;
  } catch (e) {
    console.warn("[BgLocation] startBackgroundTracking failed:", e);
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    // Task may not be registered yet on cold start, safe to ignore
  }
}
