import type { UnifiedLocation } from "@/store/journeyStore";
import { fetchApi } from "./apiClient";

export interface WalkStep {
  instruction: string;
  distance: number;
  lat: number;
  lng: number;
}

export interface RouteStop {
  name: string;
  lat:  number;
  lng:  number;
}

export interface RouteSegment {
  mode: "WALK" | "BUS" | "TRAM" | "SUBWAY" | "RAIL" | "FERRY";
  duration: number;
  distance: number;
  route_name?: string;
  route_color?: string | null;
  /** Google Polyline5-encoded geometry. Kept for backward compat; prefer `coordinates`. */
  polyline: string;
  /** Decoded [[lat, lng], ...] pairs, use these directly with Google Maps or any renderer. */
  coordinates: [number, number][];
  walk_steps: WalkStep[];
  /** Ordered stops for transit legs: [boarding, ...intermediate, alighting]. */
  stops?: RouteStop[];
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
}

export interface Route {
  polyline_encoding: "google";
  /** Set to true when the route was derived from the AI assistant, not a manual search. */
  is_ai_derived?: boolean;
  type: "direct" | "transfer";
  summary: string;
  total_duration: number;
  total_walk_distance: number;
  total_distance: number;
  segments: RouteSegment[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD format in the user's local timezone. */
function getLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns the current time in OTP's expected format: `hh:mmam` / `hh:mmpm`.
 * Uses Intl for correctness across locales and DST transitions.
 */
function getLocalTime(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Nairobi",
  }).formatToParts(new Date());

  const hour   = parts.find((p) => p.type === "hour")?.value   ?? "12";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const ampm = ( parts.find((p) => p.type === "dayPeriod")?.value ?? "AM" ).toLowerCase();

  return `${hour}:${minute}${ampm}`; // e.g. "02:30pm"
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const RouteService = {
  async calculateJourney(
    fromLoc: UnifiedLocation,
    toLoc: UnifiedLocation,
    maxWalkMeters?: number,
  ): Promise<Route[]> {
    const payload: Record<string, unknown> = {
      from: { lat: fromLoc.lat, lng: fromLoc.lng },
      to:   { lat: toLoc.lat,   lng: toLoc.lng   },
      date: getLocalDate(),
      time: getLocalTime(),
    };
    if (maxWalkMeters !== undefined) payload.max_walk_distance = maxWalkMeters;

    const data = await fetchApi<{ data: Route[] }>("/journey/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data ?? [];
  },
};