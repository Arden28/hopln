import type { IntermediateStop, LocMarker, NodeMarker, TransitLeg, WalkLeg } from "@/components/map/types";
import { projectOntoPolyline, sanitizeHex } from "@/components/map/types";
import type { UnifiedLocation } from "@/store/journeyStore";
import type { Route } from "@/services/route";
import type { RouteInfo, Step } from "@/utils/mapHelpers";
import { detectManeuver } from "@/utils/mapHelpers";
import type { LatLng } from "@/providers/map/types";
import { useEffect, useState } from "react";

type ActiveJourney = {
  fromLoc: UnifiedLocation;
  toLoc:   UnifiedLocation;
  route:   Route;
} | null;

// Minimal camera interface — avoids importing useMapCamera and creating circular deps.
interface Camera {
  fitCoordinates: (coords: LatLng[], padding?: { top?: number; right?: number; bottom?: number; left?: number }) => void;
}

interface RouteOverlayResult {
  walkLegs:          WalkLeg[];
  transitLegs:       TransitLeg[];
  nodeMarkers:       NodeMarker[];
  locMarkers:        LocMarker[];
  intermediateStops: IntermediateStop[];
  steps:             Step[];
  routeInfo:         RouteInfo | null;
  routeLoading:      boolean;
}

export function useRouteOverlay(
  activeJourney: ActiveJourney,
  camera: Camera,
): RouteOverlayResult {
  const [walkLegs,          setWalkLegs]          = useState<WalkLeg[]>([]);
  const [transitLegs,       setTransitLegs]       = useState<TransitLeg[]>([]);
  const [nodeMarkers,       setNodeMarkers]       = useState<NodeMarker[]>([]);
  const [locMarkers,        setLocMarkers]        = useState<LocMarker[]>([]);
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStop[]>([]);
  const [steps,             setSteps]             = useState<Step[]>([]);
  const [routeInfo,         setRouteInfo]         = useState<RouteInfo | null>(null);
  const [routeLoading,      setRouteLoading]      = useState(false);

  useEffect(() => {
    if (!activeJourney) {
      setWalkLegs([]);
      setTransitLegs([]);
      setNodeMarkers([]);
      setLocMarkers([]);
      setIntermediateStops([]);
      setSteps([]);
      setRouteInfo(null);
      setRouteLoading(false);
      return;
    }

    // Route hasn't loaded yet (deep-link scenario — useNavigation fetches it async).
    // Bug fix: return a cleanup so routeLoading clears if the journey is cancelled.
    if (!activeJourney.route) {
      setRouteLoading(true);
      return () => setRouteLoading(false);
    }

    if (!activeJourney.route.is_ai_derived) setRouteLoading(true);

    const build = async () => {
      try {
        const { route, fromLoc, toLoc } = activeJourney;
        const segments = route?.segments;
        if (!segments?.length) return;

        const summarySteps: Step[]               = [];
        const newWalkLegs: WalkLeg[]             = [];
        const newTransitLegs: TransitLeg[]       = [];
        const newNodeMarkers: NodeMarker[]       = [];
        const newLocMarkers: LocMarker[]         = [];
        const newIntermStops: IntermediateStop[] = [];

        if (fromLoc._type !== "stop" && fromLoc.id !== "current_location") {
          newLocMarkers.push({ id: "loc-from", coord: { latitude: fromLoc.lat, longitude: fromLoc.lng }, name: fromLoc.name, isStart: true });
        }
        if (toLoc._type !== "stop" && toLoc.id !== "current_location") {
          newLocMarkers.push({ id: "loc-to", coord: { latitude: toLoc.lat, longitude: toLoc.lng }, name: toLoc.name, isStart: false });
        }

        let allCoords: LatLng[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];

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

            if (__DEV__) {
              console.log(`[RouteOverlay] seg ${i}: route_color="${seg.route_color}" → "${color}"`);
            }

            newTransitLegs.push({ id: `transit-${i}`, coords, color });
            newNodeMarkers.push(
              { id: `node-from-${i}`, coord: { latitude: seg.from.lat, longitude: seg.from.lng }, name: fromName, color },
              { id: `node-to-${i}`,   coord: { latitude: seg.to.lat,   longitude: seg.to.lng   }, name: toName,   color },
            );

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

  return { walkLegs, transitLegs, nodeMarkers, locMarkers, intermediateStops, steps, routeInfo, routeLoading };
}
