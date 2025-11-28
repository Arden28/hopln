// app/(tabs)/map.tsx
import StopsLayer from "@/components/app/StopsLayer"; //
import { sampleStops } from "@/data/fakeData";
import { Ionicons } from "@expo/vector-icons";
import MapboxGL from "@rnmapbox/maps";
import Constants from "expo-constants";
import * as Location from "expo-location";
import type { FeatureCollection, LineString } from "geojson";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const ORANGE = "#FF6F00";
const BLACK = "#000000";
const BG = "#F6F7F8";
const PANEL_MAX_H = Math.round(Dimensions.get("window").height * 0.6);

// Navigation thresholds (meters/deg/ms)
const STEP_ADVANCE_M = 12;
const ARRIVE_SOFT_M = 6;
const ARRIVE_HARD_M = 3;

// Camera throttle + smoothing
const CAM_MIN_MOVE_M = 3.5;
const CAM_MIN_HEADING_DEG = 10;
const CAM_MIN_INTERVAL_MS = 320;

// Low-pass smoothing (0..1), higher = snappier
const EMA_LOC = 0.25;
const EMA_SPD = 0.35;
const EMA_HEAD = 0.30;

// Zoom behavior during nav
const NAV_ZOOM_BASE = 18.0;
const NAV_ZOOM_DELTA = 0.15; // +/- by speed
const NAV_ZOOM_SPD_MAX = 2.0;

// Rebase / step-passing logic
const PASS_HYSTERESIS_M = 6;
const PASS_MIN_CLOSE_M = 25;
const REBASE_INTERVAL_MS = 4000;

const extra = (Constants?.expoConfig?.extra ?? {}) as any;
const MAPBOX_TOKEN =
  (process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string) ||
  (extra.mapboxToken as string) ||
  "pk.YOUR_PUBLIC_TOKEN_HERE";

const USE_STOCK_STYLE = true;
const CUSTOM_STYLE_URL = "mapbox://styles/<your-username>/<your-style-id>";
const STYLE = USE_STOCK_STYLE ? MapboxGL.StyleURL.Street : CUSTOM_STYLE_URL;

MapboxGL.setAccessToken(MAPBOX_TOKEN);

// Optional logging
try {
  // @ts-ignore
  if (MapboxGL?.Logger?.setLogCallback) {
    // @ts-ignore
    MapboxGL.Logger.setLogCallback((log: any) => {
      if (log.level === "error" || log.level === "warning") {
        console.warn("[Mapbox]", log.message);
      }
    });
  }
} catch {}

