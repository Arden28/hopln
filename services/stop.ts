// services/stop.service.ts
import type { UnifiedLocation } from "@/store/journeyStore";
import { fetchApi } from "./apiClient";

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

export const StopService = {
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

    // console.log("Search Stops Result:", data.data);
    return data.data;
  },
};
