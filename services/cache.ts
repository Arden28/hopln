// services/cache.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX  = "hopln:cache:";
const CACHE_V = 1; // bump to invalidate all cached entries on schema change

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  v: number;
}

export const CacheService = {
  async get<T>(key: string, maxAgeMs: number): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.v !== CACHE_V) return null;
      if (Date.now() - entry.cachedAt > maxAgeMs) return null;
      return entry.data;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    try {
      const entry: CacheEntry<T> = { data, cachedAt: Date.now(), v: CACHE_V };
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // storage failures are non-fatal
    }
  },

  async invalidate(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },

  async invalidateAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));
      if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
    } catch {}
  },
};

export const CACHE_KEYS = {
  STOPS_ALL:              "stops_all",
  USER_ME:                "user_me",
  SETTINGS_NOTIFICATIONS: "settings_notifications",
  NOTIFICATIONS_INBOX:    "notifications_inbox",
} as const;

export const CACHE_TTL = {
  STOPS:                  24 * 60 * 60 * 1000,  // 24 h, stops change rarely
  USER:                    5 * 60 * 1000,        // 5 min
  SETTINGS:            7 * 24 * 60 * 60 * 1000,  // 7 days, settings are user-driven
  NOTIFICATIONS_INBOX:        60 * 1000,         // 1 min, inbox needs to feel live
  DEFAULT:                 5 * 60 * 1000,
} as const;
