// components/app/JourneyDetailsSheet.tsx
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

const ORANGE     = "#FF6F00";
const BLACK      = "#1C1C1E";
const GREY       = "#8E8E93";
const LIGHT_GREY = "#F2F2F7";
const BORDER     = "#E5E5EA";
const BG         = "#FFFFFF";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_Y = SCREEN_HEIGHT * 0.08;
const MIN_Y = SCREEN_HEIGHT - 310;

function arrivalTime(secs: number): string {
  return new Date(Date.now() + secs * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Route chips ──────────────────────────────────────────────────────────────

function RouteChips({ segments }: { segments: any[] }) {
  const items: React.ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (i > 0) {
      items.push(
        <Ionicons key={`sep${i}`} name="chevron-forward" size={11} color={GREY} />
      );
    }
    if (seg.mode === "WALK") {
      const mins = Math.max(1, Math.round((seg.duration ?? 0) / 60));
      items.push(
        <View key={i} style={ch.walkPill}>
          <Ionicons name="walk" size={12} color={BLACK} />
          <Text style={ch.walkText}>{mins}</Text>
        </View>
      );
    } else {
      items.push(
        <View key={i} style={ch.busPill}>
          <Ionicons name="bus-outline" size={10} color={BLACK} style={{ marginRight: 3 }} />
          <Text style={ch.busText}>{seg.route_name ?? "Bus"}</Text>
        </View>
      );
    }
  });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ch.row}>
      {items}
    </ScrollView>
  );
}

const ch = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: 5 },
  walkPill: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: LIGHT_GREY, borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  walkText: { fontSize: 12, fontWeight: "600", color: BLACK },
  busPill: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#C7C7CC", borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3, backgroundColor: BG,
  },
  busText: { fontSize: 12, fontWeight: "700", color: BLACK },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface JourneyDetailsSheetProps {
  activeJourney: any;
  routeLoading: boolean;
  routeInfo: any;
  navigating: boolean;
  onToggleNav: (start: boolean) => void;
  onClose: () => void;
  mToNice: (m: number) => string;
  sToMin: (s: number) => string;
  children?: React.ReactNode;
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export default function JourneyDetailsSheet({
  activeJourney,
  routeLoading,
  routeInfo,
  navigating,
  onToggleNav,
  onClose,
  sToMin,
  children,
}: JourneyDetailsSheetProps): React.JSX.Element | null {

  const translateY  = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const lastY       = useRef(MIN_Y);
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
      toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true,
    }).start(onClose);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove:    (_, g) => { translateY.setValue(Math.max(MAX_Y, lastY.current + g.dy)); },
      onPanResponderRelease: (_, g) => {
        if      (g.vy < -0.5 || g.dy < -40) expandSheet();
        else if (g.vy >  0.5 || g.dy >  40) collapseSheet();
        else lastY.current === MAX_Y ? expandSheet() : collapseSheet();
      },
    })
  ).current;

  useEffect(() => { if (activeJourney) collapseSheet(); }, [activeJourney]);

  if (!activeJourney) return null;

  const segs = activeJourney.route?.segments ?? [];

  return (
    <Animated.View
      style={[s.panel, { height: SCREEN_HEIGHT - MAX_Y, transform: [{ translateY }] }]}
    >
      {/* ── DRAG ZONE ── */}
      <View {...panResponder.panHandlers}>
        <View style={s.handleWrap}><View style={s.handle} /></View>

        <View style={s.header}>
          {/* <View style={s.busIconBox}>
            <Ionicons name="bus" size={20} color={BLACK} />
          </View> */}
          <View style={{ flex: 1 }}>
            {routeLoading ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={ORANGE} />
                <Text style={s.loadingText}>Finding route…</Text>
              </View>
            ) : (
              <>
                <Text style={s.timeText}>
                  {routeInfo ? sToMin(routeInfo.duration).replace("~", "") : "--"}
                </Text>
                {routeInfo && (
                  <Text style={s.arrivalText}>
                    Arrive at {arrivalTime(routeInfo.duration)}
                  </Text>
                )}
              </>
            )}
          </View>
          <Pressable onPress={handleClose} hitSlop={16} style={s.closeBtn}>
            <Ionicons name="close" size={17} color={BLACK} />
          </Pressable>
        </View>

        {!routeLoading && segs.length > 0 && (
          <View style={s.chipsRow}><RouteChips segments={segs} /></View>
        )}

        {/* Action buttons live here so they're visible in collapsed state */}
        <View style={s.actionBar}>
          <Pressable
            style={({ pressed }) => [
              s.startBtn,
              { backgroundColor: navigating ? "#FF3B30" : ORANGE, opacity: pressed ? 0.88 : 1 },
            ]}
            onPress={() => onToggleNav(!navigating)}
          >
            <Ionicons
              name={navigating ? "stop-circle-outline" : "navigate"}
              size={17}
              color="#fff"
            />
            <Text style={s.startBtnText}>{navigating ? "End Navigation" : "Start"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.saveBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => console.log("Save journey")}
          >
            <Ionicons name="bookmark-outline" size={16} color={ORANGE} />
            <Text style={s.saveBtnText}>Save</Text>
          </Pressable>
        </View>

        <View style={s.divider} />
      </View>

      {/* ── SCROLLABLE STEPS ── */}
      <View style={s.scroll}>
        <ScrollView
          scrollEnabled={expanded}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          style={{ flex: 1 }}
        >
          {children}
        </ScrollView>
        {/* When collapsed, tap anywhere in the steps area to expand */}
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
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 20,
    flexDirection: "column", // explicit flex column so scroll + bar share height
    overflow: "hidden",
  },

  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D1D6" },

  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 20, paddingBottom: 14, gap: 12,
  },
  busIconBox: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: LIGHT_GREY,
    alignItems: "center", justifyContent: "center",
  },
  timeText:    { fontSize: 28, fontWeight: "700", color: BLACK, letterSpacing: -0.5, lineHeight: 32 },
  arrivalText: { fontSize: 13, color: GREY, marginTop: 2 },
  loadingRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 15, color: GREY },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: LIGHT_GREY, alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },

  chipsRow: { paddingHorizontal: 20, paddingBottom: 12 },
  divider:  { height: StyleSheet.hairlineWidth, backgroundColor: BORDER },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },

  actionBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  startBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 15, borderRadius: 99,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 15, paddingHorizontal: 22,
    borderRadius: 99, borderWidth: 1.5, borderColor: BORDER,
  },
  saveBtnText: { color: ORANGE, fontSize: 16, fontWeight: "600" },
});