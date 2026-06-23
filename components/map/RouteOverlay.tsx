import React from "react";
import Mapbox from "@rnmapbox/maps";
import type { IntermediateStop, LocMarker, NodeMarker, TransitLeg, WalkLeg } from "@/components/map/types";
import { DestinationPin, IntermediateStopDot, SquarePin, TrackedNodeMarker } from "@/components/map/RouteMarkers";

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Returns only the coordinates of `coords` that lie AHEAD of the user position.
function trimPolylineAhead(
  coords: { latitude: number; longitude: number }[],
  userLat: number,
  userLng: number,
): { latitude: number; longitude: number }[] {
  if (coords.length < 2) return coords;

  let bestIdx  = 0;
  let bestFrac = 0;
  let minDist  = Infinity;

  for (let i = 0; i < coords.length - 1; i++) {
    const aLat = coords[i].latitude,     aLng = coords[i].longitude;
    const bLat = coords[i + 1].latitude, bLng = coords[i + 1].longitude;
    const dx = bLat - aLat, dy = bLng - aLng;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) continue;
    const t = Math.max(0, Math.min(1, ((userLat - aLat) * dx + (userLng - aLng) * dy) / lenSq));
    const d = Math.hypot(userLat - aLat - t * dx, userLng - aLng - t * dy);
    if (d < minDist) { minDist = d; bestIdx = i; bestFrac = t; }
  }

  const projLat = coords[bestIdx].latitude  + bestFrac * (coords[bestIdx + 1].latitude  - coords[bestIdx].latitude);
  const projLng = coords[bestIdx].longitude + bestFrac * (coords[bestIdx + 1].longitude - coords[bestIdx].longitude);

  return [{ latitude: projLat, longitude: projLng }, ...coords.slice(bestIdx + 1)];
}

interface RouteOverlayProps {
  walkLegs:           WalkLeg[];
  transitLegs:        TransitLeg[];
  nodeMarkers:        NodeMarker[];
  locMarkers:         LocMarker[];
  intermediateStops:  IntermediateStop[];
  onIntermStopPress:  (stop: IntermediateStop) => void;
  boardingNodeId?:    string | null;
  currentStepIndex?:  number;
  currentWalkLegIdx?: number;
  userLat?:           number;
  userLng?:           number;
  viewZoom?:          number;
}

function _RouteOverlay({
  walkLegs, transitLegs, nodeMarkers, locMarkers, intermediateStops, onIntermStopPress,
  boardingNodeId, currentStepIndex, currentWalkLegIdx = -1, userLat, userLng, viewZoom,
}: RouteOverlayProps) {
  return (
    <>
      {/* Walking route legs — dashed grey */}
      {walkLegs.map((leg, i) => {
        const isActive = currentWalkLegIdx >= 0 && i === currentWalkLegIdx;
        const isPast   = currentWalkLegIdx >= 0 && i  < currentWalkLegIdx;
        const color    = isPast ? hexWithAlpha("#8E8E93", 0.20) : "#8E8E93";
        const rawCoords = isActive && userLat != null && userLng != null
          ? trimPolylineAhead(leg.coords, userLat, userLng)
          : leg.coords;

        if (rawCoords.length < 2) return null;

        const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: rawCoords.map((c) => [c.longitude, c.latitude]),
          },
          properties: {},
        };

        return (
          <Mapbox.ShapeSource key={leg.id} id={`walk-src-${leg.id}`} shape={geojson}>
            <Mapbox.LineLayer
              id={`walk-line-${leg.id}`}
              style={{
                lineColor:   color,
                lineWidth:   3,
                lineDasharray: isPast ? undefined : [6, 5],
                lineCap:     "round",
                lineJoin:    "round",
              }}
            />
          </Mapbox.ShapeSource>
        );
      })}

      {/* Transit route legs — solid, route-coloured */}
      {transitLegs.map((leg, i) => {
        const traveled = currentStepIndex != null && i < currentStepIndex;
        const color = traveled ? hexWithAlpha(leg.color, 0.28) : leg.color;

        const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: leg.coords.map((c) => [c.longitude, c.latitude]),
          },
          properties: {},
        };

        return (
          <Mapbox.ShapeSource key={`${leg.id}-${leg.color}`} id={`transit-src-${leg.id}`} shape={geojson}>
            <Mapbox.LineLayer
              id={`transit-line-${leg.id}`}
              style={{
                lineColor:  color,
                lineWidth:  traveled ? 4 : 8,
                lineCap:    "round",
                lineJoin:   "round",
              }}
            />
          </Mapbox.ShapeSource>
        );
      })}

      {/* Intermediate stop dots — hidden below zoom 14 */}
      {(viewZoom == null || viewZoom >= 14) && intermediateStops.map((s) => (
        <Mapbox.PointAnnotation
          key={s.id}
          id={s.id}
          coordinate={[s.coord.longitude, s.coord.latitude]}
          anchor={{ x: 0.5, y: 0.5 }}
          onSelected={() => onIntermStopPress(s)}
        >
          <IntermediateStopDot color={s.color} />
        </Mapbox.PointAnnotation>
      ))}

      {/* Board/alight node markers */}
      {nodeMarkers.map((m) => (
        <TrackedNodeMarker key={m.id} m={m} isBoardingStop={m.id === boardingNodeId} />
      ))}

      {/* Origin / destination pins */}
      {locMarkers.map((m) => (
        <Mapbox.PointAnnotation
          key={m.id}
          id={m.id}
          coordinate={[m.coord.longitude, m.coord.latitude]}
          anchor={m.isStart ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1.0 }}
        >
          {m.isStart ? <SquarePin isStart /> : <DestinationPin name={m.name} />}
        </Mapbox.PointAnnotation>
      ))}
    </>
  );
}

export const RouteOverlay = React.memo(_RouteOverlay, (prev, next) =>
  prev.walkLegs          === next.walkLegs          &&
  prev.transitLegs       === next.transitLegs       &&
  prev.nodeMarkers       === next.nodeMarkers       &&
  prev.locMarkers        === next.locMarkers        &&
  prev.intermediateStops === next.intermediateStops &&
  prev.boardingNodeId    === next.boardingNodeId    &&
  prev.currentStepIndex  === next.currentStepIndex  &&
  prev.currentWalkLegIdx === next.currentWalkLegIdx &&
  prev.userLat           === next.userLat           &&
  prev.userLng           === next.userLng           &&
  prev.viewZoom          === next.viewZoom
);
