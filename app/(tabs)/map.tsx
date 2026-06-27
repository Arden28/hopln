// app/(tabs)/map.tsx
import { IntermStopInfoCard }    from "@/components/map/IntermStopInfoCard";
import { MapLayersSheet }        from "@/components/map/MapLayersSheet";
import { OfflineNotice }         from "@/components/map/OfflineNotice";
import { ReportLayer }           from "@/components/map/ReportLayer";
import type { ReportLayerHandle } from "@/components/map/ReportLayer";
import { RouteOverlay }          from "@/components/map/RouteOverlay";
import { SaveWall }              from "@/components/map/SaveWall";
import { DestinationPin }         from "@/components/map/RouteMarkers";
import { DEFAULT_REGION }      from "@/components/map/types";
import type { IntermediateStop } from "@/components/map/types";
import JourneyDetailsSheet     from "@/components/app/JourneyDetailsSheet";
import MapFloatingUI           from "@/components/app/MapFloatingUI";
import NearestStopsSheet       from "@/components/app/NearestStopsSheet";
import ReportDetailCard        from "@/components/app/ReportDetailCard";
import ReportSheet             from "@/components/app/ReportSheet";
import RateAppSheet           from "@/components/app/RateAppSheet";
import PostJourneySheet       from "@/components/app/PostJourneySheet";
import RouteStepsList          from "@/components/app/RouteStepsList";
import StopDetailsSheet        from "@/components/app/StopDetailsSheet";
import StopQuickCard           from "@/components/app/StopQuickCard";
import StopsLayer              from "@/components/app/StopsLayer";

import { useNavigation }       from "@/hooks/useNavigation";
import { useRatePrompt }      from "@/hooks/useRatePrompt";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useRouteOverlay }     from "@/hooks/useRouteOverlay";
import { useHeadingTracker }   from "@/hooks/useHeadingTracker";
import { useHeadingStore }     from "@/store/headingStore";
import { RouteService }        from "@/services/route";
import { ReportService }       from "@/services/report";
import type { TransitReport }  from "@/services/report";
import { StopService }         from "@/services/stop";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/services/cache";
import { TILE_PATH_TEMPLATE_LIGHT, TILE_PATH_TEMPLATE_DARK } from "@/services/offlineTiles";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
import { useMapLayersStore }   from "@/store/mapLayersStore";
import { useNetworkStore }     from "@/store/networkStore";
import { useOfflineMapStore }  from "@/store/offlineMapStore";
import { Stop, humanizeStep, mToNice, sToMin } from "@/utils/mapHelpers";

import { useRouter }      from "expo-router";
import { useSavedStore }  from "@/store/savedStore";
import { usePrefsStore }  from "@/store/prefsStore";
import { useAuthStore }   from "@/store/authStore";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import {
  MapView as MapboxMapView,
  Camera as MapboxCamera,
  RasterSource,
  RasterLayer,
  PointAnnotation,
  UserLocation,
  CircleLayer,
  FillLayer,
  ShapeSource,
} from "@rnmapbox/maps";

// Module-level casts bypass IDE false-positive "undefined" type for native components
// (web .d.ts resolution). Runtime resolution via Metro is correct.
const NativeUserLocation  = UserLocation  as unknown as React.ComponentType<any>;
const NativeCircleLayer   = CircleLayer   as unknown as React.ComponentType<any>;
const NativeFillLayer     = FillLayer     as unknown as React.ComponentType<any>;
const NativeShapeSource   = ShapeSource   as unknown as React.ComponentType<any>;

// Computes a cone polygon centred on (lat, lng) pointing in headingDeg (0=north, CW).
// Pizza-slice from the user location center outward — the orange dot renders on top so
// the cone appears to radiate from the dot's center.
function headingArcGeoJson(
  lat: number,
  lng: number,
  headingDeg: number,
  zoom: number
): GeoJSON.Feature<GeoJSON.Polygon> {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

  // 1. Stubby length: extends just 22 screen-pixels from the center of the dot
  const targetScreenPixels = 22; 
  const R_M = Math.max(6, Math.min(50, targetScreenPixels * metersPerPixel));

  // 2. Wide floodlight aperture (47° half-angle = 94° total fan. Kills the pizza look).
  const HALF = 47; 
  const STEPS = 16; // Bumped to 16 so the wide outer arc doesn't look jagged
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const pts: [number, number][] = [[lng, lat]];

  for (let i = 0; i <= STEPS; i++) {
    const a = ((headingDeg - HALF) + (2 * HALF * i) / STEPS) * (Math.PI / 180);
    pts.push([
      lng + (R_M / (111_320 * cosLat)) * Math.sin(a),
      lat + (R_M / 111_320) * Math.cos(a),
    ]);
  }
  pts.push([lng, lat]);

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [pts] },
    properties: { layer: "beam" },
  };
}


import { MapService } from "@/services/map";

const { height: SH } = Dimensions.get("window");

