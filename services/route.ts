// services/route.service.ts
import type { Route } from "@/data/routes"; // Update this import to point to your types file
import type { UnifiedLocation } from "@/store/journeyStore";
import { fetchApi } from "./apiClient";

export const RouteService = {
  /**
   * Send the Origin and Destination to Laravel to calculate valid transit routes.
   * This completely replaces the messy spatial fallback math currently inside SearchScreen.tsx!
   */
  async calculateJourney(
    fromLoc: UnifiedLocation,
    toLoc: UnifiedLocation,
  ): Promise<Route[]> {
    const payload = {
      from: {
        type: fromLoc._type,
        lat: fromLoc.lat,
        lng: fromLoc.lng,
        id: fromLoc.id,
      },
      to: {
        type: toLoc._type,
        lat: toLoc.lat,
        lng: toLoc.lng,
        id: toLoc.id,
      },
    };

    const data = await fetchApi<{ data: Route[] }>("/routes/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data;
  },
};
