// app/(tabs)/map.tsx
import { IntermStopInfoCard }    from "@/components/map/IntermStopInfoCard";
import { MapLayersSheet }        from "@/components/map/MapLayersSheet";
import { OfflineNotice }         from "@/components/map/OfflineNotice";
import { ReportLayer }           from "@/components/map/ReportLayer";
import type { ReportLayerHandle } from "@/components/map/ReportLayer";
import { RouteOverlay }          from "@/components/map/RouteOverlay";
import { SaveWall }              from "@/components/map/SaveWall";
import { NavIndicator }           from "@/components/map/NavIndicator";
import { DestinationPin }         from "@/components/map/RouteMarkers";
import { DEFAULT_REGION }      from "@/components/map/types";
import type { IntermediateStop } from "@/components/map/types";
import JourneyDetailsSheet     from "@/components/app/JourneyDetailsSheet";
import MapFloatingUI           from "@/components/app/MapFloatingUI";
import NearestStopsSheet       from "@/components/app/NearestStopsSheet";
import ReportDetailCard        from "@/components/app/ReportDetailCard";
import ReportSheet             from "@/components/app/ReportSheet";
import RouteStepsList          from "@/components/app/RouteStepsList";
import StopDetailsSheet        from "@/components/app/StopDetailsSheet";
import StopQuickCard           from "@/components/app/StopQuickCard";
import StopsLayer              from "@/components/app/StopsLayer";

import { useNavigation }       from "@/hooks/useNavigation";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { MapView as MapboxMapView, Camera as MapboxCamera, RasterSource, RasterLayer, PointAnnotation } from "@rnmapbox/maps";
import { MapService } from "@/services/map";

const { width: SW, height: SH } = Dimensions.get("window");

