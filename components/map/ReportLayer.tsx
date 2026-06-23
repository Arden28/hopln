// components/map/ReportLayer.tsx
//
// Report pins rendered as a plain React Native overlay ABOVE the MapView —
// NOT as <Marker> children of the map.
//
// Why: custom <Marker> views on Android PROVIDER_GOOGLE are rasterised to a
// native bitmap (tracksViewChanges). Google Maps recycles those bitmaps during
// zoom/tile reloads, and the bitmap is never re-pushed → the marker vanishes
// and only reappears on the next React snapshot. No tracksViewChanges tuning
// fixes this reliably.
//
// This overlay sidesteps the entire native-marker lifecycle: every report is a
// normal RN <Pressable> positioned by projecting its lat/lng to screen space
// via mapRef.pointForCoordinate(). pointForCoordinate is asked of the native
// map, so it is correct under any pan / zoom / rotation / tilt. This is the
// same strategy NavIndicator uses for the user-location dot.
//
// Projection strategy: instead of a 20 Hz setInterval, the parent calls
// ref.project() from onRegionChangeComplete (once per settled pan/zoom). This
// eliminates idle CPU and gives exact timing.

import type { TransitReport } from "@/services/report";
import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MapView } from "@rnmapbox/maps";

// Must stay in sync with ReportSheet CATS and ReportDetailCard CAT
const CAT: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  traffic_jam:   { icon: "car-outline",          color: "#FF6F00" },
  accident:      { icon: "alert-circle-outline", color: "#FF3B30" },
  road_blocked:  { icon: "close-circle-outline", color: "#FF2D55" },
  stage_queue:   { icon: "people-outline",       color: "#FF9500" },
  police_check:  { icon: "shield-outline",       color: "#007AFF" },
  flooded_route: { icon: "water-outline",        color: "#5856D6" },
  breakdown:     { icon: "build-outline",        color: "#AF52DE" },
  security:      { icon: "alert-outline",        color: "#D32F2F" },
  fare_hike:     { icon: "trending-up-outline",  color: "#30B050" },
};

const PIN   = 34;          // pin diameter
const WRAP  = 44;          // touch target
const HALF  = WRAP / 2;

// ── Clustering ────────────────────────────────────────────────────────────────
const CLUSTER_DEG = 30 / 111_320; // 30 m in latitude degrees

interface Group { primary: TransitReport; count: number }

function clusterReports(reports: TransitReport[]): Group[] {
  const sorted = [...reports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const used = new Set<string>();
  const groups: Group[] = [];

  for (const r of sorted) {
    if (used.has(r.id)) continue;
    used.add(r.id);
    let count = 1;
    for (const other of sorted) {
      if (used.has(other.id)) continue;
      if (
        Math.abs(r.lat - other.lat) < CLUSTER_DEG &&
        Math.abs(r.lng - other.lng) < CLUSTER_DEG
      ) {
        used.add(other.id);
        count++;
      }
    }
    groups.push({ primary: r, count });
  }

  return groups;
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export interface ReportLayerHandle {
  /** Re-project all pins to current screen coordinates. Call from onRegionChangeComplete. */
  project(): void;
}

interface ReportLayerProps {
  reports:  TransitReport[];
  mapRef:   React.RefObject<MapView | null>;
  onPress:  (report: TransitReport, count: number) => void;
}

export const ReportLayer = memo(forwardRef<ReportLayerHandle, ReportLayerProps>(
  function ReportLayer({ reports, mapRef, onPress }, ref) {
    const groups = useMemo(() => clusterReports(reports), [reports]);
    const [positions, setPositions] = useState<({ x: number; y: number } | null)[]>([]);

    const project = useCallback(async () => {
      const map = mapRef.current;
      if (!map || groups.length === 0) {
        setPositions([]);
        return;
      }
      const pts = await Promise.all(
        groups.map((g) =>
          map
            .getPointInView([g.primary.lng, g.primary.lat])
            .then(([x, y]) => ({ x, y }))
            .catch(() => null)
        )
      );
      setPositions(pts);
    }, [groups, mapRef]);

    // Expose project() so map.tsx can call it from onRegionChangeComplete.
    useImperativeHandle(ref, () => ({ project }), [project]);

    // Re-project when report data changes (new fetch, filter toggle, etc.).
    useEffect(() => { project(); }, [project]);

    if (groups.length === 0) return null;

    return (
      // box-none: the container never intercepts touches; only the pins do, so the
      // map stays fully pannable in the gaps between pins.
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {groups.map((g, i) => {
          const p = positions[i];
          if (!p) return null;
          return (
            <ReportPin
              key={g.primary.id}
              x={p.x}
              y={p.y}
              type={g.primary.type}
              count={g.count}
              onPress={() => onPress(g.primary, g.count)}
            />
          );
        })}
      </View>
    );
  }
));

// ── Single pin ────────────────────────────────────────────────────────────────

const ReportPin = memo(function ReportPin({
  x, y, type, count, onPress,
}: {
  x: number; y: number; type: string; count: number; onPress: () => void;
}) {
  const meta = CAT[type] ?? { icon: "warning-outline" as const, color: "#FF9500" };
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[s.pinWrap, { transform: [{ translateX: x - HALF }, { translateY: y - HALF }] }]}
    >
      <View style={[s.pin, { backgroundColor: meta.color }]}>
        <Ionicons name={meta.icon} size={15} color="#fff" />
      </View>
      {count > 1 && (
        <View style={[s.badge, { borderColor: meta.color }]}>
          <Text style={[s.badgeText, { color: meta.color }]}>
            {count > 9 ? "9+" : String(count)}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pinWrap: {
    position: "absolute",
    top: 0, left: 0,
    width: WRAP, height: WRAP,
    alignItems: "center", justifyContent: "center",
  },
  pin: {
    width: PIN, height: PIN, borderRadius: PIN / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor:   "#000",
        shadowOpacity: 0.22,
        shadowRadius:  4,
        shadowOffset:  { width: 0, height: 2 },
      },
      android: { elevation: 5 },
    }),
  },
  badge: {
    position: "absolute", top: 2, right: 2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FFFFFF", borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    ...Platform.select({ android: { elevation: 6 } }),
  },
  badgeText: { fontSize: 9, fontWeight: "800", lineHeight: 11 },
});
