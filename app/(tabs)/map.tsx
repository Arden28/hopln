// app/(tabs)/map.tsx
import MapFloatingUI from "@/components/app/MapFloatingUI";
import NearestStopsSheet from "@/components/app/NearestStopsSheet";
import RouteStepsList from "@/components/app/RouteStepsList";
import SearchOverlay from "@/components/app/SearchOverlay";
import StopDetailsSheet from "@/components/app/StopDetailsSheet";
import StopsLayer from "@/components/app/StopsLayer";
import { sampleStops } from "@/data/fakeData";
import { useJourneyStore } from "@/store/journeyStore";
import {
  Coords,
  RouteInfo,
  Step,
  Stop,
  bboxFromCoords,
  dMeters,
  fallbackInfoBetween,
  humanizeStep,
  mToNice,
  sToMin,
  sumLineDistanceMeters,
} from "@/utils/mapHelpers";
import MapboxGL from "@rnmapbox/maps";
import Constants from "expo-constants";
import * as Location from "expo-location";
import type { FeatureCollection, LineString } from "geojson";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const ORANGE = "#FF6F00";
const BLACK = "#000000";
const BG = "#F6F7F8";

const STEP_ADVANCE_M = 12;
const ARRIVE_SOFT_M = 6;
const ARRIVE_HARD_M = 3;

const CAM_MIN_MOVE_M = 3.5;
const CAM_MIN_HEADING_DEG = 10;
const CAM_MIN_INTERVAL_MS = 320;

const EMA_LOC = 0.25;
const EMA_SPD = 0.35;
const EMA_HEAD = 0.3;

const NAV_ZOOM_BASE = 18.0;
const NAV_ZOOM_DELTA = 0.15;
const NAV_ZOOM_SPD_MAX = 2.0;

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

