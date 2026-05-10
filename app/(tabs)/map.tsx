// app/(tabs)/map.tsx
import JourneyDetailsSheet from "@/components/app/JourneyDetailsSheet";
import MapFloatingUI from "@/components/app/MapFloatingUI";
import NearestStopsSheet from "@/components/app/NearestStopsSheet";
import RouteStepsList from "@/components/app/RouteStepsList";
import StopDetailsSheet from "@/components/app/StopDetailsSheet";
import StopsLayer from "@/components/app/StopsLayer";
import polyline from "@mapbox/polyline";

import { useNavigation } from "@/hooks/useNavigation";
import { MapService } from "@/services/map";
import { StopService } from "@/services/stop";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
import { RouteInfo, Step, Stop, bboxFromCoords, getRouteColor, humanizeStep, mToNice, sToMin } from "@/utils/mapHelpers";

import MapboxGL from "@rnmapbox/maps";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import type { FeatureCollection, LineString, Point } from "geojson";
import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import KwameSheet from "@/components/app/KwameSheet";

const ORANGE = "#FF6F00";
const GREEN  = "#34C759";
const RED    = "#FF3B30";
const BLACK  = "#000000";
const BG     = "#F6F7F8";

const extra = (Constants?.expoConfig?.extra ?? {}) as Record<string, unknown>;
MapboxGL.setAccessToken((process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string) || (extra.mapboxToken as string));
const STYLE = MapboxGL.StyleURL.Street;

