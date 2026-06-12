// components/app/JourneyDetailsSheet.tsx
import { formatDist, usePrefsStore } from "@/store/prefsStore";
import { shareJourney } from "@/utils/shareJourney";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
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

function RouteChips({ segments, dark, units }: { segments: any[]; dark: boolean; units: "km" | "mi" }) {
  const C = {
    walkPill: dark ? "#2C2C2E" : LIGHT_GREY,
    text:     dark ? "#FFFFFF" : BLACK,
    busBg:    dark ? "#1C1C1E" : BG,
    busBd:    dark ? "#3A3A3C" : "#C7C7CC",
  };
  const items: React.ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (i > 0) {
      items.push(<Ionicons key={`sep${i}`} name="chevron-forward" size={11} color={GREY} />);
    }
    if (seg.mode === "WALK") {
      const mins = Math.max(1, Math.round((seg.duration ?? 0) / 60));
      const dist = seg.distance ? formatDist(seg.distance, units) : null;
      items.push(
        <View key={i} style={[ch.walkPill, { backgroundColor: C.walkPill }]}>
          <Ionicons name="walk" size={12} color={C.text} />
          <Text style={[ch.walkText, { color: C.text }]}>{dist ?? mins}</Text>
        </View>
      );
    } else {
      items.push(
        <View key={i} style={[ch.busPill, { backgroundColor: C.busBg, borderColor: C.busBd }]}>
          <Ionicons name="bus-outline" size={10} color={C.text} style={{ marginRight: 3 }} />
          <Text style={[ch.busText, { color: C.text }]}>{seg.route_name ?? "Bus"}</Text>
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
  walkPill: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  walkText: { fontSize: 12, fontWeight: "600" },
  busPill:  { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  busText:  { fontSize: 12, fontWeight: "700" },
});

interface JourneyDetailsSheetProps {
  activeJourney: any;
  routeLoading: boolean;
  routeInfo: any;
  navigating: boolean;
  onToggleNav: (start: boolean) => void;
  onClose: () => void;
  mToNice: (m: number) => string;
  sToMin: (s: number) => string;
  isSaved?: boolean;
  onSave?: (label?: string) => Promise<void>;
  onUnsave?: () => Promise<void>;
  children?: React.ReactNode;
  scrollRef?: React.RefObject<ScrollView | null>;
}

export default function JourneyDetailsSheet({
  activeJourney,
  routeLoading,
  routeInfo,
  navigating,
  onToggleNav,
  onClose,
  sToMin,
  isSaved = false,
  onSave,
  onUnsave,
  children,
  scrollRef,
}: JourneyDetailsSheetProps): React.JSX.Element | null {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const lastY      = useRef(MIN_Y);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const dark = useColorScheme() === "dark";
  const { prefs } = usePrefsStore();
  const C = {
    bg:     dark ? "#1C1C1E" : BG,
    text:   dark ? "#FFFFFF" : BLACK,
    light:  dark ? "#2C2C2E" : LIGHT_GREY,
    border: dark ? "#2C2C2E" : BORDER,
    handle: dark ? "#3A3A3C" : "#D1D1D6",
  };

  const expandSheet = () => {
    Animated.spring(translateY, { toValue: MAX_Y, useNativeDriver: true, damping: 24, stiffness: 200 }).start();
    lastY.current = MAX_Y;
    setExpanded(true);
  };
  const collapseSheet = () => {
    Animated.spring(translateY, { toValue: MIN_Y, useNativeDriver: true, damping: 24, stiffness: 200 }).start();
    lastY.current = MIN_Y;
    setExpanded(false);
  };
  const handleClose = () => {
    Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }).start(onClose);
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
      style={[s.panel, { backgroundColor: C.bg, height: SCREEN_HEIGHT - MAX_Y, transform: [{ translateY }] }]}
    >
      {/* ── DRAG ZONE ── */}
      <View {...panResponder.panHandlers}>
        <View style={s.handleWrap}>
          <View style={[s.handle, { backgroundColor: C.handle }]} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            {routeLoading ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={ORANGE} />
                <Text style={s.loadingText}>Finding route…</Text>
              </View>
            ) : (
              <>
                <Text style={[s.timeText, { color: C.text }]}>
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
          <Pressable onPress={handleClose} hitSlop={16} style={[s.closeBtn, { backgroundColor: C.light }]}>
            <Ionicons name="close" size={17} color={C.text} />
          </Pressable>
        </View>

        {!routeLoading && segs.length > 0 && (
          <View style={s.chipsRow}>
            <RouteChips segments={segs} dark={dark} units={prefs.units} />
          </View>
        )}

        <View style={s.actionBar}>
          <Pressable
            style={({ pressed }) => [
              s.startBtn,
              { backgroundColor: navigating ? "#FF3B30" : ORANGE, opacity: pressed ? 0.88 : 1 },
            ]}
            onPress={() => onToggleNav(!navigating)}
          >
            <Ionicons name={navigating ? "stop-circle-outline" : "navigate"} size={17} color="#fff" />
            <Text style={s.startBtnText}>{navigating ? "End" : "Start"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.saveBtn, { borderColor: isSaved ? ORANGE : C.border, backgroundColor: isSaved ? "rgba(255,111,0,0.1)" : "transparent", opacity: pressed ? 0.7 : 1 }]}
            onPress={async () => {
              if (saving) return;
              if (isSaved) {
                setSaving(true);
                try { await onUnsave?.(); } finally { setSaving(false); }
              } else if (Platform.OS === "ios") {
                Alert.prompt(
                  "Save journey",
                  "Add an optional label (e.g. \"Work commute\")",
                  async (label: string) => {
                    setSaving(true);
                    try { await onSave?.(label?.trim() || undefined); } finally { setSaving(false); }
                  },
                  "plain-text",
                  "",
                );
              } else {
                setSaving(true);
                try { await onSave?.(); } finally { setSaving(false); }
              }
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={ORANGE} />
            ) : (
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={16} color={ORANGE} />
            )}
            <Text style={s.saveBtnText}>{isSaved ? "Saved" : "Save"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.saveBtn, { borderColor: C.border, backgroundColor: "transparent", opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              if (activeJourney?.fromLoc && activeJourney?.toLoc) {
                shareJourney(activeJourney.fromLoc, activeJourney.toLoc).catch(() => {});
              }
            }}
          >
            <Ionicons name="share-outline" size={16} color={GREY} />
            <Text style={[s.saveBtnText, { color: GREY }]}>Share</Text>
          </Pressable>
        </View>

        {/* Open in Maps */}
        <Pressable
          style={({ pressed }) => [s.mapsLink, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => {
            const { lat, lng } = activeJourney.toLoc;
            const name = encodeURIComponent(activeJourney.toLoc.name ?? "");
            let url: string;
            switch (prefs.mapApp) {
              case "google": url = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=walking`; break;
              case "apple":  url = `maps://?daddr=${lat},${lng}`; break;
              case "waze":   url = `waze://?ll=${lat},${lng}&navigate=yes`; break;
              default:
                url = Platform.OS === "ios"
                  ? `maps://?daddr=${lat},${lng}&q=${name}`
                  : `geo:${lat},${lng}?q=${name}`;
            }
            Linking.canOpenURL(url).then((can) => {
              if (can) Linking.openURL(url);
              else {
                const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
                Linking.openURL(web);
              }
            });
          }}
        >
          <Ionicons name="map-outline" size={14} color={GREY} />
          <Text style={s.mapsLinkText}>Open walking directions in {prefs.mapApp === "system" ? "Maps" : prefs.mapApp === "google" ? "Google Maps" : prefs.mapApp === "apple" ? "Apple Maps" : "Waze"}</Text>
          <Ionicons name="open-outline" size={13} color={GREY} />
        </Pressable>

        <View style={[s.divider, { backgroundColor: C.border }]} />
      </View>

      {/* ── SCROLLABLE STEPS ── */}
      <View style={s.scroll}>
        <ScrollView
          ref={scrollRef}
          scrollEnabled={expanded}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          style={{ flex: 1 }}
        >
          {children}
        </ScrollView>
        {!expanded && (
          <Pressable style={StyleSheet.absoluteFill} onPress={expandSheet} />
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  panel: {
    position:            "absolute",
    top: 0, left: 0, right: 0,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    shadowColor:          "#000",
    shadowOffset:         { width: 0, height: -3 },
    shadowOpacity:        0.09,
    shadowRadius:         16,
    elevation:            20,
    zIndex:               20,
    flexDirection:        "column",
    overflow:             "hidden",
  },

  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  handle:     { width: 40, height: 4, borderRadius: 2 },

  header: {
    flexDirection:    "row",
    alignItems:       "flex-start",
    paddingHorizontal: 20,
    paddingBottom:    14,
    gap:              12,
  },
  timeText:    { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 32 },
  arrivalText: { fontSize: 13, color: GREY, marginTop: 2 },
  loadingRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 15, color: GREY },
  closeBtn: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      2,
  },

  chipsRow: { paddingHorizontal: 20, paddingBottom: 12 },
  divider:  { height: StyleSheet.hairlineWidth },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },

  actionBar: {
    flexDirection:    "row",
    gap:              10,
    paddingHorizontal: 20,
    paddingTop:       12,
    paddingBottom:    16,
  },
  startBtn: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            7,
    paddingVertical: 15,
    borderRadius:   99,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  saveBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius:   99,
    borderWidth:    1.5,
  },
  saveBtnText: { color: ORANGE, fontSize: 16, fontWeight: "600" },

  mapsLink: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "center",
    gap:              6,
    paddingVertical:  10,
    paddingHorizontal: 20,
  },
  mapsLinkText: { fontSize: 12, color: GREY, flex: 1, textAlign: "center" },
});
