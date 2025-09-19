// SafeStorage wrapper: never crashes if the native module isn't present.
// Works in Expo Go, web, dev clients, and tests.

import { Platform } from "react-native";

let NativeAsync: any = null;
try {
  // Only resolve if the package is installed & the native module is available
  NativeAsync = require("@react-native-async-storage/async-storage").default ?? null;
} catch {
  NativeAsync = null;
}

// Fallbacks
const mem = new Map<string, string>();
const web =
  typeof window !== "undefined" && "localStorage" in window
    ? (window.localStorage as Storage)
    : null;

type KV = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void> };

const MemoryDriver: KV = {
  async getItem(k) { return mem.get(k) ?? null; },
  async setItem(k, v) { mem.set(k, v); },
  async removeItem(k) { mem.delete(k); },
};

const WebDriver: KV = {
  async getItem(k) { return web?.getItem(k) ?? null; },
  async setItem(k, v) { web?.setItem(k, v); },
  async removeItem(k) { web?.removeItem(k); },
};

const NativeDriver: KV | null = NativeAsync
  ? {
      async getItem(k) { return NativeAsync.getItem(k); },
      async setItem(k, v) { return NativeAsync.setItem(k, v); },
      async removeItem(k) { return NativeAsync.removeItem(k); },
    }
  : null;

// Choose the best available driver without throwing
export const Storage: KV =
  NativeDriver ??
  (Platform.OS === "web" ? WebDriver : MemoryDriver);

// Optional: introspect which driver is active (handy while debugging)
export const storageDriver =
  NativeDriver ? "native-asyncstorage" :
  Platform.OS === "web" ? "web-localstorage" :
  "memory-fallback";