export default function MapScreen() {
  const router = useRouter();

  // Engine Hook
  const { location: me, navState, startNavigation, stopNavigation } = useNavigation();
  
  const activeJourney = useJourneyStore((state) => state.activeJourney);
  const setJourney    = useJourneyStore((state) => state.setJourney); // Need this for AI flow
  const tripStatus    = useJourneyStore((state) => state.tripStatus);
  const clearJourney  = useJourneyStore((state) => state.clearJourney);
  const navigating    = tripStatus === "IN_TRANSIT";

  const [followMe, setFollowMe] = useState(true);
  const [selected, setSelected] = useState<Stop | null>(null);

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepsOpen, setStepsOpen] = useState(false);

  const [nearestOpen, setNearestOpen] = useState(false);
  const [nearestStops, setNearestStops] = useState<UnifiedLocation[]>([]);

  const [kwameOpen, setKwameOpen] = useState(false);

  const [walkToOriginFC, setWalkToOriginFC] = useState<FeatureCollection<LineString> | null>(null);
  const [transitActiveFC, setTransitActiveFC] = useState<FeatureCollection<LineString> | null>(null);
  const [journeyNodesFC, setJourneyNodesFC] = useState<FeatureCollection<Point> | null>(null);
  const [locationNodesFC, setLocationNodesFC] = useState<FeatureCollection<Point> | null>(null);

  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewZoom, setViewZoom] = useState<number>(13);

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const lastCamUpdate = useRef<number>(0);

  const visibleMapStops = useMemo<Stop[]>(() => {
    const combined: UnifiedLocation[] = [...nearestStops];
    if (activeJourney) {
      if (activeJourney.fromLoc._type === "stop") combined.push(activeJourney.fromLoc);
      if (activeJourney.toLoc._type === "stop") combined.push(activeJourney.toLoc);
    }
    return Array.from(new Map(combined.map((s) => [s.id, s])).values()) as unknown as Stop[];
  }, [nearestStops, activeJourney]);

  useEffect(() => {
    if (me && nearestOpen) {
      StopService.getNearbyStops(me.latitude, me.longitude, 2000, 5)
        .then(setNearestStops)
        .catch((e) => console.warn(e));
    }
  }, [me?.latitude, me?.longitude, nearestOpen]);

  useEffect(() => {
    if (!activeJourney) {
      setWalkToOriginFC(null);
      setTransitActiveFC(null);
      setJourneyNodesFC(null);
      setLocationNodesFC(null);
      return;
    }

    setSelected(null);
    setFollowMe(false);
    // setRouteLoading(true);
    // Kwame or normal search can trigger this. Kwame flow handles setting state. normal flow too.
    if (!activeJourney.is_ai_derived) { 
        setRouteLoading(true);
    }

    const fetchJourneyShapes = async () => {
      try {
        const { route, fromLoc, toLoc } = activeJourney;
        const segments = route.segments;
        if (!segments || segments.length === 0) return;

        const summarySteps: Step[] = [];
        const walkFeatures: any[] = [];
        const transitFeaturesActive: any[] = [];
        const transferNodes: any[] = [];
        const locNodes: any[] = [];

        if (fromLoc._type === "location" && fromLoc.id !== "current_location") {
          locNodes.push({ type: "Feature", geometry: { type: "Point", coordinates: [fromLoc.lng, fromLoc.lat] }, properties: { name: fromLoc.name, type: "start" } });
        }
        if (toLoc._type === "location" && toLoc.id !== "current_location") {
          locNodes.push({ type: "Feature", geometry: { type: "Point", coordinates: [toLoc.lng, toLoc.lat] }, properties: { name: toLoc.name, type: "end" } });
        }

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const decodedCoords = polyline.decode(seg.polyline).map((c) => [c[1], c[0]] as [number, number]);

          if (seg.mode === "WALK") {
            walkFeatures.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: decodedCoords } });
            summarySteps.push({ instruction: `Walk to ${seg.to.name === "Destination" ? toLoc.name : seg.to.name}`, distance: seg.distance, duration: seg.duration, location: [seg.to.lng, seg.to.lat], type: "walk" });
          } else {
            const routeColor = getRouteColor(seg.route_name ?? "");
            const snappedActive = await MapService.snapToRoads(decodedCoords);
            const effectiveCoords = snappedActive.length > 0 ? snappedActive : decodedCoords;

            transitFeaturesActive.push({ type: "Feature", properties: { segmentIndex: i, routeColor }, geometry: { type: "LineString", coordinates: effectiveCoords } });
            
            const fromName = seg.from.name === "Origin" ? fromLoc.name : seg.from.name;
            const toName = seg.to.name === "Destination" ? toLoc.name : seg.to.name;

            transferNodes.push(
              { type: "Feature", geometry: { type: "Point", coordinates: [seg.from.lng, seg.from.lat] }, properties: { name: fromName, color: routeColor } },
              { type: "Feature", geometry: { type: "Point", coordinates: [seg.to.lng, seg.to.lat] }, properties: { name: toName, color: routeColor } }
            );

            summarySteps.push(
              { instruction: `Board Line ${seg.route_name} at ${fromName}`, distance: 0, duration: 0, location: [seg.from.lng, seg.from.lat], type: "depart" },
              { instruction: `Alight at ${toName}`, distance: seg.distance, duration: seg.duration, location: [seg.to.lng, seg.to.lat], type: "arrive" }
            );
          }
        }

        setWalkToOriginFC(walkFeatures.length > 0 ? { type: "FeatureCollection", features: walkFeatures } : null);
        setTransitActiveFC(transitFeaturesActive.length > 0 ? { type: "FeatureCollection", features: transitFeaturesActive } : null);
        setJourneyNodesFC(transferNodes.length > 0 ? ({ type: "FeatureCollection", features: transferNodes } as FeatureCollection<Point>) : null);
        setLocationNodesFC(locNodes.length > 0 ? ({ type: "FeatureCollection", features: locNodes } as FeatureCollection<Point>) : null);

        setSteps(summarySteps);
        setRouteInfo({ distance: route.total_distance, duration: route.total_duration });

        // Initial Concern Zone Framing
        if (segments.length > 0) {
          let firstLegCoords = polyline.decode(segments[0].polyline).map(c => [c[1], c[0]] as [number, number]);
          firstLegCoords = firstLegCoords.filter(c => c[0] !== 0 && c[1] !== 0 && !isNaN(c[0]));

          if (firstLegCoords.length > 1) {
            const [minLng, minLat, maxLng, maxLat] = bboxFromCoords(firstLegCoords);
            cameraRef.current?.fitBounds([maxLng, maxLat], [minLng, minLat], [140, 40, 320, 40], 800);
          }
        }
      } catch (err) {
        console.warn("Failed to decode OTP geometry", err);
      } finally {
        setRouteLoading(false);
      }
    };

    fetchJourneyShapes();
  }, [activeJourney]);

  // Dynamic Camera Engine
  useEffect(() => {
    if (!me || !followMe || !navigating || !navState) return;
    
    const now = Date.now();
    if (now - lastCamUpdate.current < 320) return;
    lastCamUpdate.current = now;

    cameraRef.current?.setCamera({
      centerCoordinate: [me.longitude, me.latitude],
      zoomLevel: 18.0 + (Math.min(me.speed ?? 0, 2.0) / 2.0) * 0.15,
      heading: navState.routeBearing,
      pitch: 45,
      animationDuration: 300,
    });
  }, [me, followMe, navigating, navState]);

  const handleClearJourney = useCallback(() => {
    stopNavigation();
    clearJourney();
    setSteps([]);
    setFollowMe(true);
  }, [stopNavigation, clearJourney]);

  const handleSelectStop = useCallback((s: Stop) => {
    stopNavigation();
    setFollowMe(false);
    setSelected(s);
    setNearestOpen(false);
    setStepsOpen(false);
    cameraRef.current?.setCamera({ centerCoordinate: [s.lng, s.lat], zoomLevel: 17.2, animationDuration: 500 });
  }, [stopNavigation]);

  
  // NEW HANDLER FOR AI FLOW
  const handleAiDeriveJourney = useCallback((aiRouteResponse: any) => {
    if (!me) return;
    
    setSteps([]); // Clear visual hierarchy before drawing new one
    setRouteLoading(true);

    // AI assumes "Current Location" as Origin usually.
    const fromLoc: UnifiedLocation = {
        id: 'current_location',
        name: 'Current Location',
        _type: 'location',
        lat: me.latitude,
        lng: me.longitude
    };

    // Extract basic to Location from AI response summary
    const toLoc: UnifiedLocation = {
        id: aiRouteResponse.summary, // simplified ID usage
        name: aiRouteResponse.summary.replace('Via ', ''),
        _type: 'location',
        lat: aiRouteResponse.segments[aiRouteResponse.segments.length - 1].to.lat,
        lng: aiRouteResponse.segments[aiRouteResponse.segments.length - 1].to.lng,
    };

    // Set the state. Note: I added a flag 'is_ai_derived' just to manage loading spinners.
    setJourney(fromLoc, toLoc, {...aiRouteResponse, is_ai_derived: true});
    
    // Auto start navigation since the user asked AI to plan it
    setTimeout(() => startNavigation(), 300);

  }, [me, setJourney, startNavigation]);

  const handleToggleNav = useCallback((nextState: boolean) => {
    if (nextState) {
      startNavigation();
      setFollowMe(true);
    } else {
      stopNavigation();
      setFollowMe(false);
    }
  }, [startNavigation, stopNavigation]);

  const onCameraChanged = useCallback((e: any) => {
    const isGesture = e?.properties?.isUserInteraction || e?.properties?.isGesture;
    if (isGesture) setFollowMe(false);

    const z = e?.properties?.zoom;
    const center = e?.properties?.center;
    if (!z || !center) return;
    setViewZoom(z);
    setViewCenter({ lat: center[1], lng: center[0] });
  }, []);

  const nextStepIdx = navState?.stepIndex ?? 0;
  const nextStep = steps[nextStepIdx];
  const nextPreview = nextStep ? humanizeStep(nextStep) : null;

  if (!me) return <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={STYLE}
        onCameraChanged={onCameraChanged}
        compassViewPosition={1}
        compassViewMargins={{ x: 20, y: 100 }}
        logoEnabled={true}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [36.817223, -1.286389], zoomLevel: 13 }}
          followUserLocation={followMe && !navigating} // Native Mapbox follow for exploring
          followUserMode={MapboxGL.UserTrackingModes.Follow}
        />
        <MapboxGL.Images images={{ "matatu-pin": require("@/assets/images/matatu.png") }} />
        <MapboxGL.UserLocation showsUserHeadingIndicator />

        {walkToOriginFC && (
          <MapboxGL.ShapeSource id="walk-leg-source" shape={walkToOriginFC}>
            <MapboxGL.LineLayer id="walk-leg-line" style={{ lineColor: "#9CA3AF", lineWidth: 3.5, lineDasharray: [1, 2], lineCap: "round", lineJoin: "round" }} />
          </MapboxGL.ShapeSource>
        )}

        {transitActiveFC && (
          <MapboxGL.ShapeSource id="transit-active-source" shape={transitActiveFC}>
            <MapboxGL.LineLayer id="transit-active-line" style={{ lineColor: ["get", "routeColor"], lineWidth: 6, lineOpacity: 1.0, lineCap: "round", lineJoin: "round" }} />
          </MapboxGL.ShapeSource>
        )}

        {journeyNodesFC && (
          <MapboxGL.ShapeSource id="journey-nodes-source" shape={journeyNodesFC}>
            <MapboxGL.CircleLayer id="journey-nodes-circle" style={{ circleColor: "#FFFFFF", circleRadius: 6, circleStrokeWidth: 2, circleStrokeColor: ["get", "color"] }} />
            <MapboxGL.SymbolLayer id="journey-nodes-text" style={{ textField: "{name}", textSize: 11.5, textColor: "#333333", textHaloColor: "#FFFFFF", textHaloWidth: 2, textAnchor: "left", textOffset: [1, 0] }} />
          </MapboxGL.ShapeSource>
        )}

        {locationNodesFC && (
          <MapboxGL.ShapeSource id="location-nodes-source" shape={locationNodesFC}>
            <MapboxGL.CircleLayer id="location-nodes-circle" style={{ circleColor: ["case", ["==", ["get", "type"], "start"], GREEN, RED], circleRadius: 7, circleStrokeWidth: 2, circleStrokeColor: "#FFFFFF" }} />
            <MapboxGL.SymbolLayer id="location-nodes-text" style={{ textField: "{name}", textSize: 12, textColor: "#333333", textHaloColor: "#FFFFFF", textHaloWidth: 2, textAnchor: "top", textOffset: [0, 0.8] }} />
          </MapboxGL.ShapeSource>
        )}

        <StopsLayer allStops={visibleMapStops} viewCenter={viewCenter} viewZoom={viewZoom} selected={selected} onPress={(e: any) => { const f = visibleMapStops.find(s => s.id === e?.features?.[0]?.properties?.id); if(f) handleSelectStop(f); }} />
      </MapboxGL.MapView>

      <MapFloatingUI
        onRecenter={() => { setFollowMe(true); cameraRef.current?.setCamera({ centerCoordinate: [me.longitude, me.latitude], zoomLevel: 16, animationDuration: 450 })}}
        onOpenSearch={() => router.push("/search")}
        onOpenKwame={() => { setNearestOpen(false); setKwameOpen(true); }}
        navigating={navigating}
        onToggleNav={() => handleToggleNav(!navigating)}
        nextPreview={nextPreview}
        nextStep={nextStep}
        eta={navState?.eta ?? null}
        remainingDistanceM={navState?.remainingDistanceM ?? null}
        arrivalSoonShown={navState?.status === 'arrived'}
        hasSelectedStop={!!selected}
        onToggleNearest={() => { setKwameOpen(false); setNearestOpen((v) => !v); }}
        nearestCount={nearestStops.length}
        hasLocation={!!me}
        activeJourney={activeJourney}
        onClearJourney={handleClearJourney}
      />

      {/* Sheets... */}
      
      <KwameSheet 
        open={kwameOpen} 
        onClose={() => setKwameOpen(false)} 
        me={me}
        onStartJourney={handleAiDeriveJourney} // Connects the AI Orchestration
      />

      {!selected && !activeJourney && (
        <NearestStopsSheet nearestOpen={nearestOpen} setNearestOpen={setNearestOpen} nearest={nearestStops} me={me} onSelect={handleSelectStop} />
      )}

      {selected && !activeJourney && (
        <StopDetailsSheet selected={selected} routeLoading={routeLoading} routeInfo={routeInfo} navigating={navigating} onToggleNav={handleToggleNav} onClose={() => { setSelected(null); setFollowMe(true); }} mToNice={mToNice} sToMin={sToMin} >
          <RouteStepsList steps={steps} stepsOpen={stepsOpen} setStepsOpen={setStepsOpen} nextPreview={nextPreview} nextStepIdx={nextStepIdx} navigating={navigating} selectedName={selected.name} />
        </StopDetailsSheet>
      )}

      {activeJourney && (
        <JourneyDetailsSheet activeJourney={activeJourney} routeLoading={routeLoading} routeInfo={routeInfo} navigating={navigating} onToggleNav={handleToggleNav} onClose={handleClearJourney} mToNice={mToNice} sToMin={sToMin} >
          <RouteStepsList steps={steps} stepsOpen={stepsOpen} setStepsOpen={setStepsOpen} nextPreview={nextPreview} nextStepIdx={nextStepIdx} navigating={navigating} selectedName={activeJourney.toLoc.name} />
        </JourneyDetailsSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
});