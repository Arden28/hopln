import type { IntermediateStop, LocMarker, NodeMarker, TransitLeg, WalkLeg } from "@/components/map/types";
import { DestinationPin, IntermediateStopDot, SquarePin, TrackedNodeMarker } from "@/components/map/RouteMarkers";
import { Marker, Polyline } from "react-native-maps";

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Returns only the coordinates of `coords` that lie AHEAD of the user position.
// Projects the user onto the nearest segment, then discards everything behind.
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
  // Walking leg consumption: -1 = not walking, ≥0 = index of the active walk leg
  currentWalkLegIdx?: number;
  userLat?:           number;
  userLng?:           number;
}

export function RouteOverlay({
  walkLegs, transitLegs, nodeMarkers, locMarkers, intermediateStops, onIntermStopPress,
  boardingNodeId, currentStepIndex, currentWalkLegIdx = -1, userLat, userLng,
}: RouteOverlayProps) {
  return (
    <>
      {/* Walking route legs — dashed grey, below transit.
          During navigation:
            i < currentWalkLegIdx → already walked, shown faded (20 % opacity).
            i === currentWalkLegIdx → active leg, trimmed from user position.
            i > currentWalkLegIdx → upcoming, shown at full opacity. */}
      {walkLegs.map((leg, i) => {
        const isActive  = currentWalkLegIdx >= 0 && i === currentWalkLegIdx;
        const isPast    = currentWalkLegIdx >= 0 && i  < currentWalkLegIdx;
        const color     = isPast ? hexWithAlpha("#8E8E93", 0.20) : "#8E8E93";
        const coords    = isActive && userLat != null && userLng != null
          ? trimPolylineAhead(leg.coords, userLat, userLng)
          : leg.coords;

        if (coords.length < 2) return null;

        return (
          <Polyline
            key={leg.id}
            coordinates={coords}
            strokeColor={color}
            strokeWidth={3}
            lineDashPattern={isPast ? undefined : [6, 5]}
            zIndex={1}
          />
        );
      })}

      {/* Transit route legs — solid, route-coloured.
          Traveled legs (index < currentStepIndex) are re-rendered at 28% opacity
          to show progress. strokeColors forces correct color on PROVIDER_GOOGLE Android. */}
      {transitLegs.map((leg, i) => {
        const traveled = currentStepIndex != null && i < currentStepIndex;
        const color = traveled ? hexWithAlpha(leg.color, 0.28) : leg.color;
        return (
          <Polyline
            key={`${leg.id}-${leg.color}`}
            coordinates={leg.coords}
            strokeColor={color}
            strokeColors={[color, color]}
            strokeWidth={5}
            zIndex={traveled ? 1 : 2}
            geodesic
          />
        );
      })}

      {/* Intermediate stops — small route-coloured dots between board and alight */}
      {intermediateStops.map((s) => (
        <Marker
          key={s.id}
          coordinate={s.coord}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={3}
          onPress={() => onIntermStopPress(s)}
        >
          <IntermediateStopDot color={s.color} />
        </Marker>
      ))}

      {/* Board/alight node markers — route-coloured circle with matatu icon */}
      {nodeMarkers.map((m) => (
        <TrackedNodeMarker key={m.id} m={m} isBoardingStop={m.id === boardingNodeId} />
      ))}

      {/* Origin / destination — branded rounded square */}
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

    </>
  );
}
