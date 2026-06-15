// store/mapLayersStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Toggles for the on-map layer system. Persisted locally so a user's choices
// survive restarts. Add future layers here (coolSpots, heatmap, saved…).
export interface MapLayers {
  reports: boolean;
}

const DEFAULTS: MapLayers = {
  reports: true,
};

interface MapLayersState {
  layers: MapLayers;
  toggle: (key: keyof MapLayers) => void;
  setLayer: (key: keyof MapLayers, value: boolean) => void;
}

export const useMapLayersStore = create<MapLayersState>()(
  persist(
    (set) => ({
      layers: DEFAULTS,
      toggle:   (key)        => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
      setLayer: (key, value) => set((s) => ({ layers: { ...s.layers, [key]: value } })),
    }),
    {
      name:    "navigo:store:map_layers",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ layers: s.layers }),
      // Backfill defaults for any newly-added layer keys after an app update.
      merge: (persisted, current) => ({
        ...current,
        layers: { ...DEFAULTS, ...((persisted as { layers?: Partial<MapLayers> })?.layers ?? {}) },
      }),
    },
  ),
);
