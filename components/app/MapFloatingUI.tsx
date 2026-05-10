// components/app/MapFloatingUI.tsx
import { Step, stepIcon, mToNice } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import React, { JSX, useRef } from "react";
// Added TextInpu just for visual placeholder in the designed SearchBar
import { Animated, Image, Pressable, StyleSheet, Text, View, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";
const BLACK = "#000000";
const BG_WHITE = "#FFFFFF";
const BORDER_COLOR = "#E5E7EB";
const GREY = "#8E8E93";

interface MapFloatingUIProps {
  onRecenter: () => void;
  onOpenSearch: () => void;
  onOpenKwame: () => void; // <--- NEW PROP
  navigating: boolean;
  onToggleNav: () => void;
  nextPreview: string | null;
  nextStep?: Step;
  eta: Date | null;
  remainingDistanceM: number | null;
  arrivalSoonShown: boolean;
  hasSelectedStop: boolean;
  onToggleNearest: () => void;
  nearestCount: number;
  hasLocation: boolean;
  activeJourney: any;
  onClearJourney: () => void;
}

export default function MapFloatingUI({
  onRecenter,
  onOpenSearch,
  onOpenKwame, // <--- NEW PROP
  navigating,
  onToggleNav,
  nextPreview,
  nextStep,
  eta,
  remainingDistanceM,
  arrivalSoonShown,
  hasSelectedStop,
  onToggleNearest,
  nearestCount,
  hasLocation,
  activeJourney,
  onClearJourney,
}: MapFloatingUIProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const searchScale = useRef(new Animated.Value(1)).current;

  const formatEta = (date: Date) => {
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  if (activeJourney) {
    // ... activeJourney UI remains the same ...
    return (
        // ... previous activeJourney JSX ...
        <View style={[styles.journeyCard, { top: insets.top + 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.journeyCardTitle}>
              Line {activeJourney.route.route_short_name || activeJourney.route.segments.find((s:any) => s.mode === 'BUS')?.route_name || "Walk"}
            </Text>
            <Text style={styles.journeyCardSub} numberOfLines={1}>
              To {activeJourney.toLoc.name}
            </Text>
          </View>
          <Pressable onPress={onClearJourney} style={styles.journeyCloseBtn}>
            <Ionicons name="close" size={24} color={BLACK} />
          </Pressable>
        </View>
    );
  }

  // ── DEFAULT EXPLORATION UI (Where Kwame lives) ──
  return (
    <>
      <View style={[styles.topContainer, { paddingTop: insets.top || 40 }]}>
        <Animated.View style={{ transform: [{ scale: searchScale }] }}>
          {/* We wrap the search bar in Kwame's Peeking Wrapper */}
          <View style={styles.kwameSearchWrapper}>
            
            {/* Kwame's Face - The Trigger Button */}
            <Pressable onPress={onOpenKwame} style={styles.kwameAvatarBtn} hitSlop={10}>
                {/* Placeholder require. You'll need an asset here, or I can provide an SVG alternative */}
                <Image 
                    source={require("@/assets/images/kwame.png")} 
                    style={styles.kwameAvatar} 
                />
            </Pressable>
            
            {/* Standard Search Bar */}
            <Pressable
                onPressIn={() => Animated.spring(searchScale, { toValue: 0.98, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(searchScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start()}
                onPress={onOpenSearch}
                style={styles.searchBar}
            >
                {/* Inside the search bar, the icon changes based on Kwame context */}
                <Ionicons name="location" size={20} color="#EA4335" style={{marginRight: 8}} />
                <Text style={styles.searchText}>Search here...</Text>
                
                <View style={styles.searchRight}>
                    <Ionicons name="mic" size={20} color={GREY} />
                    {/* Your profile avatar remains here */}
                    <Image source={require("@/assets/images/me.png")} style={styles.avatar} />
                </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      <View style={styles.bottomRightStack}>
        <Pressable style={[styles.controlBtn, { marginBottom: 12 }]}>
            <Ionicons name="navigate" size={22} color={BLACK} />
        </Pressable>
        {!hasSelectedStop && (
          <Pressable onPress={onToggleNearest} style={styles.bottomRightFab}>
            <Ionicons name="bus" size={26} color="#fff" />
            {hasLocation && nearestCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{nearestCount}</Text></View>
            )}
          </Pressable>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topContainer: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  
  // ── KWAME UI INTEGRATION STYLES ──
  kwameSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    zIndex: 10,
  },
  kwameAvatarBtn: {
    zIndex: 11, // ensures Kwame is above the search bar
    marginRight: -10, // Peeks over the search bar edge
  },
  kwameAvatar: {
    width: 58, // Slightly larger than standard avatar to be distinct
    height: 58,
    borderRadius: 29, // circle
    borderWidth: 3,
    borderColor: BG_WHITE,
    backgroundColor: '#F2F2F7', // Default placeholder color

    // Elegant shadow for the peeking character
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  searchBar: { 
    flex: 1, // takes remaining space
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: BG_WHITE, 
    height: 54, 
    borderTopLeftRadius: 0, // Kwame "caps" the left end
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    paddingLeft: 22, // Extra padding to accommodate Kwame's overlap
    paddingRight: 16, 
    shadowColor: "#000", 
    shadowOpacity: 0.08, 
    shadowRadius: 6, 
    shadowOffset: { width: 0, height: 6 }, 
    elevation: 8 
  },
  searchText: { flex: 1, fontSize: 16, color: "#4B5563", marginLeft: 4 },
  searchRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", marginLeft: 4 },
  
  // ... Rest of your existing styles ...
  bottomRightStack: { position: "absolute", right: 16, bottom: 40, alignItems: "center", zIndex: 5 },
  controlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: BG_WHITE, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  bottomRightFab: { width: 56, height: 56, borderRadius: 16, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  badge: { position: "absolute", top: -6, right: -6, backgroundColor: "#111827", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  journeyCard: { position: "absolute", left: 16, right: 16, backgroundColor: BG_WHITE, padding: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", zIndex: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  journeyCardTitle: { fontSize: 18, fontWeight: "700", color: BLACK },
  journeyCardSub: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  journeyCloseBtn: { padding: 8, backgroundColor: "#F3F4F6", borderRadius: 999 },
  bottomActionContainer: { position: "absolute", bottom: 40, left: 16, right: 16, zIndex: 10 },
  startTripBtn: { backgroundColor: ORANGE, paddingVertical: 16, borderRadius: 16, alignItems: "center", shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  stopTripBtn: { backgroundColor: "#EF4444", shadowColor: "#EF4444" },
  startTripText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  navBanner: { position: "absolute", left: 16, right: 16, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: BG_WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER_COLOR, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  navBannerLeft: { flexDirection: "row", alignItems: "center" },
  navBannerText: { color: BLACK, fontSize: 16, fontWeight: "600", flexShrink: 1 },
  etaText: { color: "#6B7280", fontSize: 13, marginTop: 4, fontWeight: "500" },
  arrivalPill: { position: "absolute", left: 16, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#FFF7ED", borderRadius: 999, borderWidth: 1, borderColor: "#FED7AA", flexDirection: "row", alignItems: "center", gap: 6 },
});