// hooks/useStopSearch.ts
import { Storage } from "@/app/lib/storage";
import { MapService, type PlacePrediction } from "@/services/map";
import { StopService } from "@/services/stop";
import { UnifiedLocation } from "@/store/journeyStore";
import { useEffect, useState } from "react";

type Coords = { latitude: number; longitude: number };
const RECENTS_KEY = "location-recents-v1";

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

export function useStopSearch(query: string, me: Coords | null) {
  const [recents, setRecents]                   = useState<UnifiedLocation[]>([]);
  const [stops, setStops]                       = useState<UnifiedLocation[]>([]);
  const [places, setPlaces]                     = useState<PlacePrediction[]>([]);
  const [isSearchingStops, setIsSearchingStops] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // Load recents from storage once
  useEffect(() => {
    (async () => {
      try {
        const s = await SafeStorage.getItem(RECENTS_KEY);
        if (s) setRecents(JSON.parse(s));
      } catch {}
    })();
  }, []);

  // Parallel search: local stops + Google Places
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setStops([]);
      setPlaces([]);
      setIsSearchingStops(false);
      setIsSearchingPlaces(false);
      return;
    }

    setIsSearchingStops(true);
    setIsSearchingPlaces(true);

    let stale = false;

    const timer = setTimeout(() => {
      StopService.searchStops(q)
        .then((results) => {
          if (stale) return;
          setStops(
            results.map((s) => ({
              _type:      "stop" as const,
              id:         s.id,
              name:       s.name,
              lat:        s.lat,
              lng:        s.lng,
              route_nams: s.route_nams,
            })),
          );
        })
        .catch(() => {})
        .finally(() => { if (!stale) setIsSearchingStops(false); });

      MapService.placesAutocomplete(q, me?.latitude, me?.longitude)
        .then((predictions) => {
          if (stale) return;
          setPlaces(predictions);
        })
        .catch(() => {})
        .finally(() => { if (!stale) setIsSearchingPlaces(false); });
    }, 300);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, me?.latitude, me?.longitude]);

  const pushRecent = async (s: UnifiedLocation) => {
    const next = [s, ...recents.filter((r) => r.id !== s.id)].slice(0, 6);
    setRecents(next);
    try {
      await SafeStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {}
  };

  return { recents, stops, places, pushRecent, isSearchingStops, isSearchingPlaces };
}
