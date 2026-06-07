// services/stop.service.ts
import type { UnifiedLocation } from "@/store/journeyStore";
import { fetchApi, dedupedGet } from "./apiClient";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "./cache";

// Module-level cache, stops are fetched once per app session
let _allStopsCache: Stop[] | null = null;

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location_t: number; // This is location_type (0 for stop, 1 for station, etc.)
  parent_sta: string | null;
  trip_count: number;
  trip_ids: string | null;
  route_ids: string | null;
  route_nams: string | null;
}

export interface StopRoute {
  id: string;
  short_name: string;
  long_name: string;
  route_type: number;
}

export interface StopDetail {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location_t: number;
  routes: StopRoute[];
}

export const StopService = {
  /**
   * Fetches all stops once and caches them for the app session.
   * Returns slim objects: { id, name, lat, lng }.
   */
  async getAllStops(): Promise<Stop[]> {
    // Tier 1: in-memory (fastest, within same session)
    if (_allStopsCache) return _allStopsCache;

    // Tier 2: AsyncStorage (fast, survives app reload, 24h TTL)
    const cached = await CacheService.get<Stop[]>(CACHE_KEYS.STOPS_ALL, CACHE_TTL.STOPS);
    if (cached) {
      _allStopsCache = cached;
      return cached;
    }

    // Tier 3: network (deduped so parallel callers share one request)
    const data = await dedupedGet("stops_all", () => fetchApi<{ data: Stop[] }>("/stops/all"));
    _allStopsCache = data.data;
    CacheService.set(CACHE_KEYS.STOPS_ALL, data.data); // fire-and-forget
    return _allStopsCache;
  },


  /**
   * Fetches full stop detail including resolved routes from the routes table.
   * Cached 30 min server-side; no client-side cache (sheet re-fetches per stop).
   */
  async getStopDetails(id: string): Promise<StopDetail> {
    const data = await fetchApi<{ data: StopDetail }>(`/stops/${id}`);
    return data.data;
  },

  /**
   * Fetch the physical stops nearest to the user's GPS.
   * Replaces the local dMeters array sorting in map.tsx.
   */
  async getNearbyStops(
    lat: number,
    lng: number,
    radius = 1500,
    limit = 5,
  ): Promise<UnifiedLocation[]> {
    const data = await fetchApi<{ data: UnifiedLocation[] }>(
      `/stops/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`,
    );
    return data.data;
  },

  /**
   * Search your backend for specific stop names.
   */
  async searchStops(query: string): Promise<UnifiedLocation[]> {
    if (!query || query.length < 2) return [];

    const data = await fetchApi<{ data: UnifiedLocation[] }>(
      `/stops/search?q=${encodeURIComponent(query)}`,
    );

    console.log("Search Stops Result:", data.data);
    return data.data;
  },
};
