// store/navSessionStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UnifiedLocation } from "@/store/journeyStore";
import type { Route } from "@/services/route";

const KEY = "@hopln/nav_session_v1";
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface NavSession {
  version: 1;
  savedAt: number;
  tripStatus: "IN_TRANSIT" | "WAITING_FOR_BUS";
  stepIndex: number;
  highWaterMark: number;
  engineStrikes: number;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeed: number;
  activeJourney: {
    fromLoc: UnifiedLocation;
    toLoc: UnifiedLocation;
    route: Route;
  };
}

export const navSession = {
  async save(s: NavSession): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  },

  async restore(): Promise<NavSession | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as NavSession;
      if (s.version !== 1 || Date.now() - s.savedAt > MAX_AGE_MS) {
        await AsyncStorage.removeItem(KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {}
  },
};
