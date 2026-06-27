import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const PREFS_KEY = "navigo:travel_prefs";

export interface TravelPrefs {
  mapApp:        "system" | "google" | "apple" | "waze";
  navHints:      "off" | "concise" | "detailed";
  units:         "km" | "mi";
  navView:       "flat" | "tilted";
  maxWalkMeters: 500 | 1000 | 1500 | 2000;
  showFares:     boolean;
}

const DEFAULTS: TravelPrefs = {
  mapApp:        "system",
  navHints:      "concise",
  units:         "km",
  navView:       "tilted",
  maxWalkMeters: 1500,
  showFares:     true,
};

interface PrefsStore {
  prefs:  TravelPrefs;
  loaded: boolean;
  load(): Promise<void>;
  set<K extends keyof TravelPrefs>(key: K, value: TravelPrefs[K]): Promise<void>;
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
  prefs:  DEFAULTS,
  loaded: false,

  async load() {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<TravelPrefs>) : {};
      set({ prefs: { ...DEFAULTS, ...saved }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  async set(key, value) {
    const next = { ...get().prefs, [key]: value };
    set({ prefs: next });
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  },
}));

export function formatDist(meters: number, units: "km" | "mi"): string {
  if (units === "mi") {
    const miles = meters / 1609.34;
    return miles < 0.1 ? `${Math.round(meters * 3.281)} ft` : `${miles.toFixed(1)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
