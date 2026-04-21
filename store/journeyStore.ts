// store/journeyStore.ts
import type { Route } from "@/data/routes";
import { create } from "zustand";

export type TripStatus = "IDLE" | "WAITING_FOR_BUS" | "IN_TRANSIT" | "ARRIVED";

// We create a unified interface so the app can handle both physical Stops and Mapbox Locations (like "KFC")
export interface UnifiedLocation {
  _type: "stop" | "location";
  id: string;
  name: string;
  lat: number;
  lng: number;
  route_ids?: string; // Only stops have this
}

interface JourneyState {
  activeJourney: {
    fromLoc: UnifiedLocation;
    toLoc: UnifiedLocation;
    route: Route;
  } | null;
  tripStatus: TripStatus;
  setJourney: (
    fromLoc: UnifiedLocation,
    toLoc: UnifiedLocation,
    route: Route,
  ) => void;
  setTripStatus: (status: TripStatus) => void;
  clearJourney: () => void;
}

export const useJourneyStore = create<JourneyState>((set) => ({
  activeJourney: null,
  tripStatus: "IDLE",
  setJourney: (fromLoc, toLoc, route) =>
    set({
      activeJourney: { fromLoc, toLoc, route },
      tripStatus: "WAITING_FOR_BUS",
    }),
  setTripStatus: (status) => set({ tripStatus: status }),
  clearJourney: () => set({ activeJourney: null, tripStatus: "IDLE" }),
}));
