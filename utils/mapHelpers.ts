// utils/mapHelpers.ts
import { Ionicons } from "@expo/vector-icons";

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
  dist?: number; // Optional, useful for nearest sorting
};

export type RouteInfo = {
  distance: number;
  duration: number;
};

export type Step = {
  instruction?: string;
  name?: string;
  distance: number;
  duration: number;
  location: [number, number];
  type?: string;
  modifier?: string;
  bearing_after?: number;
  exit?: number;
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

export function bearingToCardinal(bearing?: number) {
  if (bearing == null || isNaN(bearing)) return "forward";
  const dirs = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ];
  const idx = Math.round(bearing / 45) % 8;
  return dirs[idx];
}

export function mToNice(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function sToMin(s: number) {
  if (!s) return "";
  const min = Math.round(s / 60);
  return min <= 1 ? "~1 min" : `~${min} min`;
}

export function ordinalSuffix(n: number) {
  const j = n % 10,
    k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function humanizeStep(
  st: Step,
  i: number,
  last: boolean,
  stopName: string,
) {
  if (st.type === "arrive") {
    const side = st.modifier ? ` on your ${st.modifier}` : "";
    return `Arrive at ${stopName}${side}.`;
  }
  if (st.instruction) return st.instruction;
  const road = st.name ? ` onto ${st.name}` : "";
  const dir = bearingToCardinal(st.bearing_after);
  switch (st.type) {
    case "depart":
    case "start":
      return `Head ${dir}${st.name ? ` on ${st.name}` : ""}.`;
    case "turn":
      if (
        st.modifier === "left" ||
        st.modifier === "slight left" ||
        st.modifier === "sharp left"
      )
        return `Turn left${road}.`;
      if (
        st.modifier === "right" ||
        st.modifier === "slight right" ||
        st.modifier === "sharp right"
      )
        return `Turn right${road}.`;
      if (st.modifier === "uturn") return `Make a U-turn${road}.`;
      return `Continue straight${road}.`;
    case "new name":
      return `Continue on ${st.name ?? "the path"}.`;
    case "roundabout":
      return st.exit
        ? `At the roundabout, take the ${st.exit}${ordinalSuffix(
            st.exit,
          )} exit${road}.`
        : `At the roundabout, continue${road}.`;
    default:
      return `Continue${road}.`;
  }
}

export function stepIcon(
  t?: string,
  m?: string,
): keyof typeof Ionicons.glyphMap {
  if (t === "arrive") return "location-outline";
  if (t === "depart" || t === "start") return "navigate-outline";
  if (t === "roundabout") return "sync-outline";
  if (t === "turn") {
    if (m === "left" || m === "slight left" || m === "sharp left")
      return "arrow-undo-outline";
    if (m === "right" || m === "slight right" || m === "sharp right")
      return "arrow-redo-outline";
    if (m === "uturn") return "refresh-outline";
    return "arrow-up-outline";
  }
  if (t === "new name") return "compass-outline";
  return "walk-outline";
}
