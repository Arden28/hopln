import React, { useCallback, useMemo } from "react";
import { ShapeSource, CircleLayer, SymbolLayer } from "@rnmapbox/maps";

type Stop = { id: string; name: string; lat: number; lng: number; route_nams?: string | null };

const ORANGE = "#FF6F00";
const STOPS_MIN_ZOOM = 13;

// A filter expression that never matches any feature — used to "hide" a layer
// without conditionally rendering it (ShapeSource.children must be ReactElement[]).
const NEVER_MATCH = ["==", ["literal", false], ["literal", true]] as any;

type Props = {
  allStops:   Stop[];
  viewCenter: { lat: number; lng: number } | null;
  viewZoom:   number;
  selected?:  Stop | null;
  onPress:    (stop: Stop) => void;
};

function StopsLayer({ allStops, viewZoom, selected, onPress }: Props) {
  // Build GeoJSON FeatureCollection — Mapbox handles all clustering natively.
  const stopsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: allStops.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { id: s.id, name: s.name },
    })),
  }), [allStops]);

  const selectedId = selected?.id ?? null;

  const handleSourcePress = useCallback((e: any) => {
    const feature = e.features?.[0];
    if (!feature) return;
    // Cluster taps are ignored — same as current behavior.
    if (feature.properties?.cluster === true) return;
    const stop = allStops.find((s) => s.id === feature.properties?.id);
    if (stop) onPress(stop);
  }, [allStops, onPress]);

  // Hide all pins below minimum zoom — same threshold as the old JS implementation.
  if (viewZoom < STOPS_MIN_ZOOM) return null;

  const unselectedFilter = selectedId
    ? ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], selectedId]] as any
    : ["!", ["has", "point_count"]] as any;

  const selectedFilter = selectedId
    ? ["==", ["get", "id"], selectedId] as any
    : NEVER_MATCH;

  // Cast all three native layer types to ComponentType<any>:
  // The IDE resolves @rnmapbox/maps to the web .d.ts where these are `undefined`,
  // causing ShapeSource's strict ReactElement children constraint to fire.
  // Runtime resolution through Metro is correct — these are the native components.
  const NativeShapeSource = ShapeSource as unknown as React.ComponentType<any>;
  const NativeCircleLayer = CircleLayer as unknown as React.ComponentType<any>;
  const NativeSymbolLayer = SymbolLayer as unknown as React.ComponentType<any>;

  return (
    <NativeShapeSource
      id="stops"
      cluster
      clusterMaxZoom={14}
      clusterRadius={40}
      shape={stopsGeoJson}
      onPress={handleSourcePress}
    >
      <NativeCircleLayer
        id="cluster-circles"
        filter={["has", "point_count"]}
        style={{
          circleColor: [
            "step", ["get", "point_count"],
            ORANGE, 10, "#E65100", 50, "#B71C1C",
          ],
          circleRadius: [
            "step", ["get", "point_count"],
            15, 10, 20, 50, 25,
          ],
          circleOpacity:     0.9,
          circleStrokeWidth: 2,
          circleStrokeColor: "rgba(255,255,255,0.6)",
        }}
      />
      <NativeSymbolLayer
        id="cluster-counts"
        filter={["has", "point_count"]}
        style={{
          textField:  ["get", "point_count_abbreviated"],
          textSize:   12,
          textColor:  "#FFFFFF",
          textFont:   ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          textAnchor: "center",
        }}
      />
      <NativeCircleLayer
        id="individual-stops"
        filter={unselectedFilter}
        minZoomLevel={STOPS_MIN_ZOOM}
        style={{
          circleColor:       "#FF9F43",
          circleRadius:      ["interpolate", ["linear"], ["zoom"], 13, 5, 17, 9],
          circleStrokeWidth: 2,
          circleStrokeColor: "#FFFFFF",
        }}
      />
      <NativeCircleLayer
        id="selected-stop"
        filter={selectedFilter}
        minZoomLevel={STOPS_MIN_ZOOM}
        style={{
          circleColor:       ORANGE,
          circleRadius:      ["interpolate", ["linear"], ["zoom"], 13, 9, 17, 14],
          circleStrokeWidth: 2.5,
          circleStrokeColor: "#FFFFFF",
        }}
      />
    </NativeShapeSource>
  );
}

export default React.memo(StopsLayer, (prev, next) =>
  prev.allStops     === next.allStops    &&
  prev.viewZoom     === next.viewZoom    &&
  prev.selected?.id === next.selected?.id &&
  prev.onPress      === next.onPress
);
