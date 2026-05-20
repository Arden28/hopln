// components/app/StopDetailsSheet.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StopRoute, StopService } from "@/services/stop";

const ORANGE     = "#FF6F00";
const BLACK      = "#1C1C1E";
const GREY       = "#8E8E93";
const LIGHT      = "#F2F2F7";
const BORDER     = "#E5E5EA";
const WHITE      = "#FFFFFF";

const SCREEN_H = Dimensions.get("window").height;
const MAX_Y    = SCREEN_H * 0.08;
const MIN_Y    = SCREEN_H - 300;

type Stop = { id: string; name: string; lat: number; lng: number; location_t?: number };

interface Props {
  stop: Stop;
  onClose: () => void;
}

function locationLabel(t: number | undefined): string {
  switch (t) {
    case 0:  return "Bus Stop";
    case 1:  return "Bus Station";
    case 2:  return "Station Entrance";
    case 3:  return "Generic Node";
    default: return "Transit Stop";
  }
}

// ─── Fake photo tiles ─────────────────────────────────────────────────────────

function PhotoTile({ index }: { index: number }) {
  const colors = ["#E8EAF0", "#EAE8F0", "#E8F0EA"];
  return (
    <View style={[ph.tile, { backgroundColor: colors[index % 3] }]}>
      <Ionicons name="camera-outline" size={22} color={GREY} />
      <Text style={ph.label}>Add photo</Text>
    </View>
  );
}

const ph = StyleSheet.create({
  tile: {
    width: 110,
    height: 82,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginRight: 10,
  },
  label: { fontSize: 10, color: GREY, fontWeight: "500" },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export default function StopDetailsSheet({ stop, onClose }: Props): React.JSX.Element | null {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const lastY      = useRef(MIN_Y);
  const [expanded, setExpanded] = useState(false);

  const expandSheet = () => {
    Animated.spring(translateY, {
      toValue: MAX_Y, useNativeDriver: true, damping: 24, stiffness: 200,
    }).start();
    lastY.current = MAX_Y;
    setExpanded(true);
  };

  const collapseSheet = () => {
    Animated.spring(translateY, {
      toValue: MIN_Y, useNativeDriver: true, damping: 24, stiffness: 200,
    }).start();
    lastY.current = MIN_Y;
    setExpanded(false);
  };

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_H, duration: 260, useNativeDriver: true,
    }).start(onClose);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        translateY.setValue(Math.max(MAX_Y, lastY.current + g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if      (g.vy < -0.5 || g.dy < -40) expandSheet();
        else if (g.vy >  0.5 || g.dy >  40) collapseSheet();
        else if (lastY.current === MAX_Y)    expandSheet();
        else                                 collapseSheet();
      },
    })
  ).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: MIN_Y, useNativeDriver: true, damping: 24, stiffness: 200,
    }).start();
    lastY.current = MIN_Y;
    setExpanded(false);
  }, [stop.id, translateY]);

  const [routes, setRoutes]               = useState<StopRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);

  useEffect(() => {
    setRoutesLoading(true);
    StopService.getStopDetails(stop.id)
      .then((detail) => setRoutes(detail.routes))
      .catch(() => setRoutes([]))
      .finally(() => setRoutesLoading(false));
  }, [stop.id]);

  const lat = stop.lat.toFixed(6);
  const lng = stop.lng.toFixed(6);

  return (
    <Animated.View
      style={[s.panel, { height: SCREEN_H - MAX_Y, transform: [{ translateY }] }]}
    >
      {/* ── DRAG ZONE ── */}
      <View {...panResponder.panHandlers}>
        <View style={s.handleWrap}>
          <View style={s.handle} />
        </View>

        <View style={s.header}>
          <View style={s.iconBox}>
            <Ionicons name="bus" size={20} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.stopName} numberOfLines={2}>{stop.name}</Text>
            <Text style={s.stopType}>{locationLabel(stop.location_t)}</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={16} style={s.closeBtn}>
            <Ionicons name="close" size={16} color={BLACK} />
          </Pressable>
        </View>

        <View style={s.divider} />
      </View>

      {/* ── SCROLLABLE CONTENT ── */}
      <View style={s.scroll}>
        <ScrollView
          scrollEnabled={expanded}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          style={{ flex: 1 }}
        >
          {/* Coordinates */}
          <SectionHeader title="Location" />
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={16} color={ORANGE} />
            <Text style={s.infoText}>{lat}, {lng}</Text>
          </View>

          {/* Routes */}
          <SectionHeader title="Routes passing by" />
          {routesLoading ? (
            <ActivityIndicator size="small" color={ORANGE} style={{ alignSelf: "flex-start", marginTop: 4 }} />
          ) : routes.length > 0 ? (
            <View style={s.routesRow}>
              {routes.map((r: StopRoute) => (
                <View key={r.id} style={s.routeBadge}>
                  <Ionicons name="bus-outline" size={11} color={BLACK} />
                  <Text style={s.routeText}>{r.short_name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.emptyNote}>No route data available for this stop.</Text>
          )}

          {/* Photos */}
          <SectionHeader title="Photos" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.photoScroll}
          >
            {[0, 1, 2].map((i) => <PhotoTile key={i} index={i} />)}
          </ScrollView>

          {/* Contribute */}
          <SectionHeader title="Contribute" />
          <View style={s.contributeBox}>
            <Pressable
              style={({ pressed }) => [s.contributeRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {}}
            >
              <View style={[s.contribIcon, { backgroundColor: "#FFF3E0" }]}>
                <Ionicons name="camera-outline" size={18} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.contribTitle}>Add a Photo</Text>
                <Text style={s.contribSub}>Help others find this stop</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={GREY} />
            </Pressable>

            <View style={s.contribDivider} />

            <Pressable
              style={({ pressed }) => [s.contributeRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {}}
            >
              <View style={[s.contribIcon, { backgroundColor: "#FFF0F0" }]}>
                <Ionicons name="flag-outline" size={18} color="#FF3B30" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.contribTitle}>Report an Issue</Text>
                <Text style={s.contribSub}>Wrong location, name or info</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={GREY} />
            </Pressable>
          </View>
        </ScrollView>

        {!expanded && (
          <Pressable style={StyleSheet.absoluteFill} onPress={expandSheet} />
        )}
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 20,
    flexDirection: "column",
    overflow: "hidden",
  },

  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D1D6" },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopName: { fontSize: 17, fontWeight: "700", color: BLACK, lineHeight: 22 },
  stopType: { fontSize: 12, color: GREY, marginTop: 3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: LIGHT, alignItems: "center", justifyContent: "center",
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 60 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: GREY,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
  },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, color: BLACK, fontWeight: "500" },

  routesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  routeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: WHITE,
  },
  routeText: { fontSize: 12, fontWeight: "700", color: BLACK },
  emptyNote: { fontSize: 13, color: GREY, fontStyle: "italic" },

  photoScroll: { marginLeft: -4 },

  contributeBox: {
    borderRadius: 16,
    backgroundColor: LIGHT,
    overflow: "hidden",
  },
  contributeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  contribDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 14,
  },
  contribIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  contribTitle: { fontSize: 14, fontWeight: "600", color: BLACK },
  contribSub:   { fontSize: 12, color: GREY, marginTop: 1 },
});
