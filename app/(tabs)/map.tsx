// app/(tabs)/map.tsx
import JourneyDetailsSheet from "@/components/app/JourneyDetailsSheet";
import MapFloatingUI from "@/components/app/MapFloatingUI";
import NearestStopsSheet from "@/components/app/NearestStopsSheet";
import RouteStepsList from "@/components/app/RouteStepsList";
import StopDetailsSheet from "@/components/app/StopDetailsSheet";
import StopQuickCard from "@/components/app/StopQuickCard";
import StopsLayer from "@/components/app/StopsLayer";

import { useNavigation } from "@/hooks/useNavigation";
import { useMapCamera, zoomFromDelta, deltaFromZoom } from "@/hooks/useMapCamera";
import type { LatLng } from "@/providers/map/types";
import { RouteService } from "@/services/route";
import { StopService } from "@/services/stop";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
import { RouteInfo, Step, Stop, detectManeuver, getReportIcon, getRouteColor, humanizeStep, mToNice, sToMin } from "@/utils/mapHelpers";

import mapStyle     from "@/lib/map_style.json";
import mapStyleDark from "@/lib/map_style_dark.json";

import { useRouter } from "expo-router";
import { useSavedStore } from "@/store/savedStore";
import { usePrefsStore } from "@/store/prefsStore";
import { useAuthStore } from "@/store/authStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import ReportSheet from "@/components/app/ReportSheet";
import { ReportService, TransitReport, ReportCategory } from "@/services/report";

const ORANGE = "#FF6F00";

function LocationPin() {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
      <View style={{
        position: "absolute", width: 32, height: 32, borderRadius: 16,
        backgroundColor: "rgba(255,111,0,0.14)", borderWidth: 1, borderColor: "rgba(255,111,0,0.30)",
      }} />
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: ORANGE, borderWidth: 2.5, borderColor: "#FFFFFF",
        shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }, elevation: 6,
      }} />
    </View>
  );
}

// Small dot, intermediate stops along a transit leg
function IntermediateStopDot({ color }: { color: string }) {
  return (
    <View style={{
      width: 13, height: 13, borderRadius: 4.5,
      backgroundColor: color,
      borderWidth: 2, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.18,
      shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 4,
    }} />
  );
}

// Route-coloured circle with matatu icon, used for board / alight nodes
function StopNodeMarker({ color, onLoad }: { color: string; onLoad: () => void }) {
  return (
    <View style={{
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: color,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.28,
      shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 8,
    }}>
      <Image 
        source={require("@/assets/images/matatu.png")} 
        style={{ width: 16, height: 16 }} 
        resizeMode="contain" 
        onLoad={onLoad} // Pass the event up!
      />
    </View>
  );
}

function TrackedNodeMarker({ m }: { m: NodeMarker }) {
  const [tracking, setTracking] = useState(true);
  
  return (
    <Marker
      coordinate={m.coord}
      tracksViewChanges={tracking}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <StopNodeMarker color={m.color} onLoad={() => setTracking(false)} />
    </Marker>
  );
}

// Destination pin: dark label callout above the rounded square
function DestinationPin({ name }: { name: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{
        backgroundColor: "#1C1C1E",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        maxWidth: 160,
        marginBottom: 5,
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
      }}>
        <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700", letterSpacing: 0.2 }}>
          {name}
        </Text>
      </View>
      <SquarePin isStart={false} />
    </View>
  );
}