// Mount-gate wrapper: waits 100 ms before mounting the PointAnnotation so the
// React Native layout pass completes before Mapbox rasterizes DestinationPin.
// Keeping id/key stable after mount prevents "PointAnnotation supports max 1 subview".
// name is frozen at the 100 ms mark so the geocoder resolving later never
// triggers an in-place child update inside an already-rasterized annotation.
function DroppedPin({ coord, name }: { coord: { latitude: number; longitude: number }; name: string }) {
  const [frozenName, setFrozenName] = useState<string | null>(null);
  const nameRef = useRef(name);
  useLayoutEffect(() => { nameRef.current = name; });
  useEffect(() => {
    const t = setTimeout(() => setFrozenName(nameRef.current), 100);
    return () => clearTimeout(t);
  }, []);
  if (frozenName === null) return null;
  return (
    <PointAnnotation
      id="dropped-pin"
      coordinate={[coord.longitude, coord.latitude]}
      anchor={{ x: 0.5, y: 1.0 }}
    >
      <DestinationPin name={frozenName} />
    </PointAnnotation>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const BG = dark ? "#0F0F0F" : "#F6F7F8";

  const { location: me, navState, locationPermissionDenied, openLocationSettings, gpsLost, wrongDirection, startNavigation, stopNavigation } = useNavigation();
  const { visible: rateVisible, onJourneyComplete, onRate, onLater } = useRatePrompt();
  const [showPostJourney, setShowPostJourney] = useState(false);

  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const setJourney    = useJourneyStore((s) => s.setJourney);
  const tripStatus    = useJourneyStore((s) => s.tripStatus);
  const clearJourney  = useJourneyStore((s) => s.clearJourney);
  const navigating    = tripStatus === "IN_TRANSIT";
  const isVehicleMode = navigating && (
    (navState?.currentSegmentMode != null && navState.currentSegmentMode !== "WALK")
    || (me?.speed ?? 0) > 4.0
  );

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const layers          = useMapLayersStore((s) => s.layers);
  const isOnline        = useNetworkStore((s) => s.isOnline);
  const offlinePack     = useOfflineMapStore((s) => s.pack);

  const { journeys, addJourney, removeJourney } = useSavedStore();
  const { prefs, load: loadPrefs } = usePrefsStore();
  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  useEffect(() => {
    if (tripStatus !== "ARRIVED") return;
    const tPost = setTimeout(() => setShowPostJourney(true), 800);
    const tRate = setTimeout(onJourneyComplete, 2500);
    return () => { clearTimeout(tPost); clearTimeout(tRate); };
  }, [tripStatus, onJourneyComplete]);

  const isSaved = useMemo(() =>
    activeJourney
      ? journeys.some((j) =>
          j.from_name === activeJourney.fromLoc.name &&
          j.to_name   === activeJourney.toLoc.name
        )
      : false,
    [journeys, activeJourney]
  );

  const savedJourneyId = useMemo(() =>
    activeJourney
      ? journeys.find((j) =>
          j.from_name === activeJourney.fromLoc.name &&
          j.to_name   === activeJourney.toLoc.name
        )?.id
      : undefined,
    [journeys, activeJourney]
  );

  const handleSaveJourney = async (label?: string) => {
    if (!isAuthenticated) { setShowSaveWall(true); return; }
    if (!activeJourney) return;
    const { fromLoc, toLoc, route } = activeJourney;
    await addJourney({
      label: label ?? null,
      from_name: fromLoc.name,
      from_lat:  fromLoc.lat,
      from_lng:  fromLoc.lng,
      from_id:   fromLoc.id ?? null,
      from_type: fromLoc._type,
      to_name:   toLoc.name,
      to_lat:    toLoc.lat,
      to_lng:    toLoc.lng,
      to_id:     toLoc.id ?? null,
      to_type:   toLoc._type,
      summary:   route.summary,
      duration:  route.total_duration,
      route,
    });
  };

  const handleUnsaveJourney = async () => {
    if (savedJourneyId !== undefined) await removeJourney(savedJourneyId);
  };

  const stepsScrollRef = useRef<any>(null);
  const speedKph = Math.round((me?.speed ?? 0) * 3.6);

  const [showSaveWall,    setShowSaveWall]    = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [layersOpen,      setLayersOpen]      = useState(false);
  const [followMe,   setFollowMe]   = useState(true);
  const [headingUp,  setHeadingUp]  = useState(false);
  const [navStarted, setNavStarted] = useState(false);
  const [selected,        setSelected]        = useState<Stop | null>(null);
  const [nearestOpen,     setNearestOpen]     = useState(false);
  const [nearestStops,    setNearestStops]    = useState<UnifiedLocation[]>([]);
  const [activeReports,   setActiveReports]   = useState<TransitReport[]>([]);
  const [selectedReport,  setSelectedReport]  = useState<{ report: TransitReport; count: number } | null>(null);
  const [allStops,        setAllStops]        = useState<Stop[]>([]);
  const [stopDetailsOpen, setStopDetailsOpen] = useState(false);
  const [selectedIntermStop, setSelectedIntermStop] = useState<IntermediateStop | null>(null);
  const [viewCenter,     setViewCenter]     = useState<{ lat: number; lng: number } | null>(null);
  const [viewZoom,       setViewZoom]       = useState<number>(13);
  const [cameraHeading,  setCameraHeading]  = useState(0);
  const [longPressCoord,   setLongPressCoord]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [longPressName,    setLongPressName]    = useState<string>("Dropped pin");

  const mapRef             = useRef<MapboxMapView>(null);
  const cameraRef          = useRef<MapboxCamera>(null);
  const camera             = useMapCamera(mapRef, cameraRef);
  const chipJustPressedRef = useRef(false);
  const compassBusyRef     = useRef(false);
  // Tracks the last heading sent to the camera so we only push heading updates
  // when the change exceeds 2° — prevents micro-animation churn that creates
  // the brief "double render" artifact on Android during gradual turns.
  const lastSentHdgRef     = useRef<number>(0);

  // Keeps isVehicleMode readable inside the camera interval without adding it
  // to the dependency array (which would restart the interval on every GPS fix).
  const isVehicleModeRef = useRef(isVehicleMode);
  useEffect(() => { isVehicleModeRef.current = isVehicleMode; }, [isVehicleMode]);

  // headingUp controls north-up vs heading-up camera mode. Exposed as a ref so
  // the camera interval can read it without restarting the interval.
  const headingUpRef = useRef(headingUp);
  useEffect(() => { headingUpRef.current = headingUp; }, [headingUp]);

  // prefs.navView (flat vs tilted pitch) in a ref so mid-navigation preference
  // changes take effect immediately without restarting the camera interval.
  const navViewRef = useRef(prefs.navView);
  useEffect(() => { navViewRef.current = prefs.navView; }, [prefs.navView]);

  // Live compass bearing (works at rest) → drives the heading beam + nav camera.
  useHeadingTracker();

  // Walking heading beam: subscribe to the heading store with a 3° dead-zone so
  // the cone GeoJSON only recomputes when direction changes meaningfully (~4 Hz).
  const [beamHeading, setBeamHeading] = useState(0);
  useEffect(() => {
    return useHeadingStore.subscribe((s) => {
      setBeamHeading((prev) => {
        const delta = Math.abs(((s.heading - prev + 540) % 360) - 180);
        return delta >= 1.2 ? s.heading : prev;
      });
    });
  }, []);

  // Latest location, read imperatively by the nav-camera ticker without
  // re-subscribing on every GPS update.
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  // Debounced, latest-wins report fetching so rapid panning never spams the
  // network or stutters the map. reportReqId discards stale in-flight responses.
  const reportFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportReqId      = useRef(0);

  const reportLayerRef      = useRef<ReportLayerHandle>(null);
  const lastProjectCallRef  = useRef(0);
  // True while a user pan/pinch gesture is in progress. The nav camera interval
  // skips animateTo when this is set so it never fights an active gesture.
  const isUserGesturingRef  = useRef(false);

  // True while JS ordered a camera flight. Ignores Mapbox ghost-events.
  const isProgrammaticFlightRef = useRef(false);

  const isFlatOverviewRef = useRef(false);
  
  // Fast-read mirror of followMe so 60fps touch events don't spam the JS bridge
  const followMeRef = useRef(followMe);
  useEffect(() => { followMeRef.current = followMe; }, [followMe]);

  // Tracks the last settled camera region so onRegionChangeComplete can distinguish
  // a pinch-zoom gesture (zoom changes, centre barely moves) from a pan (centre moves).
  // Updated on ALL region settlements — both programmatic and gesture — so the
  // baseline is always fresh and the null-prev edge case can't occur mid-navigation.
  const prevRegionRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  // Reset baseline whenever navigation starts/stops so a stale explore-mode zoom
  // level doesn't pollute the first gesture comparison in nav mode.
  useEffect(() => { prevRegionRef.current = null; }, [navigating]);

  // Last computed viewport bounds — reused to refetch reports the instant the
  // Reports layer is toggled on, without waiting for the next pan.
  const lastBoundsRef    = useRef<{ north: number; south: number; east: number; west: number } | null>(null);

  // Primitive extractions — scalar deps prevent spurious effect re-runs on
  // heading/speed changes that update the location object reference.
  const meLat   = me?.latitude  ?? null;
  const meLng   = me?.longitude ?? null;
  const meSpeed = me?.speed     ?? 0;


  // ── Route overlay (extracted hook) ───────────────────────────────────────────

  const { walkLegs, transitLegs, nodeMarkers, locMarkers, intermediateStops, steps, routeInfo, routeLoading } =
    useRouteOverlay(activeJourney, camera);

  // Reset map UI & lock 2D posture when a journey arrives from Search
  useEffect(() => {
    if (activeJourney) {
      setSelected(null);
      setFollowMe(false);
      followMeRef.current = false;
      isFlatOverviewRef.current = true; // <── Force 2D Flat view for Route Preview
    } else {
      setFollowMe(true);
      followMeRef.current = true;
      isFlatOverviewRef.current = false; // <── Ready for 3D free exploration
    }
  }, [activeJourney]);

  // ── All stops — stale-while-revalidate so the map works offline ──────────────
  // Paint cached stops immediately (instant, works offline), then refresh from
  // the network in the background and persist the latest list back to cache.

  useEffect(() => {
    (async () => {
      const cached = await CacheService.get<Stop[]>(CACHE_KEYS.STOPS_ALL, CACHE_TTL.STOPS);
      if (cached?.length) setAllStops(cached);
      try {
        const live = await StopService.getAllStops();
        const stops = live as unknown as Stop[];
        setAllStops(stops);
        CacheService.set(CACHE_KEYS.STOPS_ALL, stops);
      } catch (e) {
        if (!cached?.length) console.warn("Failed to load all stops", e);
      }
    })();
  }, []);

  // ── Paint last-seen reports instantly (and offline) from local cache ──────────

  useEffect(() => {
    CacheService.get<TransitReport[]>(CACHE_KEYS.REPORTS_VIEWPORT, CACHE_TTL.REPORTS)
      .then((cached) => { if (cached?.length) setActiveReports(cached); })
      .catch(() => {});
  }, []);

  // Cancel any pending report fetch on unmount.
  useEffect(() => () => {
    if (reportFetchTimer.current) clearTimeout(reportFetchTimer.current);
  }, []);

  // ── Nearest stops fetch ───────────────────────────────────────────────────────

  useEffect(() => {
    if (meLat == null || meLng == null || !nearestOpen) return;
    StopService.getNearbyStops(meLat, meLng, 2000, 5)
      .then(setNearestStops)
      .catch((e) => console.warn(e));
  }, [meLat, meLng, nearestOpen]);

  // ── Follow mode (exploration, non-navigation) ─────────────────────────────────

  useEffect(() => {
    if (meLat == null || meLng == null || !followMe || navigating) return;
    camera.animateTo({ center: { latitude: meLat, longitude: meLng }, zoom: 16, heading: 0, duration: 300 });
  }, [meLat, meLng, followMe, navigating, camera]);

  // ── Navigation camera — GPS course heading blended with compass ───────────────
  // Reads GPS course from meRef (EMA-smoothed in useNavigation) and blends it
  // with the magnetometer. At walking speed compass dominates (no GPS course);
  // at transit speed GPS course dominates → phone rotation no longer moves the
  // map. Forward offset keeps the user in the lower third of the screen.

  useEffect(() => {
    if (!navigating || !followMe) return;

    let smooth    = useHeadingStore.getState().heading || 0;
    let committed = smooth;

    let anchorGps    = smooth;
    let anchorCmp    = useHeadingStore.getState().heading;
    let lastAnchorMs = 0;

    if (!headingUpRef.current) {
      camera.animateTo({ heading: 0, duration: 400 });
      lastSentHdgRef.current = 0;
    } else {
      lastSentHdgRef.current = committed;
    }

    const id = setInterval(() => {
      const pos = meRef.current;
      if (!pos) return;
      if (isUserGesturingRef.current) return;

      const vehicleMode = isVehicleModeRef.current;
      const speed       = pos.speed ?? 0;
      const compass     = useHeadingStore.getState().heading;
      const gpsHeading  = pos.heading ?? null;
      const gpsWeight   = Math.min(1.0, Math.max(0, (speed - 0.5) / 2.5));
      const now         = Date.now();

      if (gpsHeading != null && now - lastAnchorMs >= 2500) {
        anchorGps    = gpsHeading;
        anchorCmp    = compass;
        lastAnchorMs = now;
      }

      let rawHeading: number;
      if (gpsWeight > 0 && gpsHeading != null) {
        const compassDelta = ((compass - anchorCmp + 540) % 360) - 180;
        const fused        = (anchorGps + compassDelta + 360) % 360;
        rawHeading         = fused * gpsWeight + compass * (1 - gpsWeight);
      } else {
        rawHeading = compass;
      }

      const diff = ((rawHeading - smooth + 540) % 360) - 180;
      smooth     = (smooth + (vehicleMode ? 0.75 : 0.88) * diff + 360) % 360;

      const delta = Math.abs(((smooth - committed + 540) % 360) - 180);
      if (delta >= 1.0) committed = smooth;

      // ──THE GATEKEEPER: Are we in 2D Sky Overview mode? ──
      const isFlat = isFlatOverviewRef.current || navViewRef.current === "flat";

      // 1. Zoom: Lock to 15.5 in Sky mode; otherwise run dynamic matatu street zoom
      const speedKphCam = speed * 3.6;
      const calcZoom =
          speedKphCam < 5  ? 19.0
        : speedKphCam < 30 ? 19.0 - ((speedKphCam -  5) / 25) * 1.0
        : speedKphCam < 80 ? 18.0 - ((speedKphCam - 30) / 50) * 1.5
        :                    16.5 - ((speedKphCam - 80) / 40) * 1.0;

      const finalZoom = isFlat ? 15.5 : Math.max(15.0, Math.min(19.0, calcZoom));

      // 2. Center Offset: Dead-center (0) in Sky mode; bottom-third in 3D Cockpit
      const mpp = (Math.cos(pos.latitude * Math.PI / 180) * 156543) / Math.pow(2, finalZoom);
      const sheetCompM = Math.min(100, 155 * mpp);
      const netOffsetM = isFlat ? 0 : (vehicleMode ? SH * 0.20 * mpp : 50 - sheetCompM);

      const hRad      = (committed * Math.PI) / 180;
      const cosLat    = Math.cos(pos.latitude * Math.PI / 180);
      const offsetDeg = netOffsetM / 111_320;
      
      // 3. Target Heading: Strictly 0 (Due North) in Sky mode; live bearing in 3D
      const targetHeading = (!isFlat && headingUpRef.current) ? committed : 0;
      const camHRad       = headingUpRef.current ? hRad : 0;

      const centerLat = pos.latitude  + offsetDeg * Math.cos(camHRad);
      const centerLng = pos.longitude + offsetDeg * Math.sin(camHRad) / cosLat;

      // 4. Pitch: Flat onto asphalt (0°) in Sky mode; tilted (60°/70°) in 3D
      const pitch = isFlat ? 0 : (vehicleMode ? 70 : 60);

      const hdgDelta = Math.abs(((targetHeading - lastSentHdgRef.current + 540) % 360) - 180);
      const hdgThreshold = headingUpRef.current ? 1.0 : (vehicleMode ? 2.0 : 5.0);
      const sendHdg = hdgDelta >= hdgThreshold && (headingUpRef.current || speed >= 0.5) && !compassBusyRef.current;
      if (sendHdg) lastSentHdgRef.current = targetHeading;

      camera.animateTo({
        center:   { latitude: centerLat, longitude: centerLng },
        zoom:     finalZoom,
        ...(sendHdg ? { heading: targetHeading } : {}),
        pitch,
        duration: 80,
      });
    }, 130);

    return () => clearInterval(id);
  }, [navigating, followMe, camera]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleReportPress = useCallback((r: TransitReport, count: number) => {
    setReportSheetOpen(false);
    setSelectedReport({ report: r, count });
  }, []);

  const handleClearJourney = useCallback(() => {
    stopNavigation();
    clearJourney();
    setNavStarted(false);
    setSelectedIntermStop(null);
  }, [stopNavigation, clearJourney]);

  const handleSelectStop = useCallback((s: Stop) => {
    stopNavigation();
    setFollowMe(false);
    setSelected(s);
    setStopDetailsOpen(false);
    setNearestOpen(false);
    camera.animateTo({ center: { latitude: s.lat, longitude: s.lng }, zoom: 17.2, duration: 500 });
  }, [stopNavigation, camera]);

  const handleGoToStop = useCallback(async () => {
    if (!me || !selected) return;
    setStopDetailsOpen(false);

    const fromLoc: UnifiedLocation = {
      id: "current_location", name: "Current Location", _type: "location",
      lat: me.latitude, lng: me.longitude,
    };
    const toLoc: UnifiedLocation = {
      id: selected.id, name: selected.name, _type: "stop",
      lat: selected.lat, lng: selected.lng,
    };

    try {
      const routes = await RouteService.calculateJourney(fromLoc, toLoc, prefs.maxWalkMeters);
      if (routes.length > 0) {
        setJourney(fromLoc, toLoc, routes[0]);
      } else {
        Alert.alert("No route found", "We couldn't find a transit route to this stop right now. Try again later.");
      }
    } catch (e) {
      console.warn("Failed to calculate route to stop", e);
      Alert.alert("Error", "Failed to calculate route. Please check your connection.");
    }
  }, [me, selected, setJourney, prefs.maxWalkMeters]);
  

const handleToggleNav = useCallback((nextState: boolean) => {
    if (nextState) {
      isFlatOverviewRef.current = false; // 1. Force Cockpit posture
      startNavigation();
      setFollowMe(true);
      followMeRef.current = true;
      setNavStarted(true);
      setHeadingUp(true);
      headingUpRef.current = true;

      if (meRef.current) {
        isProgrammaticFlightRef.current = true; // RAISE SHIELD
        isUserGesturingRef.current = true;

        const startPitch = isVehicleModeRef.current ? 70 : 60;
        const startHdg = useHeadingStore.getState().heading || 0;
        lastSentHdgRef.current = startHdg;

        camera.animateTo({
          center: { latitude: meRef.current.latitude, longitude: meRef.current.longitude },
          zoom: 18.2,
          pitch: startPitch,
          heading: startHdg,
          duration: 1200,
        });

        setTimeout(() => {
          isProgrammaticFlightRef.current = false; // LOWER SHIELD
          isUserGesturingRef.current = false;
        }, 1250);
      }
    } else {
      isFlatOverviewRef.current = false;
      stopNavigation();
      setFollowMe(false);
      followMeRef.current = false;
      setNavStarted(false);
      setHeadingUp(false);
      headingUpRef.current = false;

      isProgrammaticFlightRef.current = true; // SHIELD THE EXIT
      camera.animateTo({ pitch: 0, heading: 0, zoom: 15, duration: 600 });
      setTimeout(() => { isProgrammaticFlightRef.current = false; }, 650);
    }
  }, [startNavigation, stopNavigation, camera]);

  const handleCompassPress = useCallback(() => {
    if (!navigating) {
      isProgrammaticFlightRef.current = true;
      camera.animateTo({ heading: 0, pitch: 0, duration: 400 });
      setCameraHeading(0);
      setTimeout(() => { isProgrammaticFlightRef.current = false; }, 450);
      return;
    }

    // ── FLIGHT 1: User panned away (!followMe) ➔ Tapped "Recenter" ──
    if (!followMe) {
      setFollowMe(true);
      followMeRef.current = true;

      if (meRef.current) {
        isProgrammaticFlightRef.current = true;
        isUserGesturingRef.current = true;

        // Restore whichever posture they were sitting in before they scrolled away
        const targetPitch = isFlatOverviewRef.current ? 0 : (isVehicleModeRef.current ? 70 : 60);
        const targetZoom  = isFlatOverviewRef.current ? 15.5 : 18.2;
        const targetHdg   = (!isFlatOverviewRef.current && headingUpRef.current)
          ? (useHeadingStore.getState().heading || 0)
          : 0;

        // TARGET LOCK: Swoop horizontally across the city back to the dot
        camera.animateTo({
          center: { latitude: meRef.current.latitude, longitude: meRef.current.longitude },
          zoom: targetZoom,
          pitch: targetPitch,
          heading: targetHdg,
          duration: 900,
        });

        setTimeout(() => {
          isProgrammaticFlightRef.current = false;
          isUserGesturingRef.current = false;
        }, 950);
      }
      return;
    }

    // ── FLIGHT 2: In 3D Cockpit (!isFlat) ➔ Tapped "Recadrer / Flatten" ──
    if (!isFlatOverviewRef.current) {
      isFlatOverviewRef.current = true;
      setHeadingUp(false);
      headingUpRef.current = false;

      isProgrammaticFlightRef.current = true;
      isUserGesturingRef.current = true;

      // HELICOPTER PULL-UP: Lift vertically into the sky to 0° pitch
      camera.animateTo({
        pitch: 0,
        heading: 0,
        zoom: 15.5,
        duration: 850,
      });

      setTimeout(() => {
        isProgrammaticFlightRef.current = false;
        isUserGesturingRef.current = false;
      }, 900);
      return;
    }

    // ── FLIGHT 3: In 2D Overview (isFlat) ➔ Tapped "Enter 3D Cockpit" ──
    if (isFlatOverviewRef.current) {
      isFlatOverviewRef.current = false;
      setHeadingUp(true);
      headingUpRef.current = true;

      isProgrammaticFlightRef.current = true;
      isUserGesturingRef.current = true;

      const targetPitch = isVehicleModeRef.current ? 70 : 60;
      const targetHdg   = useHeadingStore.getState().heading || 0;

      // FALCON DIVE: Plunge forward and tilt down into the street
      camera.animateTo({
        pitch: targetPitch,
        heading: targetHdg,
        zoom: 18.2,
        duration: 850,
      });

      setTimeout(() => {
        isProgrammaticFlightRef.current = false;
        isUserGesturingRef.current = false;
      }, 900);
    }

    compassBusyRef.current = true;
    setTimeout(() => { compassBusyRef.current = false; }, 500);
  }, [navigating, followMe, camera]);

  // Mapbox onLongPress passes a GeoJSON feature; coordinates are [lng, lat].
  const handleLongPress = useCallback((feature: any) => {
    const [longitude, latitude] = (feature?.geometry?.coordinates as [number, number]) ?? [0, 0];
    setLongPressCoord({ latitude, longitude });
    setLongPressName("Dropped pin");
    MapService.reverseGeocode(latitude, longitude)
      .then((name: string | null) => { if (name) setLongPressName(name); })
      .catch(() => {});
  }, []);

  // ── Region change → zoom + center for StopsLayer + report fetch ───────────────

  // Latest-wins viewport fetch (stale responses discarded via reportReqId).
  const fetchReportsForBounds = useCallback(
    (north: number, south: number, east: number, west: number) => {
      if (!useMapLayersStore.getState().layers.reports) return; // layer off → skip network
      const reqId = ++reportReqId.current;
      ReportService.getReportsInViewport(north, south, east, west)
        .then((reports) => {
          if (reqId !== reportReqId.current) return; // a newer request superseded this
          setActiveReports(reports);
          CacheService.set(CACHE_KEYS.REPORTS_VIEWPORT, reports); // fire-and-forget
        })
        .catch((err) => console.warn("Failed to fetch viewport reports", err));
    },
    []
  );

  // ── Auto-start navigation for AI-derived journeys ─────────────────────────────
  const prevJourneyRouteRef = useRef<any>(null);
  useEffect(() => {
    if (!activeJourney) { prevJourneyRouteRef.current = null; return; }
    if (activeJourney.route === prevJourneyRouteRef.current) return;
    prevJourneyRouteRef.current = activeJourney.route;

    if (activeJourney.route.is_ai_derived) {
      // Don't manually set state, let handleToggleNav orchestrate the cinematic dive!
      setTimeout(() => { handleToggleNav(true); }, 350);
    }
  }, [activeJourney, handleToggleNav]);

  // Fires continuously during pan/zoom. We use the isGesture flag to set
  // isUserGesturingRef immediately — this pauses the nav camera interval so it
  // never fights an in-progress user gesture. onRegionChangeComplete clears it.
  // Mapbox onRegionIsChanging — feature.properties.isUserInteraction is the gesture flag.
  const handleRegionChange = useCallback((feature: any) => {
    // 1. If our code ordered this movement, strictly ignore Mapbox
    if (isProgrammaticFlightRef.current) return;

    if (feature?.properties?.isUserInteraction) {
      isUserGesturingRef.current = true;

      // 2. INSTANT UNLOCK: The exact millisecond the finger drags, show the button.
      if (followMeRef.current) {
        followMeRef.current = false;
        setFollowMe(false);
      }
    }

    const now = Date.now();
    if (now - lastProjectCallRef.current >= 50) {
      lastProjectCallRef.current = now;
      reportLayerRef.current?.project();
    }
  }, []);

  // Mapbox onRegionDidChange — heading is in feature.properties, no getCamera() needed.
  const onRegionChangeComplete = useCallback(async (feature: any) => {
    if (isProgrammaticFlightRef.current) return;

    const [lng, lat] = (feature?.geometry?.coordinates as [number, number]) ?? [DEFAULT_REGION.longitude, DEFAULT_REGION.latitude];
    const newZoom   = feature?.properties?.zoomLevel   ?? 13;
    const isGesture = feature?.properties?.isUserInteraction ?? false;

    if (isGesture) {
      isUserGesturingRef.current = false;
      const prev = prevRegionRef.current;

      if (navigating && prev) {
        // If the map center moved less than ~30 meters, it was a stationary Pinch-Zoom. Re-lock!
        const isPinch = Math.abs(newZoom - prev.zoom) > 0.15
          && Math.abs(lat - prev.lat) < 0.0003
          && Math.abs(lng - prev.lng) < 0.0003;

        if (isPinch) {
          followMeRef.current = true;
          setFollowMe(true);
        }
      }
    }

    prevRegionRef.current = { lat, lng, zoom: newZoom };
    if (feature?.properties?.heading != null) setCameraHeading(feature.properties.heading);
    setViewZoom(newZoom);
    setViewCenter({ lat, lng });
    reportLayerRef.current?.project();

    try {
      const bounds = await mapRef.current?.getVisibleBounds();
      if (bounds) {
        const [[maxLng, maxLat], [minLng, minLat]] = bounds;
        lastBoundsRef.current = { north: maxLat, south: minLat, east: maxLng, west: minLng };
        if (reportFetchTimer.current) clearTimeout(reportFetchTimer.current);
        reportFetchTimer.current = setTimeout(
          () => fetchReportsForBounds(maxLat, minLat, maxLng, minLng),
          400
        );
      }
    } catch { /* map not ready */ }
  }, [navigating, fetchReportsForBounds]);

  // Toggling the Reports layer on refetches immediately for the current
  // viewport so pins appear without the user having to pan the map.
  useEffect(() => {
    if (!layers.reports) return;
    const b = lastBoundsRef.current;
    if (b) fetchReportsForBounds(b.north, b.south, b.east, b.west);
  }, [layers.reports, fetchReportsForBounds]);

  const nextStep    = steps[navState?.stepIndex ?? 0];
  const nextPreview = prefs.navHints === "off" || !nextStep ? null : humanizeStep(nextStep);
  const nextNextStep = steps[(navState?.stepIndex ?? 0) + 1];

  // Shorten boarding labels ("Board Line 34 at Tom Mboya St" → "Board Line 34")
  // so the "then…" chip doesn't overflow the nav banner.
  const nextNextPreview = useMemo(() => {
    if (prefs.navHints === "off" || !nextNextStep) return null;
    if (nextNextStep.type === "depart") {
      const m = nextNextStep.instruction?.match(/^Board (Line \S+)/);
      return m ? `Board ${m[1]}` : humanizeStep(nextNextStep);
    }
    return humanizeStep(nextNextStep);
  }, [nextNextStep, prefs.navHints]);

  // ETA to complete the CURRENT step (reach the next boarding stop or turn point).
  // More immediately useful than the final-arrival ETA while actively walking.
  const stepEta = (navState?.stepETAs?.[navState?.stepIndex ?? 0]) ?? null;

  // Real-time walking sub-step instruction: find the nearest sub-step waypoint by
  // GPS distance and show the upcoming turn instruction (Google Maps style).
  const walkInstruction = useMemo(() => {
    if (!navigating || navState?.currentSegmentMode !== "WALK") return null;
    const step = steps[navState.stepIndex ?? 0];
    if (!step?.subSteps?.length) return null;
    if (meLat == null || meLng == null) return step.subSteps[0].instruction;
    let nearestIdx = 0, nearestDist = Infinity;
    for (let i = 0; i < step.subSteps.length; i++) {
      const d = Math.hypot(meLat - step.subSteps[i].lat, meLng - step.subSteps[i].lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    // Within ~20 m of this waypoint → already past it, show the NEXT turn
    const past = nearestDist < 20 / 111_320;
    const idx  = past ? Math.min(nearestIdx + 1, step.subSteps.length - 1) : nearestIdx;
    return step.subSteps[idx].instruction;
  }, [navigating, navState, steps, meLat, meLng]);

  // Name of the next boarding stop (target for the current walk leg).
  const walkDestination = useMemo(() => {
    if (!navigating || navState?.currentSegmentMode !== "WALK") return null;
    const si = navState.stepIndex ?? 0;
    for (let i = si + 1; i < steps.length; i++) {
      if (steps[i].type === "depart") {
        const m = steps[i].instruction?.match(/at (.+)$/);
        return m?.[1] ?? null;
      }
      if (steps[i].type === "arrive") break;
    }
    return null;
  }, [navigating, navState, steps]);

  const boardingNodeId = (tripStatus === "WAITING_FOR_BUS" && navStarted)
    ? (() => {
        const segs = activeJourney?.route?.segments as any[] | undefined;
        if (!segs) return null;
        const idx = segs.findIndex((seg) => seg.mode !== "WALK");
        return idx >= 0 ? `node-from-${idx}` : null;
      })()
    : null;

  // Which walkLegs[] index is the user currently on?
  // The nav engine tells us currentSegmentMode === "WALK" when walking; we then
  // find the nearest walk leg by GPS distance. This is robust to any route
  // structure (consecutive transits, no initial walk, etc.) and avoids any
  // assumption about how navState.stepIndex maps to segment indices.
  const currentWalkLegIdx = useMemo(() => {
    if (!navigating || navState?.currentSegmentMode !== "WALK") return -1;
    if (meLat == null || meLng == null || walkLegs.length === 0) return -1;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < walkLegs.length; i++) {
      for (const c of walkLegs[i].coords) {
        const d = Math.hypot(meLat - c.latitude, meLng - c.longitude);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    }
    return best;
  }, [navigating, navState, walkLegs, meLat, meLng]);

  // Heading cone: shown whenever location is known and user is at walking speed.
  // Visible during free exploration too (not only during navigation).
  // Suppressed in transit mode (isVehicleMode) and whenever speed exceeds 4 m/s
  // (~14 km/h) even outside active navigation.
  // Recomputes at ~4 Hz via the 3° dead-zone on beamHeading.
  // const headingBeamGeoJson = useMemo(() => {
  //   if (meLat == null || meLng == null) return null;
  //   if (isVehicleMode || meSpeed > 4.0) return null;
  //   return headingArcGeoJson(meLat, meLng, beamHeading);
  // }, [meLat, meLng, beamHeading, isVehicleMode, meSpeed]);

const unifiedUserLocationGeoJson = useMemo(() => {
    if (meLat == null || meLng == null) return null;

    const showBeam = !isVehicleMode && meSpeed <= 4.0;
    const beamFeature = showBeam
      ? headingArcGeoJson(meLat, meLng, beamHeading, viewZoom)
      : null;

    const dotFeature: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [meLng, meLat] },
      properties: { layer: "dot" },
    };

    return {
      type: "FeatureCollection",
      features: beamFeature ? [beamFeature, dotFeature] : [dotFeature],
    };
  }, [meLat, meLng, beamHeading, isVehicleMode, meSpeed, viewZoom]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <MapboxMapView
        ref={mapRef}
        style={{ flex: 1 }}
        styleURL={dark
          ? "mapbox://styles/mapbox/dark-v11"
          : (process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? "mapbox://styles/mapbox/streets-v12")}
        logoEnabled={false}
        compassEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onRegionIsChanging={handleRegionChange}
        onRegionDidChange={onRegionChangeComplete}
        onLongPress={handleLongPress}
      >
        <MapboxCamera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [DEFAULT_REGION.longitude, DEFAULT_REGION.latitude],
            zoomLevel: 13,
          }}
        />

        {/* Offline: render downloaded Mapbox raster tiles from the local filesystem.
            RasterSource accepts the same file:// URL template as the old UrlTile. */}
        {!isOnline && offlinePack && (
          <RasterSource
            id="offline-tiles"
            tileUrlTemplates={[`file://${dark ? TILE_PATH_TEMPLATE_DARK : TILE_PATH_TEMPLATE_LIGHT}`]}
            tileSize={256}
          >
            <RasterLayer id="offline-raster" style={{}} />
          </RasterSource>
        )}

        {/* Unified User Location + Wide Beam */}
        {unifiedUserLocationGeoJson && (
          <NativeShapeSource id="user-bundle-src" shape={unifiedUserLocationGeoJson}>
            
            <NativeFillLayer
              id="user-beam-fill"
              filter={["==", ["get", "layer"], "beam"]}
              style={{ fillColor: "#FF6F00", fillOpacity: 0.18 }}
            />

            <NativeCircleLayer
              id="user-dot-pulse"
              filter={["==", ["get", "layer"], "dot"]}
              style={{ 
                circleRadius: 18, 
                circleColor: "#FF6F00", 
                circleOpacity: 0.15,
                circlePitchAlignment: "map" // <-- Lies flat on the 3D map plane
              }}
            />

            <NativeCircleLayer
              id="user-dot-core"
              filter={["==", ["get", "layer"], "dot"]}
              style={{
                circleRadius: 9,
                circleColor: "#FF6F00",
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 3,
                circlePitchAlignment: "map" // <-- Lies flat on the 3D map plane
              }}
            />
          </NativeShapeSource>
        )}

        <RouteOverlay
          walkLegs={walkLegs}
          transitLegs={transitLegs}
          nodeMarkers={nodeMarkers}
          locMarkers={locMarkers}
          intermediateStops={intermediateStops}
          onIntermStopPress={setSelectedIntermStop}
          boardingNodeId={boardingNodeId}
          currentStepIndex={navState?.stepIndex ?? undefined}
          currentWalkLegIdx={currentWalkLegIdx}
          userLat={meLat ?? undefined}
          userLng={meLng ?? undefined}
        />

        {longPressCoord && !activeJourney && (
          <DroppedPin
            key={`pin-${Math.round(longPressCoord.latitude * 1e5)},${Math.round(longPressCoord.longitude * 1e5)}`}
            coord={longPressCoord}
            name={longPressName}
          />
        )}

        {!activeJourney && (
          <StopsLayer
            allStops={allStops}
            viewCenter={viewCenter}
            viewZoom={viewZoom}
            selected={selected}
            onPress={handleSelectStop}
          />
        )}
      </MapboxMapView>

      {/* Report pins overlay — RN layer above the map so Android never drops them. */}
      {layers.reports && (
        <ReportLayer
          ref={reportLayerRef}
          reports={activeReports}
          mapRef={mapRef}
          onPress={handleReportPress}
        />
      )}


      {!me && (
        <View style={s.locatingOverlay}>
          <ActivityIndicator size="large" color="#FF6F00" />
        </View>
      )}

      {locationPermissionDenied && (
        <Pressable onPress={openLocationSettings} style={s.permissionBanner}>
          <Text style={s.permissionText}>
            Location needed for navigation, tap to enable in Settings
          </Text>
        </Pressable>
      )}

      {/* Offline messaging: guests are prompted to sign in, signed-in users
          without a pack are prompted to download, and a compact pill confirms
          when the downloaded map is in use. */}
      {!isOnline && (
        offlinePack ? (
          <OfflineNotice variant="active" dark={dark} />
        ) : (
          <OfflineNotice
            variant={isAuthenticated ? "download" : "login"}
            dark={dark}
            onPress={() =>
              router.push((isAuthenticated ? "/(account)/offline-maps" : "/(auth)/login") as any)
            }
          />
        )
      )}

      <MapFloatingUI
        onRecenter={() => {
          setFollowMe(true);
          followMeRef.current = true;
          if (meRef.current) {
            isProgrammaticFlightRef.current = true;
            camera.animateTo({ 
              center: { latitude: meRef.current.latitude, longitude: meRef.current.longitude }, 
              zoom: 16, 
              duration: 450 
            });
            setTimeout(() => { isProgrammaticFlightRef.current = false; }, 500);
          }
        }}
        onOpenSearch={() => {
          if (chipJustPressedRef.current) { chipJustPressedRef.current = false; return; }
          router.push("/search");
        }}
        onOpenReport={() => setReportSheetOpen(true)}
        onOpenLayers={() => setLayersOpen(true)}
        onOpenKwame={() => { chipJustPressedRef.current = true; setNearestOpen(false); router.push("/kwame"); }}
        navigating={navigating}
        followMe={followMe}
        waitingForBus={tripStatus === "WAITING_FOR_BUS" && navStarted}
        onToggleNav={() => handleToggleNav(!navigating)}
        nextPreview={nextPreview}
        nextStep={nextStep}
        showNavSub={prefs.navHints === "detailed"}
        eta={navState?.eta ?? null}
        remainingDistanceM={navState?.remainingDistanceM ?? null}
        distanceToNextStepM={navState?.distanceToNextStepM ?? null}
        navStatus={navState?.status ?? null}
        stopsRemaining={navState?.stopsRemaining ?? null}
        arrivalSoonShown={navState?.status === "arrived"}
        gpsLost={gpsLost}
        wrongDirection={wrongDirection && navigating}
        currentSpeedKph={navigating ? speedKph : undefined}
        activeJourney={activeJourney}
        onClearJourney={handleClearJourney}
        nextNextPreview={nextNextPreview}
        approachPhase={navState?.approachPhase ?? null}
        cameraHeading={cameraHeading}
        onResetNorth={handleCompassPress}
        headingUp={headingUp}
        stepEta={stepEta}
        walkInstruction={walkInstruction}
        walkDestination={walkDestination}
bottomOffset={
          selected && !activeJourney && stopDetailsOpen ? 280
          : selected && !activeJourney ? 180
          : 0
        }
      />

      {selectedReport && (
        <ReportDetailCard
          report={selectedReport.report}
          clusterCount={selectedReport.count}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {reportSheetOpen && (
        <ReportSheet
          onClose={() => setReportSheetOpen(false)}
          userLat={meLat}
          userLng={meLng}
        />
      )}

      {rateVisible && <RateAppSheet onRate={onRate} onLater={onLater} />}

      <PostJourneySheet
        visible={showPostJourney}
        onDismiss={() => setShowPostJourney(false)}
        toName={activeJourney?.toLoc?.name}
        journeyRoute={activeJourney?.route?.summary}
        estimatedFare={(() => {
          const segs = activeJourney?.route?.segments ?? [];
          const first = segs.find((s: any) => s.mode !== "WALK" && s.fare);
          return first?.fare ? { amount: first.fare.amount, currency: first.fare.currency } : null;
        })()}
      />

      {!selected && !activeJourney && (
        <NearestStopsSheet nearestOpen={nearestOpen} setNearestOpen={setNearestOpen} nearest={nearestStops} me={me} onSelect={handleSelectStop} />
      )}

      {selected && !activeJourney && !stopDetailsOpen && (
        <StopQuickCard
          stop={selected}
          onClose={() => { setSelected(null); setFollowMe(true); }}
          onGoToStop={handleGoToStop}
          onViewDetails={() => setStopDetailsOpen(true)}
          loading={routeLoading}
        />
      )}

      {selected && !activeJourney && stopDetailsOpen && (
        <StopDetailsSheet
          stop={selected}
          onClose={() => setStopDetailsOpen(false)}
        />
      )}

      {selectedIntermStop && (
        <IntermStopInfoCard
          stop={selectedIntermStop}
          onClose={() => setSelectedIntermStop(null)}
          dark={dark}
        />
      )}

      {activeJourney && (
        <JourneyDetailsSheet activeJourney={activeJourney} routeLoading={routeLoading} routeInfo={routeInfo} navigating={navigating} onToggleNav={handleToggleNav} onClose={handleClearJourney} mToNice={mToNice} sToMin={sToMin} isSaved={isSaved} onSave={handleSaveJourney} onUnsave={handleUnsaveJourney} scrollRef={stepsScrollRef} eta={navState?.eta ?? null} remainingDistanceM={navState?.remainingDistanceM ?? null}>
          <RouteStepsList steps={steps} nextStepIdx={navState?.stepIndex ?? 0} navigating={navigating} selectedName={activeJourney.toLoc.name} stopsRemaining={navState?.stopsRemaining ?? null} stepETAs={navState?.stepETAs} scrollRef={stepsScrollRef} />
        </JourneyDetailsSheet>
      )}

      <SaveWall
        visible={showSaveWall}
        onDismiss={() => setShowSaveWall(false)}
        dark={dark}
      />

      <MapLayersSheet
        visible={layersOpen}
        onDismiss={() => setLayersOpen(false)}
        dark={dark}
      />
    </View>
  );
}

const s = StyleSheet.create({
  locatingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  permissionBanner: {
    position: "absolute", bottom: 100, left: 16, right: 16,
    backgroundColor: "#FF3B30", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    zIndex: 20,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  permissionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
