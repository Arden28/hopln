// services/map.service.ts
import type { UnifiedLocation } from "@/store/journeyStore";
import Constants from "expo-constants";

const extra = (Constants?.expoConfig?.extra ?? {}) as any;
const MAPBOX_TOKEN =
  (process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string) ||
  (extra.mapboxToken as string);

export const MapService = {
  /**
   * Ping Mapbox to turn user text into real-world addresses.
   */
  async geocodeAddress(
    query: string,
    proximityLat?: number,
    proximityLng?: number,
  ): Promise<UnifiedLocation[]> {
    if (!query || query.length < 3) return [];

    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=ke&types=poi,address,place`;

    if (proximityLat && proximityLng) {
      url += `&proximity=${proximityLng},${proximityLat}`;
    }

    try {
      const response = await fetch(url);
      const json = await response.json();

      if (!json.features) return [];

      return json.features.map((f: any) => ({
        _type: "location" as const,
        id: f.id,
        name: f.text,
        lat: f.center[1],
        lng: f.center[0],
      }));
    } catch (error) {
      console.error("Mapbox Geocoding failed:", error);
      return [];
    }
  },

  /**
   * Get smooth walking lines for Leg 1 and Leg 3 of a journey.
   */
  async getWalkingShape(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    const json = await response.json();

    return json.routes?.[0]?.geometry?.coordinates || [];
  },
};
