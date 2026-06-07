// services/notifications.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import ApiClient from "./apiClient";

const PROJECT_ID = "acc62a4b-150f-4ea6-b0f3-296dca0d6683";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerPushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    return token.data;
  } catch {
    return null;
  }
}

export async function syncTokenWithBackend(token: string): Promise<void> {
  await ApiClient.post("/auth/device-tokens", {
    token,
    platform: Platform.OS,
  });
}

export async function unregisterToken(token: string): Promise<void> {
  await ApiClient.delete("/auth/device-tokens", { data: { token } });
}

export function setupNotificationTapHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (data?.screen) router.push(data.screen as any);
  });
  return () => sub.remove();
}

// ── Local navigation notifications (fired when app is backgrounded) ──────────

export async function scheduleAlightWarning(minutesAway: number, stopName: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to get off soon",
      body: `Alight at ${stopName} in ~${minutesAway} min`,
      sound: "default",
      data: { type: "alight_warning" },
    },
    trigger: null,
  });
}

export async function scheduleArrivalNotification(stopName: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "You've arrived!",
      body: `Welcome to ${stopName}`,
      sound: "default",
      data: { type: "arrival" },
    },
    trigger: null,
  });
}

export async function scheduleWrongDirectionAlert(): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Wrong direction",
      body: "Turn around to get back on route",
      sound: "default",
      data: { type: "wrong_direction" },
    },
    trigger: null,
  });
}

export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}
