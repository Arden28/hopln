// hooks/useStopSearch.ts
import { Storage } from "@/app/lib/storage";
import { StopService } from "@/services/stop";
import { UnifiedLocation } from "@/store/journeyStore";
import Constants from "expo-constants";
import { useEffect, useState } from "react";

type Coords = { latitude: number; longitude: number };
const RECENTS_KEY = "location-recents-v1";

const extra = (Constants?.expoConfig?.extra ?? {}) as any;
const MAPBOX_TOKEN =
  (process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string) ||
  (extra.mapboxToken as string);

// --- SAFE STORAGE SHIM ---
const memoryStore = new Map<string, string>();
const SafeStorage =
  Storage ??
  ({
    async getItem(key: string) {
      return memoryStore.get(key) ?? null;
    },
    async setItem(key: string, val: string) {
      memoryStore.set(key, val);
    },
    async removeItem(key: string) {
      memoryStore.delete(key);
    },
  } as Pick<typeof Storage, "getItem" | "setItem" | "removeItem">);

function dMeters(a: Coords, b: Coords) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useStopSearch(query: string, me: Coords | null) {
  const [recents, setRecents] = useState<UnifiedLocation[]>([]);
  const [matches, setMatches] = useState<
    { item: UnifiedLocation; blended: number }[]
  >([]);

  // Load Recents
  useEffect(() => {
    (async () => {
      try {
        const s = await SafeStorage.getItem(RECENTS_KEY);
        if (s) setRecents(JSON.parse(s));
      } catch {}
    })();
  }, []);

  // Perform Search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        // 1. QUERY YOUR LOCAL POI LAYER FIRST
        const backendStops = await StopService.searchStops(q);
        
        let localMatches = backendStops.map((s, idx) => ({
          item: {
            _type: "stop" as const,
            id: s.id,
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            route_nams: s.route_nams,
          },
          // Assign a fake high score so these always stay at the top
          blended: 1.0 - (idx * 0.01), 
        }));

        // 2. FALLBACK TO MAPBOX IF NEEDED
        // If your database found less than 3 stages, the user is probably 
        // looking for a specific address or building. Call Mapbox!
        let remoteMatches: any[] = [];
        if (localMatches.length < 3) {
          const proxParam = me ? `&proximity=${me.longitude},${me.latitude}` : "";
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=ke&types=poi,address,place${proxParam}`
          );
          const json = await res.json();

          if (json.features) {
            remoteMatches = json.features.map((f: any, idx: number) => ({
              item: {
                _type: "location" as const,
                id: f.id,
                name: f.text,
                lat: f.center[1],
                lng: f.center[0],
              },
              // Mapbox results get a slightly lower score so they sit below Matatu stages
              blended: 0.8 - (idx * 0.05),
            }));
          }
        }

        // 3. COMBINE AND DISPLAY
        const combined = [...localMatches, ...remoteMatches].sort(
          (a, b) => b.blended - a.blended,
        );
        setMatches(combined);

      } catch (e) {
        console.warn("Search failed", e);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(searchTimeout);
  }, [query, me?.latitude, me?.longitude]);

  const pushRecent = async (s: UnifiedLocation) => {
    const next = [s, ...recents.filter((r) => r.id !== s.id)].slice(0, 6);
    setRecents(next);
    try {
      await SafeStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {}
  };

  return { recents, matches, pushRecent };
}