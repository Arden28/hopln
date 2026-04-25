// services/route.service.ts
import type { UnifiedLocation } from "@/store/journeyStore";
import { fetchApi } from "./apiClient";
import { Stop } from "./stop";

export interface RouteSegment {
  order: number;
  route_id: string;
  route_name: string;
  trip_id?: string;
  points: [number, number][]; // [longitude, latitude]
  board_stop?: Stop;
  alight_stop?: Stop;
}

export interface Route {
  type: "direct" | "transfer";
  summary: string;
  segments: RouteSegment[];
}

export const RouteService = {
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

    const data = await fetchApi<{ data: Route[] }>("/journey/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log("Calculated Routes:", data.data);
    return data.data;
  },
};