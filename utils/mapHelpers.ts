// utils/mapHelpers.ts
import { Ionicons } from "@expo/vector-icons";
import type { RouteSegment } from "@/services/route";

export type Coords = {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
};

export type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  dist?: number;
  route_nams?: string | null;
  location_t?: number;
};

export type RouteInfo = {
  distance: number;
  duration: number;
};

export type Maneuver =
  | "straight" | "turn-left" | "turn-right"
  | "slight-left" | "slight-right" | "u-turn" | "start";

export type WalkSubStep = {
  instruction: string;
  note?: string;
  distance: number;
  duration: number;
  lat: number;
  lng: number;
  maneuver: Maneuver;
};

export type RouteStop = { name: string; lat: number; lng: number };

export type Step = {
  instruction?: string;
  name?: string;
  distance: number;
  duration: number;
  location: [number, number];
  type?: "walk" | "depart" | "arrive" | string;
  subSteps?: WalkSubStep[];
  routeName?: string;
  routeColor?: string;
  /** Ordered stops for transit depart steps: [boarding, ...intermediate, alighting]. */
  stops?: RouteStop[];
};

export function dMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function sumLineDistanceMeters(coords: number[][]) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    total += dMeters(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 },
    );
  }
  return total;
}

export function fallbackInfoBetween(
  from: Coords,
  to: Stop,
  walkMps = 1.35,
): RouteInfo {
  const distance = dMeters(from, { latitude: to.lat, longitude: to.lng });
  const duration = distance / walkMps;
  return { distance, duration };
}

export function bboxFromCoords(
  coords: number[][],
): [number, number, number, number] {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  coords.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  });
  return [minLng, minLat, maxLng, maxLat];
}

export function mToNice(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function sToMin(s: number) {
  if (!s) return "";
  const min = Math.round(s / 60);
  return min <= 1 ? "~1 min" : `~${min} min`;
}

export function humanizeStep(st: Step) {
  // We've pre-formatted the instructions beautifully in map.tsx, 
  // so we just return them directly!
  if (st.instruction) return st.instruction;
  return `Continue`;
}

export function stepIcon(t?: string): keyof typeof Ionicons.glyphMap {
  if (t === "arrive") return "location-outline";
  if (t === "depart") return "bus-outline";
  if (t === "walk")   return "walk-outline";
  return "ellipse-outline";
}

export function detectManeuver(instruction: string): Maneuver {
  const s = instruction.toLowerCase();
  if (s.includes("u-turn"))                             return "u-turn";
  if (s.includes("slight left") || s.includes("keep left"))  return "slight-left";
  if (s.includes("slight right") || s.includes("keep right")) return "slight-right";
  if (s.includes("turn left")  || s.includes("left"))  return "turn-left";
  if (s.includes("turn right") || s.includes("right")) return "turn-right";
  return "straight";
}

export function maneuverIcon(m: Maneuver): keyof typeof Ionicons.glyphMap {
  switch (m) {
    case "turn-left":    return "arrow-back-outline";
    case "turn-right":   return "arrow-forward-outline";
    case "slight-left":  return "arrow-back-outline";
    case "slight-right": return "arrow-forward-outline";
    case "u-turn":       return "return-down-back-outline";
    case "start":        return "navigate-outline";
    default:             return "arrow-up-outline";
  }
}

/**
 * Generates a consistent, highly distinct, and vibrant HEX color from a route name.
 */
export function getRouteColor(routeName: string): string {
  if (!routeName) return "#FF6F00"; 
  let hash = 0;
  for (let i = 0; i < routeName.length; i++) {
    hash = routeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 85; 
  const l = 45; 
  const lNorm = l / 100;
  const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export type FareResult =
  | {
      found:      true;
      total:      number;
      currency:   string;
      confidence: "exact" | "zone";
      breakdown:  { routeName: string; amount: number }[];
    }
  | { found: false };

/**
 * Extracts server-resolved fare data from journey segments.
 * Returns found:false when no transit segments have DB-backed fare data,
 * which the UI should display as "No fare info for this route".
 */
export function extractFares(segments: RouteSegment[]): FareResult {
  const transit = segments.filter((s) => s.mode !== "WALK");
  if (transit.length === 0) return { found: false };
  if (transit.every((s) => !s.fare)) return { found: false };

  const breakdown = transit
    .filter((s) => s.fare != null)
    .map((s) => ({ routeName: s.route_name ?? "Bus", amount: s.fare!.amount }));

  const total    = breakdown.reduce((acc, b) => acc + b.amount, 0);
  const currency = transit.find((s) => s.fare)?.fare?.currency ?? "KES";
  const confidence: "exact" | "zone" = transit.some((s) => s.fare?.confidence === "zone")
    ? "zone"
    : "exact";

  return { found: true, total, currency, confidence, breakdown };
}

export function getReportIcon(type: string) {
  switch (type) {
    case 'stage_queue':   return '🚶‍♂️';
    case 'accident':      return '💥';
    case 'police_check':  return '👮';
    case 'flooded_route': return '🌧️';
    case 'fare_hike':     return '💸';
    default:              return '⚠️';
  }
}