// components/app/MapFloatingUI.tsx
import { Step, mToNice, stepIcon } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import React, { JSX, useRef } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";
const BLACK  = "#1C1C1E";
const GREY   = "#8E8E93";
const WHITE  = "#FFFFFF";
const BLUE   = "#007AFF";
const GREEN  = "#34C759";

interface MapFloatingUIProps {
  onRecenter: () => void;
  onOpenSearch: () => void;
  onOpenKwame: () => void;
  navigating: boolean;
  onToggleNav: () => void;
  nextPreview: string | null;
  nextStep?: Step;
  showNavSub?: boolean;
  eta: Date | null;
  remainingDistanceM: number | null;
  arrivalSoonShown: boolean;
  activeJourney: any;
  onClearJourney: () => void;
  bottomOffset?: number;
}

function formatEta(date: Date): string {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function MapFloatingUI({
  onRecenter, onOpenSearch, onOpenKwame,
  navigating, onToggleNav,
  nextPreview, nextStep, showNavSub = true, eta, remainingDistanceM, arrivalSoonShown,
  activeJourney, onClearJourney,
  bottomOffset = 0,
}: MapFloatingUIProps): JSX.Element {
  const insets  = useSafeAreaInsets();
  const lastTap = useRef(0);
  const dark    = useColorScheme() === "dark";
  const cardBg  = dark ? "#1C1C1E" : WHITE;
  const textColor = dark ? "#FFFFFF" : BLACK;
  const lightBg = dark ? "#2C2C2E" : "#F2F2F7";
  const softOrange = dark ? "rgba(255,111,0,0.18)" : "#FFF3E0";

  const handleNavBtn = () => {
    const now = Date.now();
    if (now - lastTap.current <= 400) {
      onToggleNav();
      lastTap.current = 0;
    } else {
      onRecenter();
      lastTap.current = now;
    }
  };

  let topContent: React.ReactNode;

  if (arrivalSoonShown) {
    topContent = (
      <View style={[s.arrivalBanner, { backgroundColor: cardBg }]}>
        <Ionicons name="checkmark-circle" size={20} color={GREEN} />
        <Text style={s.arrivalText}>{"You've arrived!"}</Text>
      </View>
    );
  } else if (navigating && nextPreview) {
    topContent = (
      <View style={s.navBanner}>
        <View style={s.navIconBox}>
          <Ionicons name={nextStep ? stepIcon(nextStep.type) : "navigate"} size={20} color={WHITE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.navInstruction} numberOfLines={1}>{nextPreview}</Text>
          {showNavSub && remainingDistanceM != null && (
            <Text style={s.navSub}>{mToNice(remainingDistanceM)} remaining</Text>
          )}
        </View>
        {eta && <Text style={s.navEta}>{formatEta(eta)}</Text>}
      </View>
    );
  } else if (activeJourney) {
    topContent = (
      <View style={[s.journeyBanner, { backgroundColor: cardBg }]}>
        <Ionicons name="navigate-circle" size={20} color={ORANGE} />
        <Text style={[s.journeyText, { color: textColor }]} numberOfLines={1}>
          To {activeJourney.toLoc.name}
        </Text>
        <Pressable onPress={onClearJourney} hitSlop={12} style={[s.bannerClose, { backgroundColor: lightBg }]}>
          <Ionicons name="close" size={15} color={GREY} />
        </Pressable>
      </View>
    );
  } else {
    topContent = (
      <Pressable style={[s.searchBar, { backgroundColor: cardBg }]} onPress={onOpenSearch}>
        <View style={s.searchTouchable}>
          <Ionicons name="search" size={18} color={GREY} />
          <Text style={s.searchPlaceholder}>{"Search destination…"}</Text>
        </View>
        <Pressable onPress={onOpenKwame} style={[s.kwameChip, { backgroundColor: softOrange }]}>
          <Ionicons name="sparkles" size={14} color={ORANGE} />
          <Text style={s.kwameChipText}>AI</Text>
        </Pressable>
      </Pressable>
    );
  }

  return (
    <>
      <View style={[s.topArea, { paddingTop: (insets.top || 44) + 8 }]}>
        {topContent}
      </View>

      <View style={[s.stack, { bottom: (insets.bottom || 0) + 36 + bottomOffset }]}>
        <Pressable
          onPress={handleNavBtn}
          style={[
            s.navBtn,
            { backgroundColor: cardBg },
            dark && {
              borderTopColor:    "rgba(255,255,255,0.08)",
              borderBottomColor: "rgba(0,0,0,0.30)",
              borderLeftColor:   "rgba(0,0,0,0.12)",
              borderRightColor:  "rgba(0,0,0,0.12)",
            },
          ]}
        >
          <Ionicons
            name={navigating ? "compass" : "navigate"}
            size={22}
            color={navigating ? BLUE : ORANGE}
          />
        </Pressable>
      </View>
    </>
  );
}

const mapShadow = {
  shadowColor:   "#000",
  shadowOpacity: 0.18,
  shadowRadius:  12,
  shadowOffset:  { width: 0, height: 4 },
  elevation:     8,
} as const;

const s = StyleSheet.create({
  topArea: {
    position:        "absolute",
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    zIndex:          10,
  },

  searchBar: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              10,
    borderRadius:     16,
    paddingVertical:  14,
    paddingHorizontal: 16,
    ...mapShadow,
  },
  searchPlaceholder: {
    flex:       1,
    fontSize:   16,
    color:      GREY,
    fontWeight: "400",
  },
  searchTouchable: {
    flex:          1,
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  kwameChip: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              4,
    borderRadius:     8,
    paddingHorizontal: 12,
    paddingVertical:  9,
  },
  kwameChipText: {
    fontSize:      12,
    fontWeight:    "700",
    color:         ORANGE,
    letterSpacing: 0.3,
  },

  journeyBanner: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              10,
    borderRadius:     16,
    paddingVertical:  13,
    paddingHorizontal: 16,
    ...mapShadow,
  },
  journeyText: {
    flex:       1,
    fontSize:   16,
    fontWeight: "600",
  },
  bannerClose: {
    width:          26,
    height:         26,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
  },

  navBanner: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              12,
    backgroundColor:  ORANGE,
    borderRadius:     16,
    paddingVertical:  13,
    paddingHorizontal: 14,
    ...mapShadow,
  },
  navIconBox: {
    width:          36,
    height:         36,
    borderRadius:   10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems:     "center",
    justifyContent: "center",
  },
  navInstruction: { color: WHITE, fontSize: 15, fontWeight: "600" },
  navSub:         { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 2 },
  navEta:         { color: WHITE, fontSize: 15, fontWeight: "700", flexShrink: 0 },

  arrivalBanner: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              8,
    alignSelf:        "center",
    borderRadius:     999,
    paddingVertical:  10,
    paddingHorizontal: 20,
    ...mapShadow,
  },
  arrivalText: { fontSize: 16, fontWeight: "700", color: GREEN },

  stack: {
    position:  "absolute",
    right:     16,
    alignItems: "center",
    gap:        12,
    zIndex:     5,
  },

  navBtn: {
    width:        52,
    height:       52,
    borderRadius: 26,
    alignItems:   "center",
    justifyContent: "center",
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation:    12,
    borderTopWidth:    1,
    borderTopColor:    "rgba(255,255,255,0.9)",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(0,0,0,0.10)",
    borderLeftWidth:   StyleSheet.hairlineWidth,
    borderLeftColor:   "rgba(0,0,0,0.05)",
    borderRightWidth:  StyleSheet.hairlineWidth,
    borderRightColor:  "rgba(0,0,0,0.05)",
  },

  nearBtn: {
    width:        52,
    height:       52,
    borderRadius: 16,
    alignItems:   "center",
    justifyContent: "center",
    shadowColor:  "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation:    5,
    borderWidth:  StyleSheet.hairlineWidth,
    borderColor:  "rgba(0,0,0,0.06)",
  },
  badge: {
    position:       "absolute",
    top:            -4,
    right:          -4,
    backgroundColor: ORANGE,
    borderRadius:   999,
    minWidth:       18,
    height:         18,
    paddingHorizontal: 4,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    2,
    borderColor:    WHITE,
  },
  badgeText: { color: WHITE, fontSize: 10, fontWeight: "700", lineHeight: 12 },
});
