// tasks/locationTask.ts
// Background location task, must be imported at module-eval time (before React tree mounts).
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { DeviceEventEmitter } from "react-native";

export const BACKGROUND_LOCATION_TASK = "hopln-background-location";

/**
 * Register the background location task with expo-task-manager.
 * Safe to call multiple times, guarded by isTaskDefined.
 */
export function registerLocationTask(): void {
  if (TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return;
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("[BgLocation]", (error as any).message ?? error);
      return;
    }
    const { locations } = data as { locations: Location.LocationObject[] };
    locations.forEach((loc) => DeviceEventEmitter.emit("bgLocation", loc));
  });
}
