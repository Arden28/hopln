// store/notificationStore.ts
import { create } from "zustand";

interface NotificationState {
  pushToken: string | null;
  permissionGranted: boolean;
  unreadCount: number;
  setPushToken: (token: string | null) => void;
  setPermissionGranted: (granted: boolean) => void;
  setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  pushToken:         null,
  permissionGranted: false,
  unreadCount:       0,
  setPushToken:         (token)   => set({ pushToken: token }),
  setPermissionGranted: (granted) => set({ permissionGranted: granted }),
  setUnreadCount:       (count)   => set({ unreadCount: count }),
}));