// Rounded square, used for origin (orange) and destination (dark)
function SquarePin({ isStart }: { isStart: boolean }) {
  return (
    <View style={{
      width: 20, height: 20, borderRadius: 5,
      backgroundColor: isStart ? ORANGE : "#1C1C1E",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.30,
      shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 8,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" }} />
    </View>
  );
}

// Force valid hex colors for the map engine
function sanitizeHex(color: string | null | undefined, fallbackName: string): string {
  if (!color) return getRouteColor(fallbackName);
  let clean = color.trim();
  if (!clean.startsWith("#")) clean = "#" + clean;
  // Fallback to our generator if the DB gives us invalid garbage like "#blue"
  const isValid = /^#([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(clean);
  return isValid ? clean : getRouteColor(fallbackName);
}

// Nairobi city centre default
const DEFAULT_REGION = {
  latitude:      -1.286389,
  longitude:     36.817223,
  latitudeDelta:  deltaFromZoom(13),
  longitudeDelta: deltaFromZoom(13),
};

// Projects a lat/lng point onto the nearest segment of a polyline.
// Keeps intermediate-stop dots exactly on the route line regardless of
// how far the GTFS stop is from the road-snapped geometry.
function projectOntoPolyline(point: LatLng, polyline: LatLng[]): LatLng {
  let bestDist = Infinity;
  let best = point;
  const px = point.longitude, py = point.latitude;

  for (let i = 0; i < polyline.length - 1; i++) {
    const ax = polyline[i].longitude,  ay = polyline[i].latitude;
    const bx = polyline[i + 1].longitude, by = polyline[i + 1].latitude;
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
    const qx = ax + t * abx, qy = ay + t * aby;
    const d = (px - qx) ** 2 + (py - qy) ** 2;
    if (d < bestDist) { bestDist = d; best = { latitude: qy, longitude: qx }; }
  }
  return best;
}

// Floating info card shown when an intermediate stop dot is tapped
function IntermStopInfoCard({
  stop, onClose, dark,
}: { stop: IntermediateStop; onClose: () => void; dark: boolean }) {
  const bg     = dark ? "#1C1C1E" : "#FFFFFF";
  const border = dark ? "#2C2C2E" : "#E5E5EA";
  const text   = dark ? "#FFFFFF" : "#111111";
  const sub    = dark ? "#8E8E93" : "#6B7280";

  return (
    <View style={[istyles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={istyles.cardInner}>
        <View style={[istyles.chip, { backgroundColor: stop.color + "22", borderColor: stop.color + "66" }]}>
          <View style={[istyles.chipDot, { backgroundColor: stop.color }]} />
          <Text style={[istyles.chipText, { color: stop.color }]}>{stop.routeName}</Text>
        </View>
        <View style={istyles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={[istyles.label, { color: sub }]}>Stop</Text>
            <Text style={[istyles.stopName, { color: text }]} numberOfLines={2}>{stop.name}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={[istyles.closeBtn, { backgroundColor: border }]}>
            <Text style={[istyles.closeX, { color: sub }]}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const istyles = StyleSheet.create({
  card: {
    position: "absolute", left: 16, right: 16, bottom: 260,
    borderRadius: 16, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  cardInner:  { padding: 16, gap: 10 },
  chip:       { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, gap: 6 },
  chipDot:    { width: 7, height: 7, borderRadius: 3.5 },
  chipText:   { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  nameRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  label:      { fontSize: 11, fontWeight: "500", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.4 },
  stopName:   { fontSize: 16, fontWeight: "700", lineHeight: 20 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  closeX:     { fontSize: 13, fontWeight: "600" },
});

// ── Internal overlay types (replace GeoJSON FeatureCollections) ──────────────

interface WalkLeg          { id: string; coords: LatLng[] }
interface TransitLeg       { id: string; coords: LatLng[]; color: string }
interface NodeMarker       { id: string; coord: LatLng; name: string; color: string }
interface LocMarker        { id: string; coord: LatLng; name: string; isStart: boolean }
interface IntermediateStop { id: string; coord: LatLng; color: string; name: string; routeName: string }

export default function MapScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const BG = dark ? '#0F0F0F' : '#F6F7F8';

  const { location: me, navState, locationPermissionDenied, openLocationSettings, gpsLost, wrongDirection, startNavigation, stopNavigation } = useNavigation();

  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const setJourney    = useJourneyStore((s) => s.setJourney);
  const tripStatus    = useJourneyStore((s) => s.tripStatus);
  const clearJourney  = useJourneyStore((s) => s.clearJourney);
  const navigating    = tripStatus === "IN_TRANSIT";

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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

  const stepsScrollRef = useRef<ScrollView>(null);
  const speedKph = Math.round((me?.speed ?? 0) * 3.6);

  const [showSaveWall, setShowSaveWall] = useState(false);

  const [followMe,    setFollowMe]    = useState(true);
  const [navStarted,  setNavStarted]  = useState(false);
  const [selected,    setSelected]    = useState<Stop | null>(null);

  const [routeInfo, setRouteInfo]     = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [steps, setSteps]             = useState<Step[]>([]);
  const [nearestOpen, setNearestOpen]   = useState(false);
  const [nearestStops, setNearestStops] = useState<UnifiedLocation[]>([]);

  // State to store the reports fetched for the current viewport
  const [activeReports, setActiveReports] = useState<TransitReport[]>([]);

  // State for the reporting flow
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // All stops for map clustering, loaded once on mount
  const [allStops, setAllStops] = useState<Stop[]>([]);

  // Stop card / details sheet
  const [stopDetailsOpen, setStopDetailsOpen] = useState(false);

  // Tapped non-stop location pin
  const [tappedCoord, setTappedCoord] = useState<{ lat: number; lng: number } | null>(null);

  const chipJustPressedRef = useRef(false);

  // Route overlay state, typed arrays instead of GeoJSON FeatureCollections
  const [walkLegs,         setWalkLegs]         = useState<WalkLeg[]>([]);
  const [transitLegs,      setTransitLegs]      = useState<TransitLeg[]>([]);
  const [nodeMarkers,      setNodeMarkers]      = useState<NodeMarker[]>([]);
  const [locMarkers,       setLocMarkers]       = useState<LocMarker[]>([]);
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStop[]>([]);
  const [selectedIntermStop, setSelectedIntermStop] = useState<IntermediateStop | null>(null);

  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewZoom,   setViewZoom]   = useState<number>(13);

  const mapRef      = useRef<MapView>(null);
  const lastCamTime = useRef<number>(0);
  const camera      = useMapCamera(mapRef);

  // Primitive extractions, let effects depend on scalar values, not the object
  // reference, so heading/speed changes don't trigger unnecessary re-runs.
  const meLat = me?.latitude  ?? null;
  const meLng = me?.longitude ?? null;

  // Handle report submission from the ReportSheet bottom sheet. Requires location permission and optionally authentication.
  const handleCreateReport = async (type: ReportCategory) => {
    if (!me) {
      Alert.alert("Location needed", "We need your current location to drop a report.");
      return;
    }
    
    // Optional: Protect against spam by requiring auth
    if (!isAuthenticated) {
      setReportSheetOpen(false);
      setShowSaveWall(true); // Reuse your auth wall!
      return;
    }

    setIsSubmittingReport(true);
    try {
      await ReportService.createReport(me.latitude, me.longitude, type);
      
      // Optimistically add it to the map right away so the user feels the instant feedback
      setActiveReports(prev => [
        ...prev, 
        { 
          id: `temp-${Date.now()}`, 
          type, 
          lat: me.latitude, 
          lng: me.longitude, 
          upvotes: 0, 
          expires_at: new Date(Date.now() + 3600000).toISOString() 
        }
      ]);
      
      setReportSheetOpen(false);
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please check your connection.");
      console.error(e);
    } finally {
      setIsSubmittingReport(false);
    }
  };


  // ── All stops, fetched once on mount for map clustering ────────────────────

  useEffect(() => {
    StopService.getAllStops()
      .then((stops) => setAllStops(stops as unknown as Stop[]))
      .catch((e) => console.warn("Failed to load all stops", e));
  }, []);

  // ── Nearest stops fetch ──────────────────────────────────────────────────────

  useEffect(() => {
    if (meLat == null || meLng == null || !nearestOpen) return;
    StopService.getNearbyStops(meLat, meLng, 2000, 5)
      .then(setNearestStops)
      .catch((e) => console.warn(e));
  }, [meLat, meLng, nearestOpen]);

  // ── Follow mode (exploration, non-navigation) ────────────────────────────────
  // North-up during browsing; no heading rotation so the map stays stable.

  useEffect(() => {
    if (meLat == null || meLng == null || !followMe || navigating) return;
    camera.animateTo({ center: { latitude: meLat, longitude: meLng }, zoom: 16, heading: 0, duration: 300 });
  }, [meLat, meLng, followMe, navigating, camera]);

  // ── Navigation camera (device-bearing locked, pitch 45) ─────────────────────
  // Use the live device heading so the map rotates with the user, exactly like
  // Google Maps navigation. Fall back to route segment bearing if heading is
  // unavailable (e.g. no compass on device or speed too low for GPS heading).

  useEffect(() => {
    if (!me || !followMe || !navigating || !navState) return;
    const now = Date.now();
    if (now - lastCamTime.current < 320) return;
    lastCamTime.current = now;

    camera.animateTo({
      center:  { latitude: me.latitude, longitude: me.longitude },
      zoom:    18.0 + (Math.min(me.speed ?? 0, 2.0) / 2.0) * 0.15,
      heading: me.heading ?? navState.routeBearing ?? 0,
      pitch:   prefs.navView === "tilted" ? 45 : 0,
      duration: 300,
    });
  }, [me, followMe, navigating, navState, camera]);

  // ── Journey overlay builder ───────────────────────────────────────────────────

  useEffect(() => {
    if (!activeJourney) {
      setWalkLegs([]);
      setTransitLegs([]);
      setNodeMarkers([]);
      setLocMarkers([]);
      setIntermediateStops([]);
      return;
    }

    setSelected(null);
    setFollowMe(false);
    if (!activeJourney.route.is_ai_derived) setRouteLoading(true);

    const build = async () => {
      try {
        const { route, fromLoc, toLoc } = activeJourney;
        const segments = route.segments;
        if (!segments?.length) return;

        const summarySteps: Step[]             = [];
        const newWalkLegs: WalkLeg[]           = [];
        const newTransitLegs: TransitLeg[]     = [];
        const newNodeMarkers: NodeMarker[]     = [];
        const newLocMarkers: LocMarker[]       = [];
        const newIntermStops: IntermediateStop[] = [];

        if (fromLoc._type !== "stop" && fromLoc.id !== "current_location") {
          newLocMarkers.push({ id: "loc-from", coord: { latitude: fromLoc.lat, longitude: fromLoc.lng }, name: fromLoc.name, isStart: true });
        }
        if (toLoc._type !== "stop" && toLoc.id !== "current_location") {
          newLocMarkers.push({ id: "loc-to", coord: { latitude: toLoc.lat, longitude: toLoc.lng }, name: toLoc.name, isStart: false });
        }

        // if (fromLoc._type === "location" && fromLoc.id !== "current_location") {
        //   newLocMarkers.push({ id: "loc-from", coord: { latitude: fromLoc.lat, longitude: fromLoc.lng }, name: fromLoc.name, isStart: true });
        // }
        // if (toLoc._type === "location" && toLoc.id !== "current_location") {
        //   newLocMarkers.push({ id: "loc-to", coord: { latitude: toLoc.lat, longitude: toLoc.lng }, name: toLoc.name, isStart: false });
        // }

        // Collect all coords for initial camera fit
        let allCoords: LatLng[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];

          // seg.coordinates is [[lat, lng], ...] from the API
          const coords: LatLng[] = seg.coordinates.map(([lat, lng]) => ({
            latitude: lat, longitude: lng,
          }));

          allCoords = allCoords.concat(coords);

          if (seg.mode === "WALK") {
            newWalkLegs.push({ id: `walk-${i}`, coords });
            summarySteps.push({
              instruction: `Walk to ${seg.to.name === "Destination" ? toLoc.name : seg.to.name}`,
              distance: seg.distance,
              duration: seg.duration,
              location: [seg.to.lng, seg.to.lat],
              type: "walk",
              subSteps: (seg.walk_steps ?? []).map((ws: any) => ({
                instruction: ws.instruction,
                note:        ws.note,
                distance:    ws.distance,
                duration:    ws.duration,
                lat:         ws.lat,
                lng:         ws.lng,
                maneuver:    detectManeuver(ws.instruction),
              })),
            });
          } else {
            const color    = sanitizeHex(seg.route_color, seg.route_name ?? "");
            const fromName = seg.from.name === "Origin"      ? fromLoc.name : seg.from.name;
            const toName   = seg.to.name   === "Destination" ? toLoc.name   : seg.to.name;

            newTransitLegs.push({ id: `transit-${i}`, coords, color });
            newNodeMarkers.push(
              { id: `node-from-${i}`, coord: { latitude: seg.from.lat, longitude: seg.from.lng }, name: fromName, color },
              { id: `node-to-${i}`,   coord: { latitude: seg.to.lat,   longitude: seg.to.lng   }, name: toName,   color },
            );
            // Intermediate stops (index 0 = boarding, last = alighting, skip both)
            // Project onto the polyline so dots sit exactly on the road-snapped line.
            (seg.stops ?? []).slice(1, -1).forEach((stop: any, j: number) => {
              if (stop.lat && stop.lng) {
                const projected = projectOntoPolyline({ latitude: stop.lat, longitude: stop.lng }, coords);
                newIntermStops.push({ id: `interm-${i}-${j}`, coord: projected, color, name: stop.name ?? "", routeName: seg.route_name ?? "" });
              }
            });
            summarySteps.push(
              { instruction: `Board Line ${seg.route_name} at ${fromName}`, distance: 0,            duration: 0,            location: [seg.from.lng, seg.from.lat], type: "depart", routeName: seg.route_name ?? undefined, routeColor: color, stops: seg.stops },
              { instruction: `Alight at ${toName}`,                         distance: seg.distance, duration: seg.duration, location: [seg.to.lng,   seg.to.lat  ], type: "arrive", routeName: seg.route_name ?? undefined, routeColor: color },
            );
          }
        }

        setWalkLegs(newWalkLegs);
        setTransitLegs(newTransitLegs);
        setNodeMarkers(newNodeMarkers);
        setLocMarkers(newLocMarkers);
        setIntermediateStops(newIntermStops);
        setSteps(summarySteps);
        setRouteInfo({ distance: route.total_distance, duration: route.total_duration });

        // Fit camera to first leg
        const firstSegCoords: LatLng[] = segments[0].coordinates
          .map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
          .filter(({ latitude, longitude }) => latitude !== 0 && longitude !== 0 && !isNaN(latitude));

        if (firstSegCoords.length > 1) {
          camera.fitCoordinates(firstSegCoords, { top: 140, right: 40, bottom: 320, left: 40 });
        }
      } catch (err) {
        console.warn("Failed to build journey overlays", err);
      } finally {
        setRouteLoading(false);
      }
    };

    build();
  }, [activeJourney, camera]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleClearJourney = useCallback(() => {
    stopNavigation();
    clearJourney();
    setSteps([]);
    setFollowMe(true);
    setNavStarted(false);
    setTappedCoord(null);
    setSelectedIntermStop(null);
  }, [stopNavigation, clearJourney]);

  const handleSelectStop = useCallback((s: Stop) => {
    stopNavigation();
    setFollowMe(false);
    setSelected(s);
    setStopDetailsOpen(false);
    setNearestOpen(false);
    setTappedCoord(null);
    camera.animateTo({ center: { latitude: s.lat, longitude: s.lng }, zoom: 17.2, duration: 500 });
  }, [stopNavigation, camera]);

  const handleGoToStop = useCallback(async () => {
    if (!me || !selected) return;
    setRouteLoading(true);
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
    } finally {
      setRouteLoading(false);
    }
  }, [me, selected, setJourney]);

  // Auto-start navigation when Kwame sets an AI-derived journey from its own screen
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

  const handleToggleNav = useCallback((nextState: boolean) => {
    if (nextState) { startNavigation(); setFollowMe(true);  setNavStarted(true);  }
    else           { stopNavigation();  setFollowMe(false); setNavStarted(false); }
  }, [startNavigation, stopNavigation]);

  // ── Region change → update zoom + center for StopsLayer ──────────────────────

  // const onRegionChangeComplete = useCallback((region: any, details: any) => {
  //   if (details?.isGesture) setFollowMe(false);
  //   setViewZoom(zoomFromDelta(region.latitudeDelta));
  //   setViewCenter({ lat: region.latitude, lng: region.longitude });
  // }, []);

  const onRegionChangeComplete = useCallback(async (region: any, details: any) => {
    if (details?.isGesture) setFollowMe(false);
    setViewZoom(zoomFromDelta(region.latitudeDelta));
    setViewCenter({ lat: region.latitude, lng: region.longitude });

    // 1. Calculate the bounding box for the spatial query
    const north = region.latitude + region.latitudeDelta / 2;
    const south = region.latitude - region.latitudeDelta / 2;
    const east = region.longitude + region.longitudeDelta / 2;
    const west = region.longitude - region.longitudeDelta / 2;

    // 2. Fetch reports from Laravel
    try {
      const reports = await ReportService.getReportsInViewport(north, south, east, west);
      setActiveReports(reports);
    } catch (err) {
      console.warn("Failed to fetch viewport reports", err);
    }
  }, []);

  const nextStep    = steps[navState?.stepIndex ?? 0];
  const nextPreview = prefs.navHints === "off" || !nextStep ? null : humanizeStep(nextStep);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={!!me}
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings={true}
        onRegionChangeComplete={onRegionChangeComplete}
        customMapStyle={dark ? mapStyleDark : mapStyle}
      >
        {/* Walking route legs, dashed grey, below transit */}
        {walkLegs.map((leg) => (
          <Polyline
            key={leg.id}
            coordinates={leg.coords}
            strokeColor="#8E8E93"
            strokeWidth={3}
            lineDashPattern={[6, 5]}
            // zIndex={1}
          />
        ))}

        {/* Transit route legs, road-snapped, solid, route-coloured */}
        {transitLegs.map((leg) => (
          
          <Polyline
            key={`${leg.id}-${leg.color}`}
            coordinates={leg.coords}
            strokeColor={leg.color}
            strokeWidth={5}
            // zIndex={2}
            geodesic
          />
        ))}

        {/* Intermediate stops, small route-coloured dots between board and alight */}
        {intermediateStops.map((s) => (
          <Marker
            key={s.id}
            coordinate={s.coord}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
            onPress={() => setSelectedIntermStop(s)}
          >
            <IntermediateStopDot color={s.color} />
          </Marker>
        ))}

        {/* Board/alight node markers, route-coloured circle with matatu icon */}
        {nodeMarkers.map((m) => (
          <TrackedNodeMarker key={m.id} m={m} />
        ))}

        {/* Origin / destination, branded rounded square (Uber-style) */}
        {locMarkers.map((m) => (
          <Marker
            key={m.id}
            coordinate={m.coord}
            tracksViewChanges={false}
            anchor={m.isStart ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.8 }}
          >
            {m.isStart ? <SquarePin isStart /> : <DestinationPin name={m.name} />}
          </Marker>
        ))}

        {/* Crowdsourced reports */}
        {activeReports.map((report) => (
          <Marker 
            key={report.id} 
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            tracksViewChanges={false}
            zIndex={4} // High z-index to sit above polylines and intermediate dots
          >
            <View style={styles.reportPin}>
               <Text style={styles.reportIconText}>{getReportIcon(report.type)}</Text>
            </View>
          </Marker>
        ))}

        {/* Heading arrow during navigation */}
        {navigating && me && (
          <Marker
            coordinate={{ latitude: me.latitude, longitude: me.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={me.heading ?? 0}
            tracksViewChanges
          >
            <View style={styles.headingArrow} />
          </Marker>
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
      </MapView>

      {!me && (
        <View style={styles.locatingOverlay}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      )}

      {locationPermissionDenied && (
        <Pressable
          onPress={openLocationSettings}
          style={styles.permissionBanner}
        >
          <Text style={styles.permissionText}>
            Location needed for navigation, tap to enable in Settings
          </Text>
        </Pressable>
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
        bottomOffset={
          selected && !activeJourney && stopDetailsOpen ? 280
          : selected && !activeJourney ? 180
          : 0
        }
      />

      {/* <ReportSheet 
        isOpen={reportSheetOpen}
        onClose={() => setReportSheetOpen(false)}
        onSubmit={handleCreateReport}
        isSubmitting={isSubmittingReport}
      /> */}

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
        <JourneyDetailsSheet activeJourney={activeJourney} routeLoading={routeLoading} routeInfo={routeInfo} navigating={navigating} onToggleNav={handleToggleNav} onClose={handleClearJourney} mToNice={mToNice} sToMin={sToMin} isSaved={isSaved} onSave={handleSaveJourney} onUnsave={handleUnsaveJourney} scrollRef={stepsScrollRef}>
          <RouteStepsList steps={steps} nextStepIdx={navState?.stepIndex ?? 0} navigating={navigating} selectedName={activeJourney.toLoc.name} stopsRemaining={navState?.stopsRemaining ?? null} stepETAs={navState?.stepETAs} scrollRef={stepsScrollRef} />
        </JourneyDetailsSheet>
      )}

      {showSaveWall && (
        <View style={styles.saveWallBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSaveWall(false)} />
          <View style={[styles.saveWallCard, { backgroundColor: dark ? "#1C1C1E" : "#FFFFFF" }]}>
            <View style={styles.saveWallHandle} />
            <View style={styles.saveWallIconWrap}>
              <Ionicons name="bookmark-outline" size={26} color={ORANGE} />
            </View>
            <Text style={[styles.saveWallTitle, { color: dark ? "#FFF" : "#1C1C1E" }]}>
              Save this journey
            </Text>
            <Text style={[styles.saveWallSub, { color: dark ? "#8E8E93" : "#6B7280" }]}>
              Sign in to save journeys and access them later.
            </Text>
            <Pressable
              style={styles.saveWallBtn}
              onPress={() => { setShowSaveWall(false); router.push("/(auth)/login"); }}
            >
              <Text style={styles.saveWallBtnText}>Sign in</Text>
            </Pressable>
            <Pressable style={styles.saveWallDismiss} onPress={() => setShowSaveWall(false)}>
              <Text style={[styles.saveWallDismissText, { color: dark ? "#8E8E93" : "#6B7280" }]}>
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
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
  headingArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#007AFF",
  },

  saveWallBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    zIndex: 50,
  },
  saveWallCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  saveWallHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C7C7CC",
    alignSelf: "center",
    marginBottom: 8,
  },
  saveWallIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,111,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  saveWallTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  saveWallSub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: 4,
  },
  saveWallBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#FF6F00",
    justifyContent: "center",
    alignItems: "center",
  },
  saveWallBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  saveWallDismiss: { paddingVertical: 10 },
  saveWallDismissText: { fontSize: 14, fontWeight: "500" },

  reportPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FF3B30", // Using a red border to indicate an alert
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  reportIconText: {
    fontSize: 14,
  },
});
