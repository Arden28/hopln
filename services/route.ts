import type { UnifiedLocation } from "@/store/journeyStore";
import { fetchApi } from "./apiClient";

export interface RouteSegment {
  mode: "WALK" | "BUS" | "TRAM" | "SUBWAY" | "RAIL" | "FERRY";
  duration: number;
  distance: number;
  route_name?: string;
  polyline: string;
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
}

export interface Route {
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
  ): Promise<Route[]> {
    const payload = {
      from: { lat: fromLoc.lat, lng: fromLoc.lng },
      to:   { lat: toLoc.lat,   lng: toLoc.lng   },
      date: getLocalDate(),
      // time: "02:30pm",
      time: getLocalTime(),
    };

    const data = await fetchApi<{ data: Route[] }>("/journey/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data ?? [];
  },
};