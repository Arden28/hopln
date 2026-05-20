import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
// Text is kept for ClusterBubble count label
import { Marker } from "react-native-maps";

type Stop = { id: string; name: string; lat: number; lng: number; route_nams?: string | null };

interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  stop: Stop | null; // non-null only when count === 1
}

const ORANGE          = "#FF6F00";
const CLUSTER_COLORS  = ["#FF9F43", "#FF6F00", "#C0392B"] as const; // sm / md / lg
const STOPS_MIN_ZOOM  = 13.0;

// Grid cell size in degrees per zoom band.
// Cells smaller → more individual markers visible; larger → more aggressive clustering.
function cellDeg(zoom: number): number {
  if (zoom >= 16) return 0;       // individual markers, no clustering
  if (zoom >= 15) return 0.002;   // ≈ 220 m
  if (zoom >= 14) return 0.004;   // ≈ 440 m
  return 0.008;                   // ≈ 880 m  (zoom 13–14)
}

// Viewport radius used to pre-filter before clustering (keeps useMemo fast).
function radiusForZoom(zoom: number): number {
  if (zoom < 13) return 0;
  if (zoom < 14) return 2000;
  if (zoom < 15) return 1400;
  if (zoom < 16) return 900;
  if (zoom < 17) return 550;
  return 380;
}

function dMeters(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R     = 6371e3;
  const dLat  = toRad(bLat - aLat);
  const dLon  = toRad(bLng - aLng);
  const la1   = toRad(aLat);
  const la2   = toRad(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type Props = {
  allStops: Stop[];
  viewCenter: { lat: number; lng: number } | null;
  viewZoom: number;
  selected?: Stop | null;
  onPress: (stop: Stop) => void;
};

export default function StopsLayer({
  allStops,
  viewCenter,
  viewZoom,
  selected,
  onPress,
}: Props) {

  const { clusters, selectedStop } = useMemo(() => {
    if (!viewCenter || viewZoom < STOPS_MIN_ZOOM) {
      return { clusters: [], selectedStop: selected ?? null };
    }

    const r = radiusForZoom(viewZoom);
    if (r <= 0) return { clusters: [], selectedStop: selected ?? null };

    // 1. Bounding-box pre-filter (fast, no sqrt)
    const dLat = r / 111320;
    const dLon = r / (111320 * Math.max(0.2, Math.cos((viewCenter.lat * Math.PI) / 180)));
    const minLat = viewCenter.lat - dLat;
    const maxLat = viewCenter.lat + dLat;
    const minLng = viewCenter.lng - dLon;
    const maxLng = viewCenter.lng + dLon;

    // Exclude the selected stop — it always gets its own marker below
    const selId = selected?.id ?? null;

    const inBounds = allStops.filter(
      (s) =>
        s.id !== selId &&
        s.lat >= minLat && s.lat <= maxLat &&
        s.lng >= minLng && s.lng <= maxLng,
    );

    // 2. Circle filter
    const nearby = inBounds.filter(
      (s) => dMeters(viewCenter.lat, viewCenter.lng, s.lat, s.lng) <= r,
    );

    // 3. Grid clustering
    const cs = cellDeg(viewZoom);

    if (cs === 0) {
      // No clustering — render individual markers (capped to avoid overload)
      const capped = nearby.slice(0, 500);
      return {
        clusters: capped.map<Cluster>((s) => ({
          id: s.id, lat: s.lat, lng: s.lng, count: 1, stop: s,
        })),
        selectedStop: selected ?? null,
      };
    }

    const cells = new Map<string, Stop[]>();
    for (const s of nearby) {
      const key = `${Math.floor(s.lat / cs)},${Math.floor(s.lng / cs)}`;
      const arr = cells.get(key);
      if (arr) arr.push(s);
      else cells.set(key, [s]);
    }

    const result: Cluster[] = [];
    for (const [key, group] of cells) {
      const lat = group.reduce((sum, s) => sum + s.lat, 0) / group.length;
      const lng = group.reduce((sum, s) => sum + s.lng, 0) / group.length;
      result.push({
        id:    group.length === 1 ? group[0].id : `cluster-${key}`,
        lat,
        lng,
        count: group.length,
        stop:  group.length === 1 ? group[0] : null,
      });
    }

    return { clusters: result, selectedStop: selected ?? null };
  }, [allStops, viewCenter?.lat, viewCenter?.lng, viewZoom, selected?.id]);

  return (
    <>
      {/* Clustered + individual markers */}
      {clusters.map((c) =>
        c.count === 1 && c.stop ? (
          // ── Individual stop ──────────────────────────────────────────────
          <Marker
            key={c.id}
            identifier={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            onPress={() => onPress(c.stop!)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={s.pin}>
              <Image
                source={require("@/assets/images/matatu.png")}
                style={s.icon}
                resizeMode="contain"
              />
            </View>
          </Marker>
        ) : (
          // ── Cluster bubble ───────────────────────────────────────────────
          <Marker
            key={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => {
              // Pressing a cluster does nothing (user zooms in naturally)
            }}
          >
            <ClusterBubble count={c.count} />
          </Marker>
        ),
      )}

      {/* Selected stop — always on top, larger icon */}
      {selectedStop && (
        <Marker
          key={`${selectedStop.id}-selected`}
          identifier={selectedStop.id}
          coordinate={{ latitude: selectedStop.lat, longitude: selectedStop.lng }}
          onPress={() => onPress(selectedStop)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}
          zIndex={99}
        >
          <View style={s.pin}>
            <Image
              source={require("@/assets/images/matatu.png")}
              style={s.iconSelected}
              resizeMode="contain"
            />
          </View>
        </Marker>
      )}
    </>
  );
}

// ── Cluster bubble ─────────────────────────────────────────────────────────────

function clusterColor(count: number): string {
  if (count >= 50) return CLUSTER_COLORS[2];
  if (count >= 10) return CLUSTER_COLORS[1];
  return CLUSTER_COLORS[0];
}

function clusterSize(count: number): number {
  if (count >= 50) return 46;
  if (count >= 10) return 38;
  return 30;
}

function ClusterBubble({ count }: { count: number }) {
  const size  = clusterSize(count);
  const color = clusterColor(count);
  return (
    <View
      style={[
        s.cluster,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={s.clusterText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pin: {
    alignItems: "center",
  },
  icon: {
    width: 18,
    height: 18,
  },
  iconSelected: {
    width: 30,
    height: 30,
  },
  cluster: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  clusterText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
});
