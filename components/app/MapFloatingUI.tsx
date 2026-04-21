// components/app/MapFloatingUI.tsx
import { Step, stepIcon } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import { JSX } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ORANGE = "#FF6F00";
const BLACK = "#000000";

interface MapFloatingUIProps {
  onRecenter: () => void;
  onOpenSearch: () => void;
  navigating: boolean;
  onToggleNav: () => void;
  nextPreview: string | null;
  nextStep?: Step;
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
  navigating,
  onToggleNav,
  nextPreview,
  nextStep,
  arrivalSoonShown,
  hasSelectedStop,
  onToggleNearest,
  nearestCount,
  hasLocation,
  activeJourney,
  onClearJourney,
}: MapFloatingUIProps): JSX.Element {
  // ── ACTIVE JOURNEY UI ──
  if (activeJourney) {
    return (
      <>
        {/* Top Journey Card */}
        <View style={styles.journeyCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.journeyCardTitle}>
              Line {activeJourney.route.route_short_name}
            </Text>
            {/* FIXED: Changed toStop to toLoc here! */}
            <Text style={styles.journeyCardSub} numberOfLines={1}>
              To {activeJourney.toLoc.name}
            </Text>
          </View>
          <Pressable onPress={onClearJourney} style={styles.journeyCloseBtn}>
            <Ionicons name="close" size={24} color={BLACK} />
          </Pressable>
        </View>

        {/* Bottom Start Trip / Stop Trip Button */}
        <View style={styles.bottomActionContainer}>
          <Pressable
            style={[styles.startTripBtn, navigating && styles.stopTripBtn]}
            onPress={onToggleNav}
          >
            <Text style={styles.startTripText}>
              {navigating ? "End Trip" : "Start Trip"}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ── DEFAULT EXPLORATION UI ──
  return (
    <>
      <Pressable
        onPress={onRecenter}
        style={styles.recenter}
        accessibilityRole="button"
      >
        <Ionicons name="locate-outline" size={22} color={BLACK} />
      </Pressable>

      <Pressable
        onPress={onOpenSearch}
        style={styles.searchFab}
        accessibilityRole="button"
      >
        <Ionicons name="search-outline" size={22} color={BLACK} />
      </Pressable>

      {navigating && nextPreview && (
        <View style={styles.navBanner}>
          <Ionicons
            name={stepIcon(nextStep?.type, nextStep?.modifier)}
            size={18}
            color={BLACK}
          />
          <Text numberOfLines={1} style={styles.navBannerText}>
            {nextPreview}
          </Text>
        </View>
      )}

      {navigating && arrivalSoonShown && (
        <View style={styles.arrivalPill}>
          <Ionicons name="location-outline" size={16} color={BLACK} />
          <Text style={{ color: BLACK, fontWeight: "600" }}>
            You’re here — almost
          </Text>
        </View>
      )}

      {!hasSelectedStop && (
        <Pressable onPress={onToggleNearest} style={styles.nearestFab}>
          <Ionicons name="walk-outline" size={20} color="#fff" />
          {hasLocation && nearestCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{nearestCount}</Text>
            </View>
          )}
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  recenter: {
    position: "absolute",
    top: 195,
    right: 15,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  searchFab: {
    position: "absolute",
    top: 246,
    right: 15,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  navBanner: {
    position: "absolute",
    top: 96,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  navBannerText: { color: BLACK, flexShrink: 1 },
  arrivalPill: {
    position: "absolute",
    top: 60,
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FED7AA",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nearestFab: {
    position: "absolute",
    left: 16,
    bottom: 80,
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // ── JOURNEY UI STYLES ──
  journeyCard: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  journeyCardTitle: { fontSize: 18, fontWeight: "700", color: BLACK },
  journeyCardSub: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  journeyCloseBtn: {
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
  },
  bottomActionContainer: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  startTripBtn: {
    backgroundColor: ORANGE,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  stopTripBtn: {
    backgroundColor: "#EF4444", // Red for ending trip
    shadowColor: "#EF4444",
  },
  startTripText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
});