export default function MapScreen() {
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [me, _setMe] = useState<Coords | null>(null);
  const meRef = useRef<Coords | null>(null);
  const setMe = (c: Coords | null) => {
    meRef.current = c;
    _setMe(c);
  };

  const [followMe, setFollowMe] = useState(true);
  const [selected, setSelected] = useState<Stop | null>(null);

  const [routeFC, setRouteFC] = useState<FeatureCollection<LineString> | null>(
    null,
  );
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [nextStepIdx, setNextStepIdx] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const navRef = useRef(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [arrivalSoonShown, setArrivalSoonShown] = useState(false);

  const [nearestOpen, setNearestOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastCamUpdate = useRef<number>(0);
  const lastCamBearing = useRef<number>(0);
  const fetchedForStopId = useRef<string | null>(null);

  const meSmoothRef = useRef<Coords | null>(null);
  const lastRebaseTsRef = useRef<number>(0);
  const stepMinDistRef = useRef<number>(Infinity);
  const stepMinTsRef = useRef<number>(0);

  const [viewCenter, setViewCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [viewZoom, setViewZoom] = useState<number>(13);
  const lastViewStateTsRef = useRef<number>(0);
  const camZoomRef = useRef<number>(13);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // ── JOURNEY STORE & MULTI-LEG STATE ──
  const activeJourney = useJourneyStore((state) => state.activeJourney);
  const clearJourney = useJourneyStore((state) => state.clearJourney);
  const [walkToOriginFC, setWalkToOriginFC] =
    useState<FeatureCollection<LineString> | null>(null);
  const [transitFC, setTransitFC] =
    useState<FeatureCollection<LineString> | null>(null);

  // ── ACTIVE JOURNEY LISTENER ──
  useEffect(() => {
    if (!activeJourney) {
      setWalkToOriginFC(null);
      setTransitFC(null);
      return;
    }

    // Hide standard UI & trigger panning mode
    setSelected(null);
    setFollowMe(false);
    setRouteLoading(true);

    const fetchJourneyShapes = async () => {
      setFollowMe(false); // Stop following the user so we can pan the camera
      setRouteLoading(true);

      try {
        const me = meSmoothRef.current;
        const { fromLoc, toLoc } = activeJourney;

        // 1. Fetch Walking Leg with FULL overview for road geometry
        const walkUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${me.longitude},${me.latitude};${fromLoc.lng},${fromLoc.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
        const walkRes = await fetch(walkUrl);
        const walkJson = await walkRes.json();
        const walkCoords = walkJson.routes?.[0]?.geometry?.coordinates || [];

        // 2. Fetch Transit Leg with FULL overview
        // 'driving' is used here to snap the bus route strictly to navigable roads
        const transitUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLoc.lng},${fromLoc.lat};${toLoc.lng},${toLoc.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
        const transitRes = await fetch(transitUrl);
        const transitJson = await transitRes.json();
        const transitCoords =
          transitJson.routes?.[0]?.geometry?.coordinates || [];

        if (walkCoords.length > 0) {
          setWalkToOriginFC({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: walkCoords },
              },
            ],
          });
        }

        if (transitCoords.length > 0) {
          setTransitFC({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: transitCoords },
              },
            ],
          });
        }

        // 3. Hollywood Pan
        const allCoords = [...walkCoords, ...transitCoords];
        if (allCoords.length > 0) {
          const [minLng, minLat, maxLng, maxLat] = bboxFromCoords(allCoords);
          cameraRef.current?.fitBounds(
            [maxLng, maxLat],
            [minLng, minLat],
            [140, 40, 300, 40],
            800,
          );
        }
      } catch (err) {
        console.warn("Failed to fetch journey shapes", err);
      } finally {
        setRouteLoading(false);
      }
    };

    fetchJourneyShapes();
  }, [activeJourney]);

  function handleClearJourney() {
    clearRoute();
    clearJourney();
    setNavigating(false);
    navRef.current = false;
    defaultCamera();
  }

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
    setFollowMe(true);
  }

  function zoomToStop(stop: Stop) {
    cameraRef.current?.setCamera({
      centerCoordinate: [stop.lng, stop.lat],
      zoomLevel: 17.2,
      heading: 0,
      pitch: 0,
      animationDuration: 500,
      // @ts-ignore
      padding: {
        paddingTop: 40,
        paddingRight: 40,
        paddingBottom: 200,
        paddingLeft: 40,
      },
    });
  }

  function ema(prev: number, next: number, a: number) {
    return prev + a * (next - prev);
  }

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      setHasPerm(status === "granted");
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
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
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            const next: Coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? meRef.current?.heading ?? 0,
              speed: loc.coords.speed ?? 0,
            };
            const sm = updateFiltered(next);
            if (navRef.current) handleNavUpdate(sm);
            setMe(next);
          },
        );
      }
    })();
    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, []);

  const nearest = useMemo(() => {
    if (!meSmoothRef.current) return [];
    const meS = meSmoothRef.current;
    return [...sampleStops]
      .map((s) => ({
        ...s,
        dist: dMeters(meS, { latitude: s.lat, longitude: s.lng }),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
  }, [me]);

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

  function handleNavUpdate(nextSmoothed: Coords) {
    // ── THE TRIP ENGINE (State Machine) ──
    // We use .getState() here because handleNavUpdate is called inside a
    // Location listener callback, ensuring we never read stale React state!
    const currentJourney = useJourneyStore.getState().activeJourney;
    const currentStatus = useJourneyStore.getState().tripStatus;
    const setStatus = useJourneyStore.getState().setTripStatus;

    if (navigating && currentJourney) {
      const distToOrigin = dMeters(nextSmoothed, {
        latitude: currentJourney.fromLoc.lat,
        longitude: currentJourney.fromLoc.lng,
      });
      const distToDest = dMeters(nextSmoothed, {
        latitude: currentJourney.toLoc.lat,
        longitude: currentJourney.toLoc.lng,
      });

      // State Transition: Arrived at origin stop, now waiting for the bus
      // (Using a 40-meter radius to account for GPS drift around bus stops)
      if (currentStatus === "WAITING_FOR_BUS" && distToOrigin <= 40) {
        setStatus("IN_TRANSIT");
        console.log("Trip Engine: Boarded Bus!");
      }

      // State Transition: Reached final destination
      if (currentStatus === "IN_TRANSIT" && distToDest <= 40) {
        setStatus("ARRIVED");
        setNavigating(false); // Auto-end the navigation mode
        navRef.current = false;
        console.log("Trip Engine: Arrived at Destination!");
      }
    }

    // ── STANDARD ROUTING PASS LOGIC ──
    // Fallback logic for when you just tap a nearby stop (no full journey)
    if (selected && !currentJourney) {
      const destDist = dMeters(nextSmoothed, {
        latitude: selected.lat,
        longitude: selected.lng,
      });
      if (destDist <= ARRIVE_HARD_M) {
        navRef.current = false;
        setNavigating(false);
      } else if (destDist <= ARRIVE_SOFT_M && !arrivalSoonShown) {
        setArrivalSoonShown(true);
      }
    }

    // Step-by-step instruction passing
    if (steps.length > 0 && nextStepIdx < steps.length) {
      const now = Date.now();
      const curr = steps[nextStepIdx];
      const currDist = dMeters(nextSmoothed, {
        latitude: curr.location[1],
        longitude: curr.location[0],
      });

      if (currDist < stepMinDistRef.current) {
        stepMinDistRef.current = currDist;
        stepMinTsRef.current = now;
      }

      let shouldAdvance = currDist <= STEP_ADVANCE_M;
      const closeBefore = stepMinDistRef.current <= PASS_MIN_CLOSE_M;
      const movingAway =
        currDist > stepMinDistRef.current + PASS_HYSTERESIS_M &&
        now - stepMinTsRef.current > 1000;
      if (!shouldAdvance && closeBefore && movingAway) shouldAdvance = true;

      if (!shouldAdvance && nextStepIdx + 1 < steps.length) {
        const nxt = steps[nextStepIdx + 1];
        const nextDist = dMeters(nextSmoothed, {
          latitude: nxt.location[1],
          longitude: nxt.location[0],
        });
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
          const d = dMeters(nextSmoothed, {
            latitude: st.location[1],
            longitude: st.location[0],
          });
          if (d < bestDist - 8) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx !== nextStepIdx) {
          setNextStepIdx(bestIdx);
          stepMinDistRef.current = bestDist;
          stepMinTsRef.current = now;
        }
        lastRebaseTsRef.current = now;
      }
    }

    // ── CAMERA PANNING LOGIC ──
    const now = Date.now();
    if (now - lastCamUpdate.current < CAM_MIN_INTERVAL_MS) return;

    const spd = Math.max(
      0,
      Math.min(nextSmoothed.speed ?? 0, NAV_ZOOM_SPD_MAX),
    );

    // Zoom out slightly if riding the bus so the user can see more of the city,
    // but stay zoomed in closely if they are just walking.
    const baseZoom = currentStatus === "IN_TRANSIT" ? 15.0 : NAV_ZOOM_BASE;
    const targetZoom = baseZoom + (spd / NAV_ZOOM_SPD_MAX) * NAV_ZOOM_DELTA;

    const currentZ = camZoomRef.current ?? targetZoom;
    const safeZoom = Math.max(currentZ, targetZoom);
    const prev = meSmoothRef.current;
    const movedEnough = !prev || dMeters(nextSmoothed, prev) >= CAM_MIN_MOVE_M;

    const heading = Number.isFinite(nextSmoothed.heading || NaN)
      ? (nextSmoothed.heading as number)
      : lastCamBearing.current;
    const headingChanged =
      Math.abs(((heading - lastCamBearing.current + 540) % 360) - 180) >=
      CAM_MIN_HEADING_DEG;

    if (movedEnough || headingChanged) {
      cameraRef.current?.setCamera({
        centerCoordinate: [nextSmoothed.longitude, nextSmoothed.latitude],
        zoomLevel: safeZoom,
        heading: heading,
        pitch: 45, // Angle the camera for an isometric 3D navigation feel!
        animationDuration: 300,
      });
      lastCamUpdate.current = now;
      lastCamBearing.current = heading;
    }
  }

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
    handleSelectStop(found);
  }

  async function fetchWalkingRoute(from: Coords, to: Stop) {
    if (!from) return;
    setRouteLoading(true);
    clearRoute();
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${from.longitude},${from.latitude};${to.lng},${to.lat}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json?.routes?.length)
        throw new Error(json?.message || "No walking route");

      const route = json.routes[0];
      const leg = route?.legs?.[0];
      const coords = route?.geometry?.coordinates as number[][] | undefined;

      if (Array.isArray(coords) && coords.length > 1) {
        const fc: FeatureCollection<LineString> = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords },
            },
          ],
        };
        setRouteFC(fc);

        const distance =
          typeof route.distance === "number"
            ? route.distance
            : sumLineDistanceMeters(coords);
        const duration =
          typeof route.duration === "number" ? route.duration : distance / 1.35;
        setRouteInfo({ distance, duration });

        const [minLng, minLat, maxLng, maxLat] = bboxFromCoords(coords);
        try {
          cameraRef.current?.fitBounds(
            [maxLng, maxLat],
            [minLng, minLat],
            [40, 40, 200, 40],
            600,
          );
        } catch {
          const midLng = (minLng + maxLng) / 2,
            midLat = (minLat + maxLat) / 2;
          cameraRef.current?.setCamera({
            centerCoordinate: [midLng, midLat],
            zoomLevel: 16.8,
            animationDuration: 600,
          });
        }
      } else {
        const fc: FeatureCollection<LineString> = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [from.longitude, from.latitude],
                  [to.lng, to.lat],
                ],
              },
            },
          ],
        };
        setRouteFC(fc);
        setRouteInfo(fallbackInfoBetween(from, to));
        cameraRef.current?.setCamera({
          centerCoordinate: [to.lng, to.lat],
          zoomLevel: 17.2,
          animationDuration: 600,
        });
      }

      if (leg?.steps?.length) {
        const ss: Step[] = leg.steps.map((st: any) => ({
          instruction: st.maneuver?.instruction ?? undefined,
          name: st.name ?? undefined,
          distance: st.distance ?? 0,
          duration: st.duration ?? 0,
          location: (st.maneuver?.location as [number, number]) ?? [
            to.lng,
            to.lat,
          ],
          type: st.maneuver?.type,
          modifier: st.maneuver?.modifier,
          bearing_after: st.maneuver?.bearing_after,
          exit: st.maneuver?.exit,
        }));
        setSteps(ss);

        if (meSmoothRef.current && ss.length > 0) {
          const meS = meSmoothRef.current;
          let bestIdx = 0,
            best = Infinity;
          for (let i = 0; i < ss.length; i++) {
            const d = dMeters(meS, {
              latitude: ss[i].location[1],
              longitude: ss[i].location[0],
            });
            if (d < best) {
              best = d;
              bestIdx = i;
            }
          }
          setNextStepIdx(bestIdx);
          stepMinDistRef.current = best;
          stepMinTsRef.current = Date.now();
        }
      } else {
        const approx = fallbackInfoBetween(from, to);
        setSteps([
          {
            instruction: `Walk to ${to.name}`,
            distance: approx.distance,
            duration: approx.duration,
            location: [to.lng, to.lat],
            type: "arrive",
          },
        ]);
      }
    } catch {
      const fc: FeatureCollection<LineString> = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [from.longitude, from.latitude],
                [to.lng, to.lat],
              ],
            },
          },
        ],
      };
      setRouteFC(fc);
      const approx = fallbackInfoBetween(from, to);
      setRouteInfo(approx);
      setSteps([
        {
          instruction: `Walk to ${to.name}`,
          distance: approx.distance,
          duration: approx.duration,
          location: [to.lng, to.lat],
          type: "arrive",
        },
      ]);
    } finally {
      setRouteLoading(false);
    }
  }

  function recenter() {
    if (!meSmoothRef.current) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [
        meSmoothRef.current.longitude,
        meSmoothRef.current.latitude,
      ],
      zoomLevel: 16,
      heading: meSmoothRef.current.heading ?? 0,
      pitch: 30,
      animationDuration: 450,
    });
    setFollowMe(true);
  }

  function onCameraChanged(e: any) {
    const z: number | undefined = e?.properties?.zoom;
    const center: [number, number] | undefined = e?.properties?.center;
    if (!z || !center) return;

    camZoomRef.current = z;
    const now = Date.now();
    if (now - (lastViewStateTsRef.current || 0) < 400) return;
    lastViewStateTsRef.current = now;

    const [lng, lat] = center;
    setViewZoom(z);
    setViewCenter({ lat, lng });
  }

  const getSearchDistanceText = (s: any) => {
    if (!meSmoothRef.current) return null;
    const d = dMeters(meSmoothRef.current, {
      latitude: s.lat,
      longitude: s.lng,
    });
    return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
  };

  const handleSelectStop = (s: Stop) => {
    navRef.current = false;
    setNavigating(false);
    setFollowMe(false);
    setArrivalSoonShown(false);
    setNextStepIdx(0);
    stepMinDistRef.current = Infinity;
    stepMinTsRef.current = 0;

    clearRoute();
    setSelected(s);
    setNearestOpen(false);
    setSearchOpen(false);
    setStepsOpen(false);
    zoomToStop(s);
  };

  const handleCloseStop = () => {
    navRef.current = false;
    setNavigating(false);
    clearRoute();
    setSelected(null);
    defaultCamera();
  };

  const handleToggleNav = (nextState: boolean) => {
    navRef.current = nextState;
    setNavigating(nextState);
    if (nextState) {
      setFollowMe(true);
      lastCamUpdate.current = 0;
      if (meSmoothRef.current && steps.length > 0) {
        const meS = meSmoothRef.current;
        let bestIdx = 0,
          best = Infinity;
        for (let i = 0; i < steps.length; i++) {
          const d = dMeters(meS, {
            latitude: steps[i].location[1],
            longitude: steps[i].location[0],
          });
          if (d < best) {
            best = d;
            bestIdx = i;
          }
        }
        setNextStepIdx(bestIdx);
        stepMinDistRef.current = best;
        stepMinTsRef.current = Date.now();
      }
      if (meSmoothRef.current) {
        cameraRef.current?.setCamera({
          centerCoordinate: [
            meSmoothRef.current.longitude,
            meSmoothRef.current.latitude,
          ],
          zoomLevel: NAV_ZOOM_BASE,
          heading: meSmoothRef.current.heading ?? 0,
          pitch: 45,
          animationDuration: 250,
        });
      }
    } else {
      setFollowMe(false);
      if (selected) zoomToStop(selected);
      // If we are tracking a journey, snap back to Hollywood view
      if (activeJourney) {
        // You can add logic here to refit bounds if needed
      }
    }
  };

  const nextStep = steps[nextStepIdx];
  const nextPreview =
    nextStep && selected
      ? humanizeStep(
          nextStep,
          nextStepIdx,
          nextStepIdx === steps.length - 1,
          selected.name,
        )
      : null;

  let screen: JSX.Element;
  if (hasPerm === null) {
    screen = (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  } else if (!hasPerm) {
    screen = (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={styles.title}>Location permission needed</Text>
        <Text style={styles.sub}>
          Enable location to see nearby stages and board faster.
        </Text>
      </View>
    );
  } else {
    screen = (
      <>
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={STYLE}
          onRegionIsChanging={(e) => {
            const isGesture =
              e?.properties?.isUserInteraction || e?.properties?.isGesture;
            if (!navRef.current && isGesture) {
              setFollowMe(false);
            }
          }}
          onCameraChanged={onCameraChanged}
          onMapLoadingError={() =>
            console.warn("onMapLoadingError (style failed to load)")
          }
          compassEnabled={true}
          compassViewPosition={1}
          compassViewMargins={{ x: 20, y: 100 }}
          logoEnabled={false}
          scaleBarEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [36.817223, -1.286389], // Auto-centers initially on Nairobi
              zoomLevel: 13,
            }}
            followUserLocation={followMe}
            followUserMode={MapboxGL.UserTrackingModes.Follow}
            followZoomLevel={16}
          />
          <MapboxGL.Images
            images={{ "matatu-pin": require("@/assets/images/matatu.png") }}
          />
          <MapboxGL.UserLocation showsUserHeadingIndicator />

          {/* FALLBACK SINGLE ROUTE */}
          {!activeJourney && routeFC && (
            <MapboxGL.ShapeSource id="route" shape={routeFC}>
              <MapboxGL.LineLayer
                id="route-line"
                style={{
                  lineColor: ORANGE,
                  lineWidth: 4,
                  lineOpacity: 0.9,
                  lineJoin: "round",
                  lineCap: "round",
                  lineDasharray: [2, 2],
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* LEG 1: Walking to the Origin Stop (Dotted Grey) */}
          {walkToOriginFC && (
            <MapboxGL.ShapeSource id="walk-leg-source" shape={walkToOriginFC}>
              <MapboxGL.LineLayer
                id="walk-leg-line"
                style={{
                  lineColor: "#9CA3AF",
                  lineWidth: 3.5,
                  lineDasharray: [1, 2],
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* LEG 2: The Bus Route (Solid Brand Color) */}
          {transitFC && (
            <MapboxGL.ShapeSource id="transit-leg-source" shape={transitFC}>
              <MapboxGL.LineLayer
                id="transit-leg-line"
                style={{
                  lineColor: ORANGE,
                  lineWidth: 5,
                  lineCap: "round",
                  lineJoin: "round", // This is crucial for curvy road geometry
                  // lineAntialias: true,
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          <StopsLayer
            allStops={sampleStops}
            viewCenter={viewCenter}
            viewZoom={viewZoom}
            selected={selected}
            onPress={onStopPress}
          />
        </MapboxGL.MapView>

        <MapFloatingUI
          onRecenter={recenter}
          onOpenSearch={() => {
            setSearchOpen(true);
            setSearchQ("");
          }}
          navigating={navigating}
          onToggleNav={() => handleToggleNav(!navigating)}
          nextPreview={nextPreview}
          nextStep={nextStep}
          arrivalSoonShown={arrivalSoonShown}
          hasSelectedStop={!!selected}
          onToggleNearest={() => setNearestOpen((v) => !v)}
          nearestCount={nearest.length}
          hasLocation={!!me}
          activeJourney={activeJourney}
          onClearJourney={handleClearJourney}
        />

        {!selected && !activeJourney && (
          <NearestStopsSheet
            nearestOpen={nearestOpen}
            setNearestOpen={setNearestOpen}
            nearest={nearest}
            me={me}
            onSelect={handleSelectStop}
          />
        )}

        <StopDetailsSheet
          selected={selected}
          routeLoading={routeLoading}
          routeInfo={routeInfo}
          navigating={navigating}
          onToggleNav={handleToggleNav}
          onClose={handleCloseStop}
          mToNice={mToNice}
          sToMin={sToMin}
        >
          <RouteStepsList
            steps={steps}
            stepsOpen={stepsOpen}
            setStepsOpen={setStepsOpen}
            nextPreview={nextPreview}
            nextStepIdx={nextStepIdx}
            navigating={navigating}
            selectedName={selected?.name ?? ""}
          />
        </StopDetailsSheet>

        <SearchOverlay
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          searchResults={searchResults}
          onSelect={handleSelectStop}
          getDistanceText={getSearchDistanceText}
        />
      </>
    );
  }

  return <View style={{ flex: 1, backgroundColor: BG }}>{screen}</View>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 18, fontWeight: "700", color: BLACK },
  sub: { color: "#6B7280", textAlign: "left" },
});
