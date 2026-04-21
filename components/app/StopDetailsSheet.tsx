import { Ionicons } from "@expo/vector-icons";
import { JSX, ReactNode } from "react";
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const ORANGE = "#FF6F00";
const BLACK = "#000000";
const BG = "#F6F7F8";
const PANEL_MAX_H = Math.round(Dimensions.get("window").height * 0.6);

interface StopDetailsSheetProps {
  selected: any;
  routeLoading: boolean;
  routeInfo: any;
  navigating: boolean;
  onToggleNav: (start: boolean) => void;
  onClose: () => void;
  mToNice: (m: number) => string;
  sToMin: (s: number) => string;
  // Passing the rest as children for the steps list to keep it flexible,
  // or you can port the step mapping logic in here!
  children?: ReactNode;
}

export default function StopDetailsSheet({
  selected,
  routeLoading,
  routeInfo,
  navigating,
  onToggleNav,
  onClose,
  mToNice,
  sToMin,
  children,
}: StopDetailsSheetProps): JSX.Element | null {
  if (!selected) return null;

  return (
    <View style={[styles.panel, { maxHeight: PANEL_MAX_H }]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.panelTitle}>{selected.name}</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close-outline" size={22} color={BLACK} />
        </Pressable>
      </View>

      {routeLoading ? (
        <Text style={styles.sub}>Fetching walking route…</Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 12, paddingTop: 4 }}>
          <View style={styles.row}>
            <Ionicons name="walk-outline" size={16} color={BLACK} />
            <Text style={styles.rowText}>
              {routeInfo
                ? `${mToNice(routeInfo.distance)} • ${sToMin(routeInfo.duration)}`
                : "Approximate path shown"}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.pill, { backgroundColor: ORANGE }]}
              onPress={() => onToggleNav(!navigating)}
            >
              <Text style={styles.pillTextLight}>
                {navigating ? "Stop" : "Start"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pill, styles.pillOutline]}
              onPress={onClose}
            >
              <Text style={styles.pillTextDark}>Close</Text>
            </Pressable>
          </View>

          {/* Render the Steps List here */}
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: BG,
    borderRadius: 14,
    padding: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  panelTitle: { color: BLACK, fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowText: { color: BLACK },
  actions: { marginTop: 2, flexDirection: "row", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  pillOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pillTextLight: { color: "#FFFFFF", fontWeight: "700" },
  pillTextDark: { color: BLACK, fontWeight: "700" },
  sub: { color: "#6B7280", textAlign: "left" },
});
