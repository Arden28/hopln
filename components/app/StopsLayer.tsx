import React, { useCallback, useMemo } from "react";
import { ShapeSource, CircleLayer, SymbolLayer, Images } from "@rnmapbox/maps";

type Stop = { id: string; name: string; lat: number; lng: number; route_nams?: string | null };

const ORANGE = "#FF6F00";
const STOPS_MIN_ZOOM = 13;

type Props = {
  allStops:   Stop[];
  viewCenter: { lat: number; lng: number } | null;
  viewZoom:   number;
  selected?:  Stop | null;
  onPress:    (stop: Stop) => void;
};

function StopsLayer({ allStops, viewZoom, selected, onPress }: Props) {
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
    if (feature.properties?.cluster === true) return;
    const stop = allStops.find((s) => s.id === feature.properties?.id);
    if (stop) onPress(stop);
  }, [allStops, onPress]);

  if (viewZoom < STOPS_MIN_ZOOM) return null;

  const unselectedFilter = selectedId
    ? ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], selectedId]] as any
    : ["!", ["has", "point_count"]] as any;

  // Cast to ComponentType<any>: the IDE resolves @rnmapbox/maps to the web .d.ts where
  // these are undefined, causing strict children constraint errors. Metro resolves correctly.
  const NativeShapeSource = ShapeSource as unknown as React.ComponentType<any>;
  const NativeCircleLayer = CircleLayer as unknown as React.ComponentType<any>;
  const NativeSymbolLayer = SymbolLayer as unknown as React.ComponentType<any>;
  const NativeImages      = Images      as unknown as React.ComponentType<any>;

  return (
    <>
      <NativeImages images={{ matatu: require("@/assets/images/matatu.png") }} />
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
        <NativeSymbolLayer
          id="individual-stops"
          filter={unselectedFilter}
          minZoomLevel={STOPS_MIN_ZOOM}
          style={{
            iconImage:           "matatu",
            iconSize:            ["interpolate", ["linear"], ["zoom"], 13, 0.04, 17, 0.06],
            iconAllowOverlap:    false,
            iconIgnorePlacement: false,
          }}
        />
        {selectedId && (
          <NativeCircleLayer
            id="selected-stop-bg"
            filter={["==", ["get", "id"], selectedId] as any}
            minZoomLevel={STOPS_MIN_ZOOM}
            style={{
              circleColor:       ORANGE,
              circleRadius:      ["interpolate", ["linear"], ["zoom"], 13, 12, 17, 18],
              circleStrokeWidth: 2,
              circleStrokeColor: "#FFFFFF",
            }}
          />
        )}
        {selectedId && (
          <NativeSymbolLayer
            id="selected-stop"
            filter={["==", ["get", "id"], selectedId] as any}
            minZoomLevel={STOPS_MIN_ZOOM}
            style={{
              iconImage:        "matatu",
              iconSize:         ["interpolate", ["linear"], ["zoom"], 13, 0.06, 17, 0.09],
              iconAllowOverlap: true,
            }}
          />
        )}
      </NativeShapeSource>
    </>
  );
}

export default React.memo(StopsLayer, (prev, next) =>
  prev.allStops     === next.allStops    &&
  prev.viewZoom     === next.viewZoom    &&
  prev.selected?.id === next.selected?.id &&
  prev.onPress      === next.onPress
);
