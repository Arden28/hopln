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
   * Get the full walking route (Coordinates, Distance, Duration, and STEPS)
   */
  async getWalkingRoute(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    // Notice the &steps=true parameter is back!
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    const json = await response.json();
    
    // Return the entire route object so the map can extract coordinates AND steps
    return json.routes?.[0] || null;
  },

  /**
   * Snaps a rough GTFS shape to the actual Mapbox road network using Chunking.
   */
  async snapToRoads(coordinates: [number, number][]): Promise<[number, number][]> {
    if (!coordinates || coordinates.length < 2) return coordinates;

    // Helper to send a chunk of coordinates to Mapbox
    const matchChunk = async (chunk: [number, number][]) => {
      const coordsString = chunk.map(c => `${c[0]},${c[1]}`).join(';');
      const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      try {
        const response = await fetch(url);
        const json = await response.json();
        if (json.matchings && json.matchings.length > 0) {
          // Flatten all matchings in this chunk into one array
          return json.matchings.flatMap((m: any) => m.geometry.coordinates);
        }
      } catch (e) {
        console.warn("Map Matching chunk failed", e);
      }
      return chunk; // Fallback to raw if this chunk fails
    };

    let finalCoords: [number, number][] = [];

    // Mapbox limit is 100. We process the line in chunks of 90 points.
    for (let i = 0; i < coordinates.length; i += 90) {
      // Grab 95 points so there's a 5-point overlap to keep the line connected cleanly
      const chunk = coordinates.slice(i, i + 95);
      const matchedChunk = await matchChunk(chunk);

      // If we are stitching to a previous chunk, remove the first point to prevent a duplicate dot
      if (finalCoords.length > 0 && matchedChunk.length > 0) {
        matchedChunk.shift();
      }
      
      finalCoords.push(...matchedChunk);
    }

    return finalCoords;
  }
  
};
