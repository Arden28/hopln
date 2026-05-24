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
import { RouteInfo, Step, Stop, detectManeuver, getRouteColor, humanizeStep, mToNice, sToMin } from "@/utils/mapHelpers";

import mapStyle     from "@/lib/map_style.json";
import mapStyleDark from "@/lib/map_style_dark.json";

import { useRouter } from "expo-router";
import { useSavedStore } from "@/store/savedStore";
import { usePrefsStore } from "@/store/prefsStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View, useColorScheme } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";

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

// Route-coloured circle with matatu icon — used for board / alight nodes
function StopNodeMarker({ color }: { color: string }) {
  return (
    <View style={{
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: color,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.28,
      shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 8,
    }}>
      <Image source={require("@/assets/images/matatu.png")} style={{ width: 16, height: 16 }} resizeMode="contain" />
    </View>
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

// Rounded square — used for origin (orange) and destination (dark)
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

// Nairobi city centre default
const DEFAULT_REGION = {
  latitude:      -1.286389,
  longitude:     36.817223,
  latitudeDelta:  deltaFromZoom(13),
  longitudeDelta: deltaFromZoom(13),
};

// ── Internal overlay types (replace GeoJSON FeatureCollections) ──────────────

interface WalkLeg      { id: string; coords: LatLng[] }
interface TransitLeg   { id: string; coords: LatLng[]; color: string }
interface NodeMarker   { id: string; coord: LatLng; name: string; color: string }
interface LocMarker    { id: string; coord: LatLng; name: string; isStart: boolean }

export default function MapScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const BG = dark ? '#0F0F0F' : '#F6F7F8';

  const { location: me, navState, startNavigation, stopNavigation } = useNavigation();

  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const setJourney    = useJourneyStore((s) => s.setJourney);
  const tripStatus    = useJourneyStore((s) => s.tripStatus);
  const clearJourney  = useJourneyStore((s) => s.clearJourney);
  const navigating    = tripStatus === "IN_TRANSIT";

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

  const [followMe, setFollowMe]   = useState(true);
  const [selected, setSelected]   = useState<Stop | null>(null);

  const [routeInfo, setRouteInfo]     = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [steps, setSteps]             = useState<Step[]>([]);
  const [stepsOpen, setStepsOpen]     = useState(false);

  const [nearestOpen, setNearestOpen]   = useState(false);
  const [nearestStops, setNearestStops] = useState<UnifiedLocation[]>([]);

  // All stops for map clustering — loaded once on mount
  const [allStops, setAllStops] = useState<Stop[]>([]);

  // Stop card / details sheet
  const [stopDetailsOpen, setStopDetailsOpen] = useState(false);

  // Tapped non-stop location pin
  const [tappedCoord, setTappedCoord] = useState<{ lat: number; lng: number } | null>(null);

  const chipJustPressedRef = useRef(false);

  // Route overlay state — typed arrays instead of GeoJSON FeatureCollections
  const [walkLegs,    setWalkLegs]    = useState<WalkLeg[]>([]);
  const [transitLegs, setTransitLegs] = useState<TransitLeg[]>([]);
  const [nodeMarkers, setNodeMarkers] = useState<NodeMarker[]>([]);
  const [locMarkers,  setLocMarkers]  = useState<LocMarker[]>([]);

  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewZoom,   setViewZoom]   = useState<number>(13);

  const mapRef      = useRef<MapView>(null);
  const lastCamTime = useRef<number>(0);
  const camera      = useMapCamera(mapRef);

  // Primitive extractions — let effects depend on scalar values, not the object
  // reference, so heading/speed changes don't trigger unnecessary re-runs.
  const meLat = me?.latitude  ?? null;
  const meLng = me?.longitude ?? null;


  // ── All stops — fetched once on mount for map clustering ────────────────────

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

        const summarySteps: Step[]  = [];
        const newWalkLegs: WalkLeg[]       = [];
        const newTransitLegs: TransitLeg[] = [];
        const newNodeMarkers: NodeMarker[] = [];
        const newLocMarkers: LocMarker[]   = [];

        if (fromLoc._type === "location" && fromLoc.id !== "current_location") {
          newLocMarkers.push({ id: "loc-from", coord: { latitude: fromLoc.lat, longitude: fromLoc.lng }, name: fromLoc.name, isStart: true });
        }
        if (toLoc._type === "location" && toLoc.id !== "current_location") {
          newLocMarkers.push({ id: "loc-to", coord: { latitude: toLoc.lat, longitude: toLoc.lng }, name: toLoc.name, isStart: false });
        }

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
            const color    = getRouteColor(seg.route_name ?? "");
            const fromName = seg.from.name === "Origin"      ? fromLoc.name : seg.from.name;
            const toName   = seg.to.name   === "Destination" ? toLoc.name   : seg.to.name;

            newTransitLegs.push({ id: `transit-${i}`, coords, color });
            newNodeMarkers.push(
              { id: `node-from-${i}`, coord: { latitude: seg.from.lat, longitude: seg.from.lng }, name: fromName, color },
              { id: `node-to-${i}`,   coord: { latitude: seg.to.lat,   longitude: seg.to.lng   }, name: toName,   color },
            );
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
    setTappedCoord(null);
  }, [stopNavigation, clearJourney]);

  const handleSelectStop = useCallback((s: Stop) => {
    stopNavigation();
    setFollowMe(false);
    setSelected(s);
    setStopDetailsOpen(false);
    setNearestOpen(false);
    setStepsOpen(false);
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
      setTimeout(() => startNavigation(), 300);
    }
  }, [activeJourney, startNavigation]);

  const handleToggleNav = useCallback((nextState: boolean) => {
    if (nextState) { startNavigation(); setFollowMe(true); }
    else           { stopNavigation();  setFollowMe(false); }
  }, [startNavigation, stopNavigation]);

  // ── Region change → update zoom + center for StopsLayer ──────────────────────

  const onRegionChangeComplete = useCallback((region: any, details: any) => {
    if (details?.isGesture) setFollowMe(false);
    setViewZoom(zoomFromDelta(region.latitudeDelta));
    setViewCenter({ lat: region.latitude, lng: region.longitude });
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
        {/* Walking route legs — dashed grey, below transit */}
        {walkLegs.map((leg) => (
          <Polyline
            key={leg.id}
            coordinates={leg.coords}
            strokeColor="#8E8E93"
            strokeWidth={3}
            lineDashPattern={[6, 5]}
            zIndex={1}
          />
        ))}

        {/* Transit route legs — road-snapped, solid, route-coloured */}
        {transitLegs.map((leg) => (
          <Polyline
            key={leg.id}
            coordinates={leg.coords}
            strokeColor={leg.color}
            strokeWidth={5}
            zIndex={2}
            geodesic
          />
        ))}

        {/* Board/alight node markers — route-coloured circle with matatu icon */}
        {nodeMarkers.map((m) => (
          <Marker
            key={m.id}
            coordinate={m.coord}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <StopNodeMarker color={m.color} />
          </Marker>
        ))}

        {/* Origin / destination — branded rounded square (Uber-style) */}
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

      <MapFloatingUI
        onRecenter={() => {
          setFollowMe(true);
          if (me) camera.animateTo({ center: { latitude: me.latitude, longitude: me.longitude }, zoom: 16, duration: 450 });
        }}
        onOpenSearch={() => {
          if (chipJustPressedRef.current) { chipJustPressedRef.current = false; return; }
          router.push("/search");
        }}
        onOpenKwame={() => { chipJustPressedRef.current = true; setNearestOpen(false); router.push("/kwame"); }}
        navigating={navigating}
        onToggleNav={() => handleToggleNav(!navigating)}
        nextPreview={nextPreview}
        nextStep={nextStep}
        showNavSub={prefs.navHints === "detailed"}
        eta={navState?.eta ?? null}
        remainingDistanceM={navState?.remainingDistanceM ?? null}
        arrivalSoonShown={navState?.status === "arrived"}
        activeJourney={activeJourney}
        onClearJourney={handleClearJourney}
        bottomOffset={
          selected && !activeJourney && stopDetailsOpen ? 280
          : selected && !activeJourney ? 180
          : 0
        }
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

      {activeJourney && (
        <JourneyDetailsSheet activeJourney={activeJourney} routeLoading={routeLoading} routeInfo={routeInfo} navigating={navigating} onToggleNav={handleToggleNav} onClose={handleClearJourney} mToNice={mToNice} sToMin={sToMin} isSaved={isSaved} onSave={handleSaveJourney} onUnsave={handleUnsaveJourney}>
          <RouteStepsList steps={steps} stepsOpen={stepsOpen} setStepsOpen={setStepsOpen} nextPreview={nextPreview} nextStepIdx={navState?.stepIndex ?? 0} navigating={navigating} selectedName={activeJourney.toLoc.name} />
        </JourneyDetailsSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  locatingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
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
});