type Coords = { latitude: number; longitude: number; heading?: number; speed?: number };
type Stop = { id: string; name: string; lat: number; lng: number };
type RouteInfo = { distance: number; duration: number };
type Step = {
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

export default function MapScreen() {
  // ── All hooks at the very top ────────────────────────────────────────────
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [me, _setMe] = useState<Coords | null>(null);
  const meRef = useRef<Coords | null>(null);
  const setMe = (c: Coords | null) => { meRef.current = c; _setMe(c); };

  const [followMe, setFollowMe] = useState(true);
  const [selected, setSelected] = useState<Stop | null>(null);

  const [routeFC, setRouteFC] = useState<FeatureCollection<LineString> | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [nextStepIdx, setNextStepIdx] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const navRef = useRef(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [arrivalSoonShown, setArrivalSoonShown] = useState(false);

  const [nearestOpen, setNearestOpen] = useState(false);

  // Search UI state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastCamUpdate = useRef<number>(0);
  const lastCamBearing = useRef<number>(0);
  const fetchedForStopId = useRef<string | null>(null);

  // Smoothing state
  const meSmoothRef = useRef<Coords | null>(null);
  const lastRebaseTsRef = useRef<number>(0);
  const stepMinDistRef = useRef<number>(Infinity);
  const stepMinTsRef = useRef<number>(0);

  // Viewport state (drives progressive stops & zoom guard)
  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewZoom, setViewZoom] = useState<number>(13);
  const lastViewStateTsRef = useRef<number>(0);
  const camZoomRef = useRef<number>(13); // guard to prevent auto zoom-out

  // Map viewport state (for progressive stops)
  const [mapZoom, setMapZoom] = useState(13);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);


  // ── helpers ──────────────────────────────────────────────────────────────
  function clearRoute() {
    setRouteFC(null);
    setRouteInfo(null);
    setSteps([]);
    setNextStepIdx(0);
    setArrivalSoonShown(false);
    stepMinDistRef.current = Infinity;
    stepMinTsRef.current = 0;
    lastRebaseTsRef.current = 0;
  }
  function defaultCamera() {
    if (!meSmoothRef.current) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [meSmoothRef.current.longitude, meSmoothRef.current.latitude],
      zoomLevel: 15.5,
      // bearing: 0,
      pitch: 0,
      animationDuration: 450,
    });
    setFollowMe(false);
  }
  function zoomToStop(stop: Stop) {
    cameraRef.current?.setCamera({
      centerCoordinate: [stop.lng, stop.lat],
      zoomLevel: 17.2,
      // bearing: 0,
      pitch: 0,
      animationDuration: 500,
      // @ts-ignore
      padding: { paddingTop: 40, paddingRight: 40, paddingBottom: 200, paddingLeft: 40 },
    });
  }

  // Camera change handler (throttled)
  function handleCamera(e: any) {
    const props = e?.properties ?? {};

    // If the user manually pans/zooms (and we’re not navigating), stop following
    const userMoved = (props.isUserInteraction ?? props.isGesture ?? false) && !navRef.current;
    if (userMoved) setFollowMe(false);

    // Zoom (RNMapbox sends zoom or zoomLevel depending on platform)
    const z = typeof props.zoom === "number"
      ? props.zoom
      : typeof props.zoomLevel === "number"
      ? props.zoomLevel
      : undefined;
    if (typeof z === "number") setMapZoom(z);

    // Center (prefer props.center, fallback to event geometry)
    const c =
      (Array.isArray(props.center) && props.center) ||
      (Array.isArray(e?.geometry?.coordinates) && e.geometry.coordinates) ||
      null;
    if (c) setMapCenter({ latitude: c[1], longitude: c[0] });
  }

  // EMA smoothing
  function ema(prev: number, next: number, a: number) { return prev + a * (next - prev); }
  function updateFiltered(incoming: Coords): Coords {
    const p = meSmoothRef.current;
    if (!p) {
      const seeded: Coords = {
        latitude: incoming.latitude,
        longitude: incoming.longitude,
        heading: incoming.heading ?? 0,
        speed: incoming.speed ?? 0,
      };
      meSmoothRef.current = seeded;
      return seeded;
    }
    const lat = ema(p.latitude, incoming.latitude, EMA_LOC);
    const lng = ema(p.longitude, incoming.longitude, EMA_LOC);
    let h0 = p.heading ?? 0;
    let h1 = incoming.heading ?? h0;
    let dh = ((h1 - h0 + 540) % 360) - 180;
    const heading = (h0 + EMA_HEAD * dh + 360) % 360;
    const speed = ema(p.speed ?? 0, incoming.speed ?? 0, EMA_SPD);
    const out: Coords = { latitude: lat, longitude: lng, heading, speed };
    meSmoothRef.current = out;
    return out;
  }

  // permission + single stable watch
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      setHasPerm(status === "granted");
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted) return;
        const seed: Coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading ?? 0,
          speed: pos.coords.speed ?? 0,
        };
        updateFiltered(seed);
        setMe(seed);

        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
          (loc) => {
            const next: Coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: (loc.coords.heading ?? meRef.current?.heading ?? 0),
              speed: loc.coords.speed ?? 0,
            };
            const sm = updateFiltered(next);
            if (navRef.current) handleNavUpdate(sm);
            setMe(next);
          }
        );
      }
    })();
    return () => { mounted = false; watchRef.current?.remove(); };
  }, []);

  // Distance helper
  function dMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371e3;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const la1 = toRad(a.latitude);
    const la2 = toRad(b.latitude);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function sumLineDistanceMeters(coords: number[][]) {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      total += dMeters({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 });
    }
    return total;
  }
  function fallbackInfoBetween(from: Coords, to: Stop, walkMps = 1.35): RouteInfo {
    const distance = dMeters(from, { latitude: to.lat, longitude: to.lng });
    const duration = distance / walkMps;
    return { distance, duration };
  }

  // nearest (top 5) — uses smoothed position
  const nearest = useMemo(() => {
    if (!meSmoothRef.current) return [];
    const meS = meSmoothRef.current;
    return [...sampleStops]
      .map((s) => ({ ...s, dist: dMeters(meS, { latitude: s.lat, longitude: s.lng }) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
  }, [me]);

  // SEARCH RESULTS
  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    let arr = [...sampleStops];
    if (q.length > 0) arr = arr.filter((s) => s.name.toLowerCase().includes(q));
    const meS = meSmoothRef.current;
    arr.sort((a, b) => {
      const ai = a.name.toLowerCase().indexOf(q);
      const bi = b.name.toLowerCase().indexOf(q);
      const aScore = ai === -1 ? 999 : ai;
      const bScore = bi === -1 ? 999 : bi;
      if (aScore !== bScore) return aScore - bScore;
      if (meS) {
        const da = dMeters(meS, { latitude: a.lat, longitude: a.lng });
        const db = dMeters(meS, { latitude: b.lat, longitude: b.lng });
        return da - db;
      }
      return 0;
    });
    return arr.slice(0, 10);
  }, [searchQ, me]);

  // Camera follow during navigation — stable, no auto zoom-out
  function handleNavUpdate(nextSmoothed: Coords) {
    if (selected) {
      const destDist = dMeters(nextSmoothed, { latitude: selected.lat, longitude: selected.lng });
      if (destDist <= ARRIVE_HARD_M) {
        navRef.current = false;
        setNavigating(false);
      } else if (destDist <= ARRIVE_SOFT_M && !arrivalSoonShown) {
        setArrivalSoonShown(true);
      }
    }

    if (steps.length > 0 && nextStepIdx < steps.length) {
      const now = Date.now();
      const curr = steps[nextStepIdx];
      const currDist = dMeters(nextSmoothed, { latitude: curr.location[1], longitude: curr.location[0] });

      if (currDist < stepMinDistRef.current) {
        stepMinDistRef.current = currDist;
        stepMinTsRef.current = now;
      }

      let shouldAdvance = currDist <= STEP_ADVANCE_M;
      const closeBefore = stepMinDistRef.current <= PASS_MIN_CLOSE_M;
      const movingAway = currDist > stepMinDistRef.current + PASS_HYSTERESIS_M && (now - stepMinTsRef.current) > 1000;
      if (!shouldAdvance && closeBefore && movingAway) shouldAdvance = true;

      if (!shouldAdvance && nextStepIdx + 1 < steps.length) {
        const nxt = steps[nextStepIdx + 1];
        const nextDist = dMeters(nextSmoothed, { latitude: nxt.location[1], longitude: nxt.location[0] });
        if (nextDist + 8 < currDist) shouldAdvance = true;
      }

      if (shouldAdvance) {
        setNextStepIdx((i) => {
          const ni = Math.min(i + 1, steps.length - 1);
          stepMinDistRef.current = Infinity;
          stepMinTsRef.current = now;
          return ni;
        });
      } else if (now - lastRebaseTsRef.current > REBASE_INTERVAL_MS) {
        let bestIdx = nextStepIdx;
        let bestDist = currDist;
        for (let i = nextStepIdx; i < steps.length; i++) {
          const st = steps[i];
          const d = dMeters(nextSmoothed, { latitude: st.location[1], longitude: st.location[0] });
          if (d < bestDist - 8) { bestDist = d; bestIdx = i; }
        }
        if (bestIdx !== nextStepIdx) {
          setNextStepIdx(bestIdx);
          stepMinDistRef.current = bestDist;
          stepMinTsRef.current = now;
        }
        lastRebaseTsRef.current = now;
      }
    }

    const now = Date.now();
    if (now - lastCamUpdate.current < CAM_MIN_INTERVAL_MS) return;

    const spd = Math.max(0, Math.min(nextSmoothed.speed ?? 0, NAV_ZOOM_SPD_MAX));
    const targetZoom = NAV_ZOOM_BASE + (spd / NAV_ZOOM_SPD_MAX) * NAV_ZOOM_DELTA;

    // No auto zoom-out
    const currentZ = camZoomRef.current ?? targetZoom;
    const safeZoom = Math.max(currentZ, targetZoom);

    const prev = meSmoothRef.current;
    const movedEnough = !prev || dMeters(nextSmoothed, prev) >= CAM_MIN_MOVE_M;

    const heading = Number.isFinite(nextSmoothed.heading || NaN) ? (nextSmoothed.heading as number) : lastCamBearing.current;
    const headingChanged = Math.abs(((heading - lastCamBearing.current + 540) % 360) - 180) >= CAM_MIN_HEADING_DEG;

    if (movedEnough || headingChanged) {
      cameraRef.current?.setCamera({
        centerCoordinate: [nextSmoothed.longitude, nextSmoothed.latitude],
        zoomLevel: safeZoom,
        // bearing: heading,
        pitch: 45,
        animationDuration: 300,
      });
      lastCamUpdate.current = now;
      lastCamBearing.current = heading;
    }
  }

  // Fetch route once per newly selected stop
  useEffect(() => {
    if (!selected || !meSmoothRef.current) return;
    if (fetchedForStopId.current === selected.id) return;
    fetchedForStopId.current = selected.id;
    fetchWalkingRoute(meSmoothRef.current, selected);
  }, [selected]);

  function onStopPress(e: any) {
    const props = e?.features?.[0]?.properties;
    if (!props?.id) return;
    const found = sampleStops.find((s) => s.id === props.id);
    if (!found) return;

    navRef.current = false;
    setNavigating(false);
    setFollowMe(false);
    setArrivalSoonShown(false);
    setNextStepIdx(0);
    stepMinDistRef.current = Infinity;
    stepMinTsRef.current = 0;

    setSelected(found);
    setNearestOpen(false);
    setStepsOpen(false);

    zoomToStop(found);
  }

  async function fetchWalkingRoute(from: Coords, to: Stop) {
    if (!from) return;
    setRouteLoading(true);
    clearRoute();
    try {
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/walking/${from.longitude},${from.latitude};${to.lng},${to.lat}` +
        `?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json?.routes?.length) throw new Error(json?.message || "No walking route");

      const route = json.routes[0];
      const leg = route?.legs?.[0];
      const coords = route?.geometry?.coordinates as number[][] | undefined;

      if (Array.isArray(coords) && coords.length > 1) {
        const fc: FeatureCollection<LineString> = {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }],
        };
        setRouteFC(fc);

        const distance = typeof route.distance === "number" ? route.distance : sumLineDistanceMeters(coords);
        const duration = typeof route.duration === "number" ? route.duration : distance / 1.35;
        setRouteInfo({ distance, duration });

        const [minLng, minLat, maxLng, maxLat] = bboxFromCoords(coords);
        try {
          cameraRef.current?.fitBounds([maxLng, maxLat], [minLng, minLat], 40, 200, 730);
        } catch {
          const midLng = (minLng + maxLng) / 2, midLat = (minLat + maxLat) / 2;
          cameraRef.current?.setCamera({ centerCoordinate: [midLng, midLat], zoomLevel: 16.8, animationDuration: 600 });
        }
      } else {
        const fc: FeatureCollection<LineString> = {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [[from.longitude, from.latitude], [to.lng, to.lat]] }
          }],
        };
        setRouteFC(fc);
        setRouteInfo(fallbackInfoBetween(from, to));
        cameraRef.current?.setCamera({ centerCoordinate: [to.lng, to.lat], zoomLevel: 17.2, animationDuration: 600 });
      }

      if (leg?.steps?.length) {
        const ss: Step[] = leg.steps.map((st: any) => ({
          instruction: st.maneuver?.instruction ?? undefined,
          name: st.name ?? undefined,
          distance: st.distance ?? 0,
          duration: st.duration ?? 0,
          location: (st.maneuver?.location as [number, number]) ?? [to.lng, to.lat],
          type: st.maneuver?.type,
          modifier: st.maneuver?.modifier,
          bearing_after: st.maneuver?.bearing_after,
          exit: st.maneuver?.exit,
        }));
        setSteps(ss);

        if (meSmoothRef.current && ss.length > 0) {
          const meS = meSmoothRef.current;
          let bestIdx = 0, best = Infinity;
          for (let i = 0; i < ss.length; i++) {
            const d = dMeters(meS, { latitude: ss[i].location[1], longitude: ss[i].location[0] });
            if (d < best) { best = d; bestIdx = i; }
          }
          setNextStepIdx(bestIdx);
          stepMinDistRef.current = best;
          stepMinTsRef.current = Date.now();
        }
      } else {
        const approx = fallbackInfoBetween(from, to);
        setSteps([{
          instruction: `Walk to ${to.name}`,
          distance: approx.distance,
          duration: approx.duration,
          location: [to.lng, to.lat],
          type: "arrive",
        }]);
      }
    } catch {
      const fc: FeatureCollection<LineString> = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [[from.longitude, from.latitude], [to.lng, to.lat]] }
        }],
      };
      setRouteFC(fc);
      const approx = fallbackInfoBetween(from, to);
      setRouteInfo(approx);
      setSteps([{
        instruction: `Walk to ${to.name}`,
        distance: approx.distance,
        duration: approx.duration,
        location: [to.lng, to.lat],
        type: "arrive",
      }]);
    } finally {
      setRouteLoading(false);
    }
  }

  function bboxFromCoords(coords: number[][]): [number, number, number, number] {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
    return [minLng, minLat, maxLng, maxLat];
  }

  function recenter() {
    if (!meSmoothRef.current) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [meSmoothRef.current.longitude, meSmoothRef.current.latitude],
      zoomLevel: 16,
      bearing: meSmoothRef.current.heading ?? 0,
      pitch: 30,
      animationDuration: 450,
    });
    setFollowMe(true);
  }

  // Track viewport (debounced) to drive StopsLayer & zoom guard
  function onCameraChanged(e: any) {
    const z: number | undefined = e?.properties?.zoom;
    const center: [number, number] | undefined = e?.properties?.center;
    if (!z || !center) return;

    camZoomRef.current = z;

    const now = Date.now();
    if (now - (lastViewStateTsRef.current || 0) < 400) return; // <- a bit stronger than before
    lastViewStateTsRef.current = now;

    const [lng, lat] = center;
    setViewZoom(z);
    setViewCenter({ lat, lng });
  }

  // NEXT-STEP banner
  const nextStep = steps[nextStepIdx];
  const nextPreview =
    nextStep && selected
      ? humanizeStep(nextStep, nextStepIdx, nextStepIdx === steps.length - 1, selected.name)
      : null;

  function bearingToCardinal(bearing?: number) {
    if (bearing == null || isNaN(bearing)) return "forward";
    const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
    const idx = Math.round(bearing / 45) % 8;
    return dirs[idx];
  }
  function mToNice(m: number) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }
  function sToMin(s: number) {
    if (!s) return "";
    const min = Math.round(s / 60);
    return min <= 1 ? "~1 min" : `~${min} min`;
  }
  function ordinalSuffix(n: number) {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }
  function humanizeStep(st: Step, i: number, last: boolean, stopName: string) {
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
        if (st.modifier === "left" || st.modifier === "slight left" || st.modifier === "sharp left") return `Turn left${road}.`;
        if (st.modifier === "right" || st.modifier === "slight right" || st.modifier === "sharp right") return `Turn right${road}.`;
        if (st.modifier === "uturn") return `Make a U-turn${road}.`;
        return `Continue straight${road}.`;
      case "new name":
        return `Continue on ${st.name ?? "the path"}.`;
      case "roundabout":
        return st.exit
          ? `At the roundabout, take the ${st.exit}${ordinalSuffix(st.exit)} exit${road}.`
          : `At the roundabout, continue${road}.`;
      default:
        return `Continue${road}.`;
    }
  }
  function stepIcon(t?: string, m?: string): keyof typeof Ionicons.glyphMap {
    if (t === "arrive") return "location-outline";
    if (t === "depart" || t === "start") return "navigate-outline";
    if (t === "roundabout") return "sync-outline";
    if (t === "turn") {
      if (m === "left" || m === "slight left" || m === "sharp left") return "arrow-undo-outline";
      if (m === "right" || m === "slight right" || m === "sharp right") return "arrow-redo-outline";
      if (m === "uturn") return "refresh-outline";
      return "arrow-up-outline";
    }
    if (t === "new name") return "compass-outline";
    return "walk-outline";
  }

  // ── Single return path ───────────────────────────────────────────────────
  const initial = me ?? { latitude: -1.286389, longitude: 36.817223, heading: 0, speed: 0 };

  let screen: JSX.Element;
  if (hasPerm === null) {
    screen = <View style={styles.center}><ActivityIndicator /></View>;
  } else if (!hasPerm) {
    screen = (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={styles.title}>Location permission needed</Text>
        <Text style={styles.sub}>Enable location to see nearby stages and board faster.</Text>
      </View>
    );
  } else {
    screen = (
      <>
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={STYLE}
          onRegionIsChanging={() => { if (!navRef.current) setFollowMe(false); }}
          onCameraChanged={onCameraChanged} // drives progressive stops + zoom guard
          onMapLoadingError={() => console.warn("onMapLoadingError (style failed to load)")}
          onMapError={() => console.warn("onMapError")}
          compassEnabled
          logoEnabled={false}
          scaleBarEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={[initial.longitude, initial.latitude]}
            zoomLevel={13}
            followUserLocation={followMe}
            followUserMode={MapboxGL.UserTrackingModes.Follow}
          />

          {/* Register stop icon */}
          <MapboxGL.Images images={{ "matatu-pin": require("@/assets/images/matatu.png") }} />

          <MapboxGL.UserLocation showsUserHeadingIndicator />

          {/* Walking route layer */}
          {routeFC && (
            <MapboxGL.ShapeSource id="route" shape={routeFC}>
              <MapboxGL.LineLayer
                id="route-line"
                style={{ lineColor: ORANGE, lineWidth: 4, lineOpacity: 0.9, lineJoin: "round", lineCap: "round", lineDasharray: [2, 2] }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* Stops — split out + optimized */}
          <StopsLayer
            allStops={sampleStops}
            viewCenter={viewCenter}
            viewZoom={viewZoom}
            selected={selected}
            onPress={onStopPress}
          />
        </MapboxGL.MapView>

        {/* Recenter */}
        <Pressable onPress={recenter} style={styles.recenter} accessibilityRole="button">
          <Ionicons name="locate-outline" size={22} color={BLACK} />
        </Pressable>

        {/* Search button */}
        <Pressable
          onPress={() => { setSearchOpen(true); setSearchQ(""); }}
          style={styles.searchFab}
          accessibilityRole="button"
          accessibilityLabel="Search stops"
        >
          <Ionicons name="search-outline" size={22} color={BLACK} />
        </Pressable>

        {/* Compact navigation banner */}
        {navigating && nextPreview && (
          <View style={styles.navBanner}>
            <Ionicons name={stepIcon(nextStep?.type, nextStep?.modifier)} size={18} color={BLACK} />
            <Text numberOfLines={1} style={styles.navBannerText}>{nextPreview}</Text>
          </View>
        )}

        {/* Arrival soon pill */}
        {navigating && arrivalSoonShown && (
          <View style={styles.arrivalPill}>
            <Ionicons name="location-outline" size={16} color={BLACK} />
            <Text style={{ color: BLACK, fontWeight: "600" }}>You’re here — almost</Text>
          </View>
        )}

        {/* Nearest FAB */}
        {!selected && (
          <Pressable
            onPress={() => setNearestOpen((v) => !v)}
            style={styles.nearestFab}
            accessibilityRole="button"
            accessibilityLabel="Show nearest stages"
          >
            <Ionicons name="walk-outline" size={20} color="#fff" />
            {me && nearest.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{nearest.length}</Text>
              </View>
            )}
          </Pressable>
        )}

        {/* Nearest sheet */}
        {!selected && nearestOpen && (
          <View style={[styles.sheet, { maxHeight: PANEL_MAX_H }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.panelTitle}>Nearest stages</Text>
              <Pressable onPress={() => setNearestOpen(false)}>
                <Ionicons name="close-outline" size={22} color={BLACK} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingTop: 6 }}>
              {(!me || nearest.length === 0) ? (
                <Text style={styles.sub}>Finding nearby stages…</Text>
              ) : (
                nearest.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.nearRow}
                    onPress={() => {
                      navRef.current = false;
                      setNavigating(false);
                      clearRoute();
                      setSelected(s as Stop);
                      setNearestOpen(false);
                      zoomToStop(s as Stop);
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="bus-outline" size={16} color={BLACK} />
                      <Text style={styles.nearName}>{s.name}</Text>
                    </View>
                    <Text style={styles.nearDist}>
                      {(s as any).dist < 1000 ? `${Math.round((s as any).dist)}m` : `${((s as any).dist / 1000).toFixed(1)}km`}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* Selected stop sheet (collapsible steps) */}
        {selected && (
          <View style={[styles.panel, { maxHeight: PANEL_MAX_H }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.panelTitle}>{selected.name}</Text>
              <Pressable
                onPress={() => {
                  navRef.current = false;
                  setNavigating(false);
                  clearRoute();
                  setSelected(null);
                  defaultCamera();
                }}
              >
                <Ionicons name="close-outline" size={22} color={BLACK} />
              </Pressable>
            </View>

            {routeLoading ? (
              <Text style={styles.sub}>Fetching walking route…</Text>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 12, paddingTop: 4 }}>
                {/* summary */}
                <View style={styles.row}>
                  <Ionicons name="walk-outline" size={16} color={BLACK} />
                  <Text style={styles.rowText}>
                    {routeInfo ? `${mToNice(routeInfo.distance)} • ${sToMin(routeInfo.duration)}` : "Approximate path shown"}
                  </Text>
                </View>

                {/* actions */}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.pill, { backgroundColor: ORANGE }]}
                    onPress={() => {
                      const next = !navigating;
                      navRef.current = next;
                      setNavigating(next);
                      if (next) {
                        setFollowMe(true);
                        lastCamUpdate.current = 0;
                        if (meSmoothRef.current && steps.length > 0) {
                          const meS = meSmoothRef.current;
                          let bestIdx = 0, best = Infinity;
                          for (let i = 0; i < steps.length; i++) {
                            const d = dMeters(meS, { latitude: steps[i].location[1], longitude: steps[i].location[0] });
                            if (d < best) { best = d; bestIdx = i; }
                          }
                          setNextStepIdx(bestIdx);
                          stepMinDistRef.current = best;
                          stepMinTsRef.current = Date.now();
                        }
                        if (meSmoothRef.current) {
                          cameraRef.current?.setCamera({
                            centerCoordinate: [meSmoothRef.current.longitude, meSmoothRef.current.latitude],
                            zoomLevel: NAV_ZOOM_BASE,
                            // bearing: meSmoothRef.current.heading ?? 0,
                            pitch: 45,
                            animationDuration: 250,
                          });
                        }
                      } else {
                        setFollowMe(false);
                        if (selected) zoomToStop(selected);
                      }
                    }}
                  >
                    <Text style={styles.pillTextLight}>{navigating ? "Stop" : "Start"}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pill, styles.pillOutline]}
                    onPress={() => {
                      navRef.current = false;
                      setNavigating(false);
                      clearRoute();
                      setSelected(null);
                      defaultCamera();
                    }}
                  >
                    <Text style={styles.pillTextDark}>Close</Text>
                  </Pressable>
                </View>

                {/* Steps (collapsible) */}
                {steps.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Pressable onPress={() => setStepsOpen((v) => !v)} style={styles.stepsHeader} accessibilityRole="button">
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Ionicons name="list-outline" size={18} color={BLACK} />
                        <Text style={{ color: BLACK, fontWeight: "600" }}>Steps ({steps.length})</Text>
                        {!stepsOpen && nextPreview && (
                          <Text numberOfLines={1} style={{ color: "#6B7280", marginLeft: 8, flexShrink: 1 }}>
                            {nextPreview}
                          </Text>
                        )}
                      </View>
                      <Ionicons name={stepsOpen ? "chevron-up-outline" : "chevron-down-outline"} size={18} color={BLACK} />
                    </Pressable>

                    {stepsOpen && (
                      <View style={{ gap: 6 }}>
                        {steps.map((st, i) => {
                          const isLast = i === steps.length - 1;
                          const text = humanizeStep(st, i, isLast, selected.name);
                          const active = i === nextStepIdx && navigating;
                          return (
                            <View key={i} style={[styles.stepRow, active && { backgroundColor: "#FFF", borderRadius: 8 }]}>
                              <Ionicons name={stepIcon(st.type, st.modifier)} size={18} color={BLACK} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: BLACK }}>
                                  <Text style={{ fontWeight: "700" }}>{i === 0 ? "From your location: " : ""}</Text>
                                  {text}
                                </Text>
                                <Text style={{ color: "#6B7280", marginTop: 2 }}>
                                  {mToNice(st.distance)} {st.duration ? `• ${sToMin(st.duration)}` : ""}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                        {steps[steps.length - 1]?.type === "arrive" && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Ionicons name="location-outline" size={16} color={BLACK} />
                            <Text style={styles.sub}>
                              At the destination, the stage is likely on your{" "}
                              <Text style={{ fontWeight: "600", color: BLACK }}>{steps[steps.length - 1]?.modifier ?? "side"}</Text>.
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {/* SEARCH OVERLAY */}
        {searchOpen && (
          <>
            <Pressable style={styles.backdrop} onPress={() => setSearchOpen(false)} />
            <View style={styles.searchCard}>
              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={18} color={BLACK} />
                <TextInput
                  autoFocus
                  placeholder="Search stops"
                  placeholderTextColor="#9CA3AF"
                  value={searchQ}
                  onChangeText={setSearchQ}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {searchQ.length > 0 && (
                  <Pressable onPress={() => setSearchQ("")} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={18} color="#6B7280" />
                  </Pressable>
                )}
              </View>

              <ScrollView style={{ maxHeight: 260 }}>
                {searchResults.length === 0 ? (
                  <Text style={[styles.sub, { paddingVertical: 8 }]}>No results</Text>
                ) : (
                  searchResults.map((s) => (
                    <Pressable
                      key={s.id}
                      style={styles.searchResult}
                      onPress={() => {
                        navRef.current = false;
                        setNavigating(false);
                        clearRoute();
                        setSelected(s);
                        zoomToStop(s);
                        setSearchOpen(false);
                        setStepsOpen(false);
                      }}
                    >
                      <Ionicons name="bus-outline" size={16} color={BLACK} />
                      <Text style={{ color: BLACK, flex: 1 }} numberOfLines={1}>{s.name}</Text>
                      {meSmoothRef.current && (
                        <Text style={{ color: "#6B7280", marginLeft: 8 }}>
                          {(() => {
                            const d = dMeters(meSmoothRef.current!, { latitude: s.lat, longitude: s.lng });
                            return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
                          })()}
                        </Text>
                      )}
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </>
        )}
      </>
    );
  }

  return <View style={{ flex: 1, backgroundColor: BG }}>{screen}</View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  title: { fontSize: 18, fontWeight: "700", color: BLACK },
  sub: { color: "#6B7280", textAlign: "left" },

  recenter: {
    position: "absolute",
    top: 80,
    right: 5,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  searchFab: {
    position: "absolute",
    top: 136,
    right: 5,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },

  navBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  navBannerText: { color: BLACK, flexShrink: 1 },

  arrivalPill: {
    position: "absolute",
    top: 60,
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FED7AA",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  nearestFab: {
    position: "absolute",
    left: 16,
    bottom: 16 + 64,
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  sheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: BG,
    borderRadius: 14,
    padding: 14,
  },
  panel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: BG,
    borderRadius: 14,
    padding: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  panelTitle: { color: BLACK, fontSize: 16, fontWeight: "700" },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowText: { color: BLACK },

  actions: { marginTop: 2, flexDirection: "row", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  pillOutline: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  pillTextLight: { color: "#FFFFFF", fontWeight: "700" },
  pillTextDark: { color: BLACK, fontWeight: "700" },

  nearRow: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nearName: { color: BLACK },
  nearDist: { color: "#6B7280" },

  stepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.15)",
  },
  searchCard: {
    position: "absolute",
    top: 88,
    right: 72,
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: BLACK,
    paddingVertical: 0,
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
});