export default function MapScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const BG = dark ? "#0F0F0F" : "#F6F7F8";

  const { location: me, navState, locationPermissionDenied, openLocationSettings, gpsLost, wrongDirection, startNavigation, stopNavigation } = useNavigation();

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
  const [followMe,        setFollowMe]        = useState(true);
  const [headingUp,       setHeadingUp]       = useState(false);
  const [navIndicatorPos, setNavIndicatorPos] = useState<{ x: number; y: number } | null>(null);
  const [navStarted,      setNavStarted]      = useState(false);
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
  const [longPressCoord, setLongPressCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [longPressName,  setLongPressName]  = useState<string>("Dropped pin");

  const mapRef             = useRef<MapboxMapView>(null);
  const cameraRef          = useRef<MapboxCamera>(null);
  const camera             = useMapCamera(mapRef, cameraRef);
  const chipJustPressedRef = useRef(false);
  const relockRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const meLat = me?.latitude  ?? null;
  const meLng = me?.longitude ?? null;

  // ── Route overlay (extracted hook) ───────────────────────────────────────────

  const { walkLegs, transitLegs, nodeMarkers, locMarkers, intermediateStops, steps, routeInfo, routeLoading } =
    useRouteOverlay(activeJourney, camera);

  // Reset map UI when a journey is set or cleared.
  useEffect(() => {
    if (activeJourney) {
      setSelected(null);
      setFollowMe(false);
    } else {
      setFollowMe(true);
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

    // `smooth` is the EMA heading; `committed` is the last value sent to the
    // camera (only advances past the dead-zone).
    let smooth    = useHeadingStore.getState().heading || 0;
    let committed = smooth;

    // ── Sensor fusion state ──────────────────────────────────────────────────
    // GPS course (pos.heading) updates every ~3 s. If we drive the camera
    // directly from it, rotation lags 3 s behind every turn. Instead we use:
    //   anchorGps  = GPS course at the last re-anchor point  (accurate direction)
    //   anchorCmp  = compass reading at that same moment
    //   compassDelta = compass_now − anchorCmp  (turn magnitude since anchor)
    //   fused      = anchorGps + compassDelta   (real-time bearing estimate)
    // The compass tracks turns at 12 Hz → no 3-s lag. The GPS anchor prevents
    // compass drift from accumulating (re-anchored every ~2.5 s).
    let anchorGps    = smooth;
    let anchorCmp    = useHeadingStore.getState().heading;
    let lastAnchorMs = 0;

    // Immediately orient the map: north-up or heading-up, whichever is active.
    // Without this, the camera keeps whatever heading it had from explore mode.
    if (!headingUpRef.current) {
      camera.animateTo({ heading: 0, duration: 400 });
      lastSentHdgRef.current = 0;
    } else {
      lastSentHdgRef.current = committed;
    }

    const id = setInterval(() => {
      const pos = meRef.current;
      if (!pos) return;
      // Don't fight an active user gesture — let it settle, then onRegionChangeComplete
      // will clear this flag and (if it was a pan) set followMe=false.
      if (isUserGesturingRef.current) return;

      const vehicleMode = isVehicleModeRef.current;
      const speed       = pos.speed ?? 0;
      const compass     = useHeadingStore.getState().heading;
      const gpsHeading  = pos.heading ?? null;
      const gpsWeight   = Math.min(1.0, Math.max(0, (speed - 0.5) / 2.5));
      const now         = Date.now();

      // Re-anchor to GPS roughly every 2.5 s so accumulated compass drift resets.
      if (gpsHeading != null && now - lastAnchorMs >= 2500) {
        anchorGps    = gpsHeading;
        anchorCmp    = compass;
        lastAnchorMs = now;
      }

      // Fused bearing: GPS tells us WHERE we're pointed; compass tells us HOW
      // MUCH we've turned since the last anchor. Together they give a smooth,
      // real-time heading without 3-s GPS lag.
      let rawHeading: number;
      if (gpsWeight > 0 && gpsHeading != null) {
        const compassDelta = ((compass - anchorCmp + 540) % 360) - 180;
        const fused        = (anchorGps + compassDelta + 360) % 360;
        rawHeading         = fused * gpsWeight + compass * (1 - gpsWeight);
      } else {
        rawHeading = compass;
      }

      // EMA — α raised so a 90° turn is ~90% complete within 200ms.
      const diff = ((rawHeading - smooth + 540) % 360) - 180;
      smooth     = (smooth + (vehicleMode ? 0.75 : 0.88) * diff + 360) % 360;

      // Dead-zone 1.0°: tight enough to track gradual curves continuously,
      // wide enough to swallow sub-degree compass noise.
      const delta = Math.abs(((smooth - committed + 540) % 360) - 180);
      if (delta >= 1.0) committed = smooth;

      // Speed-adaptive zoom — calibrated for Nairobi transit speeds.
      // Walking stays at 19, a 40 km/h matatu lands around 17.6, highway ~16.
      const speedKphCam = speed * 3.6;
      const zoom =
        speedKphCam < 5  ? 19.0
      : speedKphCam < 30 ? 19.0 - ((speedKphCam -  5) / 25) * 1.0
      : speedKphCam < 80 ? 18.0 - ((speedKphCam - 30) / 50) * 1.5
      :                    16.5 - ((speedKphCam - 80) / 40) * 1.0;
      const finalZoom = Math.max(15.0, Math.min(19.0, zoom));

      // Sheet-aware center offset: the collapsed JourneyDetailsSheet is ~310 px
      // tall. At walking zoom (18) the raw 80 m forward offset puts the dot ~134 px
      // below screen centre, which lands behind the sheet. We compensate by
      // computing how many metres correspond to half the sheet height at this zoom
      // and subtracting that from the forward offset — placing the dot in the
      // centre of the visible area above the sheet on every device.
      const mpp = (Math.cos(pos.latitude * Math.PI / 180) * 156543) / Math.pow(2, finalZoom);
      const sheetCompM = Math.min(100, 155 * mpp); // 155 px ≈ half sheet height
      // Vehicle: place dot at 70% screen height (SH*0.20 px below map centre).
      // Walk: fixed 50 m forward offset minus sheet compensation.
      const netOffsetM = vehicleMode ? SH * 0.20 * mpp : 50 - sheetCompM;

      const hRad      = (committed * Math.PI) / 180;
      const cosLat    = Math.cos(pos.latitude * Math.PI / 180);
      const offsetDeg = netOffsetM / 111_320;
      // In north-up mode the camera always offsets due north (camHRad=0) so phone
      // rotation never moves the map center. Heading-up offsets in travel direction.
      const camHRad   = headingUpRef.current ? hRad : 0;
      const centerLat = pos.latitude  + offsetDeg * Math.cos(camHRad);
      const centerLng = pos.longitude + offsetDeg * Math.sin(camHRad) / cosLat;

      const pitch = navViewRef.current === "tilted" ? (vehicleMode ? 60 : 45) : 0;

      // Heading: committed (heading-up) or 0 (north-up, default).
      // Only push to camera when the change exceeds 2° to prevent micro-animation
      // churn that produces the brief "double render" artifact on Android.
      const targetHeading = headingUpRef.current ? committed : 0;
      const hdgDelta = Math.abs(((targetHeading - lastSentHdgRef.current + 540) % 360) - 180);
      // Dead-zone thresholds:
      //   heading-up: 1° — user wants real-time map rotation; 5° increments feel jerky
      //   vehicle:    2° — fast movement gives reliable GPS heading; tight threshold is fine
      //   walk:       5° — GPS heading is noisy at low speed; wider gate prevents jitter
      // In heading-up mode send heading even at rest (compass tracks direction without moving).
      // In north-up mode targetHeading is always 0, so this rarely sends anything.
      const hdgThreshold = headingUpRef.current ? 1.0 : (vehicleMode ? 2.0 : 5.0);
      const sendHdg = hdgDelta >= hdgThreshold && (headingUpRef.current || speed >= 0.5);
      if (sendHdg) lastSentHdgRef.current = targetHeading;

      // NavIndicator position: in both north-up and heading-up modes the user is
      // directly below the camera center (camera is always offset "forward" from user),
      // so the dot is always at horizontal center, pixelsBehind below map centre.
      const pitchFactor  = Math.cos((pitch * Math.PI) / 180);
      const pixelsBehind = (netOffsetM / mpp) * pitchFactor;
      setNavIndicatorPos({ x: SW / 2, y: SH / 2 + pixelsBehind });

      camera.animateTo({
        center:   { latitude: centerLat, longitude: centerLng },
        zoom:     finalZoom,
        ...(sendHdg ? { heading: targetHeading } : {}),
        pitch,
        duration: 80,
      });
    }, 130); // ~7.7 Hz — 50 ms gap after each 80 ms animation prevents overlap

    return () => clearInterval(id);
  }, [navigating, followMe, camera]); // prefs.navView via navViewRef — no interval restart needed

  // ── Auto-start navigation for AI-derived journeys ─────────────────────────────

  const prevJourneyRouteRef = useRef<any>(null);
  useEffect(() => {
    if (!activeJourney) { prevJourneyRouteRef.current = null; return; }
    if (activeJourney.route === prevJourneyRouteRef.current) return;
    prevJourneyRouteRef.current = activeJourney.route;
    if (activeJourney.route.is_ai_derived) {
      setFollowMe(true);
      setNavStarted(true);
      setTimeout(() => startNavigation(), 300);
    }
  }, [activeJourney, startNavigation]);

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
    if (nextState) { startNavigation(); setFollowMe(true);  setNavStarted(true);  }
    else           { stopNavigation();  setFollowMe(false); setNavStarted(false); }
  }, [startNavigation, stopNavigation]);

  const handleCompassPress = useCallback(() => {
    if (!navigating) {
      // Outside nav: classic north-reset
      camera.animateTo({ heading: 0, pitch: 0, duration: 400 });
      setCameraHeading(0);
      return;
    }
    if (!followMe) {
      // Panned away: re-lock + north-up
      setFollowMe(true);
      setHeadingUp(false);
    } else if (!headingUp) {
      // Following + north-up → switch to heading-up
      setHeadingUp(true);
    } else {
      // Following + heading-up → back to north-up
      setHeadingUp(false);
      camera.animateTo({ heading: 0, duration: 400 });
      setCameraHeading(0);
    }
  }, [navigating, followMe, headingUp, camera]);

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

  // Fires continuously during pan/zoom. We use the isGesture flag to set
  // isUserGesturingRef immediately — this pauses the nav camera interval so it
  // never fights an in-progress user gesture. onRegionChangeComplete clears it.
  // Mapbox onRegionIsChanging — feature.properties.isUserInteraction is the gesture flag.
  const handleRegionChange = useCallback((feature: any) => {
    if (feature?.properties?.isUserInteraction) isUserGesturingRef.current = true;
    const now = Date.now();
    if (now - lastProjectCallRef.current >= 50) {
      lastProjectCallRef.current = now;
      reportLayerRef.current?.project();
    }
  }, []);

  // Mapbox onRegionDidChange — heading is in feature.properties, no getCamera() needed.
  const onRegionChangeComplete = useCallback(async (feature: any) => {
    const [lng, lat] = (feature?.geometry?.coordinates as [number, number]) ?? [DEFAULT_REGION.longitude, DEFAULT_REGION.latitude];
    const newZoom   = feature?.properties?.zoomLevel   ?? 13;
    const isGesture = feature?.properties?.isUserInteraction ?? false;

    if (isGesture) {
      // Gesture is done — clear the guard so the nav interval can resume.
      isUserGesturingRef.current = false;
      const prev = prevRegionRef.current;
      if (navigating && prev) {
        // Nav mode: pinch-zoom (zoom changes, centre barely moves) keeps follow.
        // Pan (centre moves) disables follow so the user can freely explore.
        const isPinch = Math.abs(newZoom - prev.zoom) > 0.3
          && Math.abs(lat - prev.lat) < 0.0003
          && Math.abs(lng - prev.lng) < 0.0003;
        if (!isPinch) setFollowMe(false);
      } else {
        setFollowMe(false);
      }
    }
    prevRegionRef.current = { lat, lng, zoom: newZoom };
    if (feature?.properties?.heading != null) setCameraHeading(feature.properties.heading);
    setViewZoom(newZoom);
    setViewCenter({ lat, lng });
    reportLayerRef.current?.project();

    // Use getVisibleBounds for accurate report-fetch bounding box.
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
          viewZoom={viewZoom}
        />

        {longPressCoord && !activeJourney && (
          <PointAnnotation
            id="dropped-pin"
            coordinate={[longPressCoord.longitude, longPressCoord.latitude]}
            anchor={{ x: 0.5, y: 1.0 }}
          >
            <DestinationPin name={longPressName} />
          </PointAnnotation>
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

      {/* Report pins overlay — a plain RN layer above the map (NOT map markers),
          so Android PROVIDER_GOOGLE can never drop them on zoom/tile reloads.
          Positions are projected from lat/lng via mapRef.pointForCoordinate. */}
      {layers.reports && (
        <ReportLayer
          ref={reportLayerRef}
          reports={activeReports}
          mapRef={mapRef}
          onPress={handleReportPress}
        />
      )}

      {/* NavIndicator is a React Native View overlay — NOT a map overlay.
          Lives above the MapView so Android can never drop it during camera
          animations. Switches between explore cone / walk cone / vehicle chevron. */}
      {me && (
        <NavIndicator
          latitude={me.latitude}
          longitude={me.longitude}
          mapRef={mapRef}
          navigating={navigating}
          isVehicleMode={isVehicleMode}
          fixedPos={navigating && followMe ? navIndicatorPos ?? undefined : undefined}
          headingUp={headingUp}
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
          if (me) camera.animateTo({ center: { latitude: me.latitude, longitude: me.longitude }, zoom: 16, duration: 450 });
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
