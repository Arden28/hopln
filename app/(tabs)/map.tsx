// app/(tabs)/map.tsx
import MapFloatingUI from "@/components/app/MapFloatingUI";
import NearestStopsSheet from "@/components/app/NearestStopsSheet";
import RouteStepsList from "@/components/app/RouteStepsList";
import SearchOverlay from "@/components/app/SearchOverlay";
import StopDetailsSheet from "@/components/app/StopDetailsSheet";
import JourneyDetailsSheet from "@/components/app/JourneyDetailsSheet";
import StopsLayer from "@/components/app/StopsLayer";

import { MapService } from "@/services/map";
import { StopService } from "@/services/stop";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
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
  getRouteColor,
} from "@/utils/mapHelpers";

// ── TURF.JS IMPORTS ──
import { point, lineString } from '@turf/helpers';
import lineSlice from '@turf/line-slice';

import MapboxGL from "@rnmapbox/maps";
import Constants from "expo-constants";
import * as Location from "expo-location";
import type { FeatureCollection, LineString, Point } from "geojson";
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

const createSafeLineString = (coords: any[]) => {
  if (!coords || !Array.isArray(coords)) return null;
  const safe = coords
    .map(c => [Number(c[0]), Number(c[1])])
    .filter(c => !isNaN(c[0]) && !isNaN(c[1]));
  return safe.length >= 2 ? safe : null;
};

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const [nearestStops, setNearestStops] = useState<UnifiedLocation[]>([]);
  const [searchResults, setSearchResults] = useState<UnifiedLocation[]>([]);

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastCamUpdate = useRef<number>(0);
  const lastCamBearing = useRef<number>(0);
  const fetchedForStopId = useRef<string | null>(null);

  const meSmoothRef = useRef<Coords | null>(null);
  const lastRebaseTsRef = useRef<number>(0);
  const stepMinDistRef = useRef<number>(Infinity);
  const stepMinTsRef = useRef<number>(0);

  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number; } | null>(null);
  const [viewZoom, setViewZoom] = useState<number>(13);
  const lastViewStateTsRef = useRef<number>(0);
  const camZoomRef = useRef<number>(13);

  const activeJourney = useJourneyStore((state) => state.activeJourney);
  const clearJourney = useJourneyStore((state) => state.clearJourney);
  
  const [walkToOriginFC, setWalkToOriginFC] = useState<FeatureCollection<LineString> | null>(null);
  const [walkToDestFC, setWalkToDestFC] = useState<FeatureCollection<LineString> | null>(null);

  const [transitFullFC, setTransitFullFC] = useState<FeatureCollection<LineString> | null>(null);
  const [transitActiveFC, setTransitActiveFC] = useState<FeatureCollection<LineString> | null>(null);

  const [journeyNodesFC, setJourneyNodesFC] = useState<FeatureCollection<Point> | null>(null);
  
  // ── NEW STATE: Real Database Stops for the start and end of the entire lines ──
  const [routeTerminiStops, setRouteTerminiStops] = useState<UnifiedLocation[]>([]);

  const visibleMapStops = useMemo(() => {
    // We add the fetched termini into the combined bucket!
    const combined = [...nearestStops, ...searchResults, ...routeTerminiStops];
    if (activeJourney?.route?.segments) {
      activeJourney.route.segments.forEach(seg => {
        if (seg.board_stop) combined.push(seg.board_stop as any);
        if (seg.alight_stop) combined.push(seg.alight_stop as any);
      });
    }
    return Array.from(new Map(combined.map((s) => [s.id, s])).values()) as Stop[];
  }, [nearestStops, searchResults, routeTerminiStops, activeJourney]);

  useEffect(() => {
    if (me && nearestOpen) {
      StopService.getNearbyStops(me.latitude, me.longitude, 2000, 5)
        .then(setNearestStops)
        .catch((e) => console.warn("Failed fetching nearby stops", e));
    }
  }, [me?.latitude, me?.longitude, nearestOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchQ.trim();
      if (q.length > 2) {
        StopService.searchStops(q)
          .then(setSearchResults)
          .catch(() => setSearchResults([]));
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  useEffect(() => {
    if (!activeJourney) {
      setWalkToOriginFC(null);
      setTransitFullFC(null);
      setTransitActiveFC(null);
      setJourneyNodesFC(null);
      setRouteTerminiStops([]); // Clear termini
      setWalkToDestFC(null);
      return;
    }

    setSelected(null);
    setFollowMe(false);
    setRouteLoading(true);

    const fetchJourneyShapes = async () => {
      try {
        const { fromLoc, toLoc, route } = activeJourney;
        const segments = route.segments;
        if (!segments || segments.length === 0) return;

        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];

        const isFromStop = fromLoc._type === 'stop';
        const walkingOriginLat = isFromStop && meSmoothRef.current ? meSmoothRef.current.latitude : Number(fromLoc.lat);
        const walkingOriginLng = isFromStop && meSmoothRef.current ? meSmoothRef.current.longitude : Number(fromLoc.lng);

        let allCoords: number[][] = [];
        let summarySteps: Step[] = [];
        let totalDist = 0;
        let totalDur = 0;
        
        let walkFeatures: any[] = [];
        let transitFeaturesFull: any[] = [];
        let transitFeaturesActive: any[] = [];
        let nodeFeatures: any[] = []; 
        let fetchedTermini: UnifiedLocation[] = []; // Collect real stops here

        const addWalkLeg = async (lat1: number, lng1: number, lat2: number, lng2: number, arriveInstruction?: string) => {
          const dist = dMeters({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 });
          if (dist <= 15) return;

          let walkRoute = null;
          try {
            walkRoute = await MapService.getWalkingRoute(lat1, lng1, lat2, lng2);
          } catch (e) {
            console.warn("Walk API failed", e);
          }

          let safeWalk = createSafeLineString(walkRoute?.geometry?.coordinates) || [[lng1, lat1], [lng2, lat2]];
          
          allCoords.push(...safeWalk);
          walkFeatures.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: safeWalk } });

          totalDist += walkRoute?.distance ?? dist;
          totalDur += walkRoute?.duration ?? (dist / 1.35);

          if (walkRoute?.legs?.[0]?.steps?.length) {
            summarySteps.push(...walkRoute.legs[0].steps.map((st: any) => ({
              instruction: st.maneuver?.instruction,
              name: st.name,
              distance: st.distance ?? 0,
              duration: st.duration ?? 0,
              location: st.maneuver?.location ?? [lng2, lat2],
              type: st.maneuver?.type,
            })));
          } else if (arriveInstruction) {
            summarySteps.push({
              instruction: arriveInstruction,
              distance: dist,
              duration: dist / 1.35,
              location: [lng2, lat2],
              type: "arrive",
            });
          }
        };

        // 1. FIRST MILE WALK
        await addWalkLeg(
          walkingOriginLat, walkingOriginLng, 
          Number(firstSeg.board_stop?.lat), Number(firstSeg.board_stop?.lng),
          `Walk to ${firstSeg.board_stop?.name}`
        );

        // 2. TRANSIT LEGS & TRANSFERS
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const bLat = Number(seg.board_stop?.lat);
          const bLng = Number(seg.board_stop?.lng);
          const aLat = Number(seg.alight_stop?.lat);
          const aLng = Number(seg.alight_stop?.lng);
          const routeColor = getRouteColor(seg.route_name);

          nodeFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [bLng, bLat] },
            properties: { 
              name: seg.board_stop?.name, 
              color: routeColor, 
              isTerminal: i === 0 
            }
          });

          summarySteps.push({
            instruction: `Board Line ${seg.route_name} at ${seg.board_stop?.name || 'Stage'}`,
            distance: 0, duration: 0, location: [bLng, bLat], type: "depart",
          });

          const safeTransit = createSafeLineString(seg.points || []);
          if (safeTransit) {
            const snappedTransit = await MapService.snapToRoads(safeTransit as [number, number][]);

            // ── FETCH REAL STOPS FOR THE START AND END OF THE ENTIRE ROUTE ──
            if (snappedTransit.length > 0) {
              const startCoords = snappedTransit[0];
              const endCoords = snappedTransit[snappedTransit.length - 1];

              try {
                // Fetch the closest real stop within 250m of the line's origin and terminus
                const [originRes, termRes] = await Promise.all([
                  StopService.getNearbyStops(startCoords[1], startCoords[0], 250, 1),
                  StopService.getNearbyStops(endCoords[1], endCoords[0], 250, 1)
                ]);
                
                if (originRes.length > 0) fetchedTermini.push(originRes[0]);
                if (termRes.length > 0) fetchedTermini.push(termRes[0]);
              } catch (e) {
                console.warn("Failed to fetch real termini stops", e);
              }
            }

            const fullTurfLine = lineString(snappedTransit);
            const startPt = point([bLng, bLat]);
            const endPt = point([aLng, aLat]);

            let activeCoords = snappedTransit; 

            try {
              const sliced = lineSlice(startPt, endPt, fullTurfLine);
              activeCoords = sliced.geometry.coordinates as [number, number][];
            } catch (e) {
              console.warn("Turf slice failed, falling back to full line", e);
            }

            transitFeaturesFull.push({ 
              type: "Feature", 
              properties: { segmentIndex: i, routeColor: routeColor },
              geometry: { type: "LineString", coordinates: snappedTransit } 
            });

            transitFeaturesActive.push({ 
              type: "Feature", 
              properties: { segmentIndex: i, routeColor: routeColor },
              geometry: { type: "LineString", coordinates: activeCoords } 
            });
            
            allCoords.push(...activeCoords);
            const transitDist = sumLineDistanceMeters(activeCoords);
            totalDist += transitDist;
            totalDur += transitDist / 5.5;
          }

          nodeFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [aLng, aLat] },
            properties: { 
              name: seg.alight_stop?.name, 
              color: routeColor, 
              isTerminal: i === segments.length - 1 
            }
          });

          summarySteps.push({
            instruction: `Alight at ${seg.alight_stop?.name || 'Stage'}`,
            distance: 0, duration: 0, location: [aLng, aLat], type: "arrive",
          });

          if (i < segments.length - 1) {
            const nextSeg = segments[i+1];
            await addWalkLeg(
              aLat, aLng, 
              Number(nextSeg.board_stop?.lat), Number(nextSeg.board_stop?.lng),
              `Walk to transfer stage: ${nextSeg.board_stop?.name}`
            );
          }
        }

        // 3. LAST MILE WALK
        await addWalkLeg(
          Number(lastSeg.alight_stop?.lat), Number(lastSeg.alight_stop?.lng), 
          toLoc.lat, toLoc.lng,
          `Arrive at destination: ${toLoc.name}`
        );

        // 4. COMMIT TO STATE
        setWalkToOriginFC(walkFeatures.length > 0 ? { type: "FeatureCollection", features: walkFeatures } : null);
        setTransitFullFC(transitFeaturesFull.length > 0 ? { type: "FeatureCollection", features: transitFeaturesFull } : null);
        setTransitActiveFC(transitFeaturesActive.length > 0 ? { type: "FeatureCollection", features: transitFeaturesActive } : null);
        setJourneyNodesFC(nodeFeatures.length > 0 ? { type: "FeatureCollection", features: nodeFeatures } as FeatureCollection<Point> : null);
        
        // Push the real DB stops to the state so StopsLayer can manage them
        setRouteTerminiStops(fetchedTermini);

        setWalkToDestFC(null);
        setSteps(summarySteps);
        setRouteInfo({ distance: totalDist, duration: totalDur });

        if (allCoords.length > 1) {
          const [minLng, minLat, maxLng, maxLat] = bboxFromCoords(allCoords);
          cameraRef.current?.fitBounds([maxLng, maxLat], [minLng, minLat], [140, 40, 300, 40], 800);
        }
      } catch (err) {
        console.warn("Engine completely failed to assemble shapes", err);
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
    setWalkToOriginFC(null);
    setTransitFullFC(null);
    setTransitActiveFC(null);
    setJourneyNodesFC(null); 
    setRouteTerminiStops([]); // Clear termini
    setWalkToDestFC(null);
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
      padding: { paddingTop: 40, paddingRight: 40, paddingBottom: 200, paddingLeft: 40 },
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
          }
        );
      }
    })();
    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, []);

  function handleNavUpdate(nextSmoothed: Coords) {
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

      if (currentStatus === "WAITING_FOR_BUS" && distToOrigin <= 40) {
        setStatus("IN_TRANSIT");
      }

      if (currentStatus === "IN_TRANSIT" && distToDest <= 40) {
        setStatus("ARRIVED");
        setNavigating(false);
        navRef.current = false;
      }
    }

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

    const now = Date.now();
    if (now - lastCamUpdate.current < CAM_MIN_INTERVAL_MS) return;

    const spd = Math.max(0, Math.min(nextSmoothed.speed ?? 0, NAV_ZOOM_SPD_MAX));
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
        pitch: 45,
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
    const found = visibleMapStops.find((s) => s.id === props.id) as any;
    if (!found) return;
    handleSelectStop(found);
  }

  async function fetchWalkingRoute(from: Coords, to: Stop) {
    if (!from) return;
    setRouteLoading(true);
    clearRoute();
    
    try {
      const route = await MapService.getWalkingRoute(from.latitude, from.longitude, to.lat, to.lng);
      const safeCoords = createSafeLineString(route?.geometry?.coordinates);

      if (route && safeCoords) {
        setRouteFC({
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: safeCoords } }],
        });
        const distance = route.distance ?? sumLineDistanceMeters(safeCoords);
        const duration = route.duration ?? distance / 1.35;
        setRouteInfo({ distance, duration });

        const [minLng, minLat, maxLng, maxLat] = bboxFromCoords(safeCoords);
        try {
          cameraRef.current?.fitBounds([maxLng, maxLat], [minLng, minLat], [40, 40, 200, 40], 600);
        } catch {
          const midLng = (minLng + maxLng) / 2, midLat = (minLat + maxLat) / 2;
          cameraRef.current?.setCamera({ centerCoordinate: [midLng, midLat], zoomLevel: 16.8, animationDuration: 600 });
        }

        const leg = route.legs?.[0];
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
          setSteps([{ instruction: `Walk to ${to.name}`, distance: approx.distance, duration: approx.duration, location: [to.lng, to.lat], type: "arrive" }]);
        }

      } else {
        const fallbackCoords = createSafeLineString([[from.longitude, from.latitude], [to.lng, to.lat]]);
        if (fallbackCoords) {
          setRouteFC({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: fallbackCoords } }],
          });
        }
        setRouteInfo(fallbackInfoBetween(from, to));
        cameraRef.current?.setCamera({ centerCoordinate: [to.lng, to.lat], zoomLevel: 17.2, animationDuration: 600 });
        
        const approx = fallbackInfoBetween(from, to);
        setSteps([{ instruction: `Walk to ${to.name}`, distance: approx.distance, duration: approx.duration, location: [to.lng, to.lat], type: "arrive" }]);
      }
    } catch (error) {
      console.warn("Walking route fetch failed, using fallback.", error);
      const fallbackCoords = createSafeLineString([[from.longitude, from.latitude], [to.lng, to.lat]]);
      if (fallbackCoords) {
        setRouteFC({
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: fallbackCoords } }],
        });
      }
      const approx = fallbackInfoBetween(from, to);
      setRouteInfo(approx);
      setSteps([{ instruction: `Walk to ${to.name}`, distance: approx.distance, duration: approx.duration, location: [to.lng, to.lat], type: "arrive" }]);
    } finally {
      setRouteLoading(false);
    }
  }

  function onCameraChanged(e: any) {
    const isGesture = e?.properties?.isUserInteraction || e?.properties?.isGesture;
    if (!navRef.current && isGesture) {
      setFollowMe(false);
    }

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
    }
  };

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
          onCameraChanged={onCameraChanged}
          compassEnabled={true}
          compassViewPosition={1}
          compassViewMargins={{ x: 20, y: 100 }}
          logoEnabled={false}
          scaleBarEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [36.817223, -1.286389],
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

          {/* ── 1. FADED FULL TRANSIT LINE ── */}
          {transitFullFC && (
            <MapboxGL.ShapeSource id="transit-full-source" shape={transitFullFC}>
              <MapboxGL.LineLayer
                id="transit-full-line"
                style={{
                  lineColor: ['get', 'routeColor'],
                  lineWidth: 3,             
                  lineOpacity: 0.3,         
                  lineCap: "round",
                  lineJoin: "round",
                  lineOffset: ['*', ['get', 'segmentIndex'], 4], 
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* ── 2. BOLD ACTIVE TRANSIT LINE ── */}
          {transitActiveFC && (
            <MapboxGL.ShapeSource id="transit-active-source" shape={transitActiveFC}>
              <MapboxGL.LineLayer
                id="transit-active-line"
                style={{
                  lineColor: ['get', 'routeColor'],
                  lineWidth: 6,             
                  lineOpacity: 1.0,         
                  lineCap: "round",
                  lineJoin: "round",
                  lineOffset: ['*', ['get', 'segmentIndex'], 4], 
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {walkToDestFC && (
            <MapboxGL.ShapeSource id="walk-dest-source" shape={walkToDestFC}>
              <MapboxGL.LineLayer
                id="walk-dest-line"
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

          {/* ── 3. JOURNEY KEY NODES (Boarding, Transfers, Alighting) ── */}
          {journeyNodesFC && (
            <MapboxGL.ShapeSource id="journey-nodes-source" shape={journeyNodesFC}>
              <MapboxGL.CircleLayer
                id="journey-nodes-circle"
                style={{
                  circleColor: "#FFFFFF",
                  circleRadius: ['case', ['==', ['get', 'isTerminal'], true], 7, 5],
                  circleStrokeWidth: ['case', ['==', ['get', 'isTerminal'], true], 3, 2],
                  circleStrokeColor: ['get', 'color'],
                }}
              />
              <MapboxGL.SymbolLayer
                id="journey-nodes-text"
                style={{
                  textField: "{name}",
                  textSize: ['case', ['==', ['get', 'isTerminal'], true], 13, 11.5],
                  textColor: "#333333",
                  textHaloColor: "#FFFFFF",
                  textHaloWidth: 2,
                  textAnchor: "left", 
                  textJustify: "auto",
                  textOffset: [1, 0], 
                  textAllowOverlap: false, 
                  textOptional: true, 
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          <StopsLayer
            allStops={visibleMapStops}
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
          nearestCount={nearestStops.length}
          hasLocation={!!me}
          activeJourney={activeJourney}
          onClearJourney={handleClearJourney}
        />

        {!selected && !activeJourney && (
          <NearestStopsSheet
            nearestOpen={nearestOpen}
            setNearestOpen={setNearestOpen}
            nearest={nearestStops}
            me={me}
            onSelect={handleSelectStop}
          />
        )}

        {selected && !activeJourney && (
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
        )}

        {activeJourney && (
          <JourneyDetailsSheet
            activeJourney={activeJourney}
            routeLoading={routeLoading}
            routeInfo={routeInfo}
            navigating={navigating}
            onToggleNav={handleToggleNav}
            onClose={handleClearJourney}
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
              selectedName={activeJourney.toLoc.name}
            />
          </JourneyDetailsSheet>
        )}

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