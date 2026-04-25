import MapboxGL from "@rnmapbox/maps";
import type { FeatureCollection, Point } from "geojson";
import React, { useMemo } from "react";

type Stop = { id: string; name: string; lat: number; lng: number };

const STOPS_MIN_ZOOM = 13.0;
const STOPS_LIMIT = 400;

function radiusForZoom(zoom: number) {
  if (zoom < 13) return 0;
  if (zoom < 14) return 1800;
  if (zoom < 15) return 1100;
  if (zoom < 16) return 700;
  if (zoom < 17) return 450;
  return 320;
}

function dMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function degBoxForRadiusMeters(lat: number, rMeters: number) {
  const dLat = rMeters / 111320;
  const dLon =
    rMeters / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { dLat, dLon };
}

type Props = {
  allStops: Stop[];
  viewCenter: { lat: number; lng: number } | null;
  viewZoom: number;
  selected?: Stop | null;
  onPress: (e: any) => void;
};

export default function StopsLayer({
  allStops,
  viewCenter,
  viewZoom,
  selected,
  onPress,
}: Props) {
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
      (s) =>
        s.lat >= minLat &&
        s.lat <= maxLat &&
        s.lng >= minLng &&
        s.lng <= maxLng,
    );

    const within = boxed
      .map((s) => ({
        s,
        d: dMeters(
          { latitude: viewCenter.lat, longitude: viewCenter.lng },
          { latitude: s.lat, longitude: s.lng },
        ),
      }))
      .filter((x) => x.d <= r)
      .sort((a, b) => a.d - b.d)
      .slice(0, STOPS_LIMIT)
      .map((x) => x.s);

    if (selected && !within.some((w) => w.id === selected.id)) {
      within.push(selected);
    }
    return within;
  }, [allStops, viewCenter?.lat, viewCenter?.lng, viewZoom, selected?.id]);

  const idsKey = useMemo(
    () =>
      filtered
        .map((s) => s.id)
        .sort()
        .join("|"),
    [filtered],
  );

  const stopsFC: FeatureCollection<Point> = useMemo(
    () => ({
      type: "FeatureCollection",
      features: filtered.map((s) => ({
        type: "Feature",
        id: s.id,
        properties: { id: s.id, name: s.name },
        geometry: { type: "Point", coordinates: [Number(s.lng), Number(s.lat)] }, 
      })),
    }),
    [idsKey], 
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
          geometry: {
            type: "Point",
            coordinates: [Number(selected.lng), Number(selected.lat)],
          },
        },
      ],
    };
  }, [selected?.id]);

  return (
    <>
      <MapboxGL.ShapeSource
        id="stops"
        shape={stopsFC}
        tolerance={1}
        onPress={onPress}
        hitbox={{ width: 44, height: 44 }}
      >
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
            
            // ── NEW TEXT STYLES ──
            textField: "{name}", // Pulls the 'name' from GeoJSON properties
            textSize: 11,
            textColor: "#333333", // Dark gray for non-selected stops
            textHaloColor: "#FFFFFF",
            textHaloWidth: 1.5,
            textAnchor: "top", // Places text below the pin
            textOffset: [0, 0.8], // Slight spacing from the pin
            textAllowOverlap: false, // Hides text if it collides with another stop's text
            textOptional: true, // If text is hidden, keep the pin visible!
          }}
        />
      </MapboxGL.ShapeSource>

      {!!selectedFC && (
        <MapboxGL.ShapeSource id="stops-selected" shape={selectedFC}>
          <MapboxGL.SymbolLayer
            id="stops-selected-symbol"
            style={{
              iconImage: "matatu-pin",
              iconSize: 0.035, // Slightly bigger when selected
              iconRotationAlignment: "viewport",
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconAnchor: "center",
              iconOffset: [0, -4],
              
              // ── HIGHLIGHTED TEXT STYLES ──
              textField: "{name}",
              textSize: 13,
              textColor: "#FF6F00", // Mova Orange to make it pop
              textHaloColor: "#FFFFFF",
              textHaloWidth: 2,
              textAnchor: "top",
              textOffset: [0, 1],
              textAllowOverlap: true, // Selected text MUST always show
            }}
          />
        </MapboxGL.ShapeSource>
      )}
    </>
  );
}