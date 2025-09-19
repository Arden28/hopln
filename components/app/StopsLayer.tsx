// components/StopsLayer.tsx
import MapboxGL from "@rnmapbox/maps";
import type { FeatureCollection, Point } from "geojson";
import React, { useMemo } from "react";

type Stop = { id: string; name: string; lat: number; lng: number };

const STOPS_MIN_ZOOM = 13.0;
const STOPS_LIMIT = 400; // safety cap (keep it smooth)

// Zoom → radius (meters)
function radiusForZoom(zoom: number) {
  if (zoom < 13) return 0;
  if (zoom < 14) return 1800;
  if (zoom < 15) return 1100;
  if (zoom < 16) return 700;
  if (zoom < 17) return 450;
  return 320;
}
function dMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function degBoxForRadiusMeters(lat: number, rMeters: number) {
  const dLat = rMeters / 111320;
  const dLon = rMeters / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { dLat, dLon };
}

type Props = {
  allStops: Stop[];
  viewCenter: { lat: number; lng: number } | null;
  viewZoom: number;
  selected?: Stop | null;
  onPress: (e: any) => void;
};

export default function StopsLayer({ allStops, viewCenter, viewZoom, selected, onPress }: Props) {
  // Progressive filter by zoom + radius (and cap)
  const filtered: Stop[] = useMemo(() => {
    if (!viewCenter || viewZoom < STOPS_MIN_ZOOM) return [];
    const r = radiusForZoom(viewZoom);
    if (r <= 0) return [];

    const { dLat, dLon } = degBoxForRadiusMeters(viewCenter.lat, r);
    const minLat = viewCenter.lat - dLat;
    const maxLat = viewCenter.lat + dLat;
    const minLng = viewCenter.lng - dLon;
    const maxLng = viewCenter.lng + dLon;

    const boxed = allStops.filter(
      (s) => s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng
    );

    const within = boxed
      .map((s) => ({
        s,
        d: dMeters({ latitude: viewCenter.lat, longitude: viewCenter.lng }, { latitude: s.lat, longitude: s.lng }),
      }))
      .filter((x) => x.d <= r)
      .sort((a, b) => a.d - b.d)
      .slice(0, STOPS_LIMIT)
      .map((x) => x.s);

    // Ensure selected stop is always included (radius exception)
    if (selected && !within.some((w) => w.id === selected.id)) {
      within.push(selected);
    }
    return within;
  }, [allStops, viewCenter?.lat, viewCenter?.lng, viewZoom, selected?.id]);

  // Build a stable key so we don't retile if the set hasn't actually changed
  const idsKey = useMemo(() => filtered.map((s) => s.id).sort().join("|"), [filtered]);

  const stopsFC: FeatureCollection<Point> = useMemo(
    () => ({
      type: "FeatureCollection",
      features: filtered.map((s) => ({
        type: "Feature",
        id: s.id,
        properties: { id: s.id, name: s.name },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    }),
    [idsKey] // depend on stable ids, not array identity
  );

  const selectedFC: FeatureCollection<Point> | null = useMemo(() => {
    if (!selected) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: `selected-${selected.id}`,
          properties: { id: selected.id, name: selected.name, selected: true },
          geometry: { type: "Point", coordinates: [selected.lng, selected.lat] },
        },
      ],
    };
  }, [selected?.id]);

  return (
    <>
      {/* Main stops (progressive + zoom-gated). Tolerance reduces per-tile memory churn. */}
      <MapboxGL.ShapeSource id="stops" shape={stopsFC} tolerance={1} onPress={onPress} hitbox={{ width: 44, height: 44 }}>
        <MapboxGL.SymbolLayer
          id="stops-symbol"
          minZoomLevel={STOPS_MIN_ZOOM}
          style={{
            iconImage: "matatu-pin",
            iconSize: 0.03,
            iconRotate: 0,
            iconRotationAlignment: "viewport",
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconAnchor: "center",
            iconOffset: [0, -4],
          }}
        />
      </MapboxGL.ShapeSource>

      {/* Selected stop always visible (no zoom/radius gating) */}
      {!!selectedFC && (
        <MapboxGL.ShapeSource id="stops-selected" shape={selectedFC}>
          <MapboxGL.SymbolLayer
            id="stops-selected-symbol"
            style={{
              iconImage: "matatu-pin",
              iconSize: 0.033,
              iconRotationAlignment: "viewport",
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconAnchor: "center",
              iconOffset: [0, -4],
            }}
          />
        </MapboxGL.ShapeSource>
      )}
    </>
  );
}
