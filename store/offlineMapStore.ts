// store/offlineMapStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface OfflineBBox {
  north: number;
  south: number;
  east:  number;
  west:  number;
}

export interface OfflinePack {
  id:        string;
  name:      string;
  bbox:      OfflineBBox;
  minZoom:   number;
  maxZoom:   number;
  tileCount: number; // per style
  bytes:     number; // combined (light + dark)
  createdAt: number;
  styles:    { light: boolean; dark: boolean };
}

export type OfflineStatus = "idle" | "downloading" | "ready" | "error";

interface OfflineMapState {
  pack:     OfflinePack | null;
  status:   OfflineStatus;
  progress: number; // 0..1, runtime only
  setPack:     (pack: OfflinePack) => void;
  clearPack:   () => void;
  setStatus:   (status: OfflineStatus) => void;
  setProgress: (progress: number) => void;
}

export const useOfflineMapStore = create<OfflineMapState>()(
  persist(
    (set) => ({
      pack:     null,
      status:   "idle",
      progress: 0,
      setPack:     (pack)     => set({ pack, status: "ready", progress: 1 }),
      clearPack:   ()         => set({ pack: null, status: "idle", progress: 0 }),
      setStatus:   (status)   => set({ status }),
      setProgress: (progress) => set({ progress }),
    }),
    {
      name:    "navigo:store:offline_map",
      storage: createJSONStorage(() => AsyncStorage),
      // Only the durable pack manifest is persisted; status/progress are runtime.
      partialize: (s) => ({ pack: s.pack }),
      merge: (persisted, current) => {
        const pack = (persisted as { pack?: OfflinePack | null })?.pack ?? null;
        // Packs from before the dual-style update lack the `styles` field and
        // their tiles are in the old flat directory — clear them so the user
        // re-downloads into the new light/ dark/ structure.
        if (pack && !pack.styles) return { ...current, pack: null, status: "idle" as const };
        return { ...current, pack, status: pack ? ("ready" as const) : ("idle" as const) };
      },
    },
  ),
);
