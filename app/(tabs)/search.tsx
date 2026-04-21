// app/(tabs)/search.tsx
import { Route, routes as routesData } from "@/data/routes";
import { stops as allStops } from "@/data/stops";
import { useStopSearch } from "@/hooks/useStopSearch";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
import { Highlight } from "@/ui/Highlight";

import { dMeters } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  background: "#FFFFFF",
  card: "#F2F2F7",
  text: "#000000",
  subtext: "#8E8E93",
  border: "#E5E5EA",
  primary: "#FF6F00",
  blue: "#007AFF",
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

type Field = "from" | "to";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fromQ, setFromQ] = useState("");
  const [toQ, setToQ] = useState("");

  // Swapped from Stop to UnifiedLocation to handle both bus stops and Geocoded addresses
  const [fromLoc, setFromLoc] = useState<UnifiedLocation | null>(null);
  const [toLoc, setToLoc] = useState<UnifiedLocation | null>(null);

  const setJourney = useJourneyStore((state) => state.setJourney);

  const [focusedField, setFocusedField] = useState<Field>("to");
  const toInputRef = useRef<TextInput>(null);

  const activeQuery = focusedField === "from" ? fromQ : toQ;
  const { matches, recents, pushRecent } = useStopSearch(activeQuery, null);

  // ── API & ANIMATION STATE ──
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);

  // Trigger animation & simulated API call when both points are selected
  useEffect(() => {
    if (fromLoc && toLoc) {
      // 1. Slide the sheet up immediately
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();

      // 2. Show loading spinner
      setIsFetchingRoutes(true);

      // 3. Process Spatial Fallback & Intersection (Debounced slightly for UI smoothness)
      const fetchTimer = setTimeout(() => {
        // Helper: Extract route IDs. If it's a mapbox address, find nearby stops physically.
        const extractRouteIds = (loc: UnifiedLocation) => {
          if (loc._type === "stop" && loc.route_ids) {
            return loc.route_ids.split(",").map((id: string) => id.trim());
          }

          // Spatial Fallback for Addresses
          const nearbyStops = allStops.filter((s) => {
            const dist = dMeters(
              { latitude: loc.lat, longitude: loc.lng },
              { latitude: s.lat, longitude: s.lng },
            );
            return dist <= 600; // 600 meters max walking distance to a stop
          });

          const nearbyRouteIds = new Set<string>();
          nearbyStops.forEach((s) => {
            if (s.route_ids) {
              s.route_ids
                .split(",")
                .forEach((id) => nearbyRouteIds.add(id.trim()));
            }
          });
          return Array.from(nearbyRouteIds);
        };

        const fromIds = extractRouteIds(fromLoc);
        const toIds = extractRouteIds(toLoc);

        // Find intersecting routes
        const commonIds = fromIds.filter(
          (id) => toIds.includes(id) && id !== "",
        );

        const matchedRoutes = commonIds
          .map((id) => routesData.find((r) => r.route_id === id))
          .filter((r): r is Route => r !== undefined);

        // Deduplicate routes
        const uniqueRoutes = Array.from(
          new Map(matchedRoutes.map((r) => [r.route_id, r])).values(),
        );

        setAvailableRoutes(uniqueRoutes);
        setIsFetchingRoutes(false);
      }, 400);

      return () => clearTimeout(fetchTimer);
    } else {
      Animated.timing(sheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setAvailableRoutes([]);
    }
  }, [fromLoc, toLoc, sheetAnim]);

  // ── SEARCH SUGGESTIONS ──
  const data = useMemo(() => {
    const rows: any[] = [];
    if (!activeQuery && recents.length > 0) {
      rows.push({ _type: "header", title: "Recent", key: "hdr-recent" });
      for (const r of recents)
        rows.push({ _type: "recent", location: r, key: `recent-${r.id}` });
    }

    if (matches.length > 0) {
      rows.push({
        _type: "header",
        title: activeQuery ? "Results" : "Suggestions",
        key: "hdr-results",
      });
      for (const m of matches) {
        const nameMatch = m.item.name; // In a full implementation, you'd remap fuse indices here
        rows.push({
          _type: "result",
          location: m.item,
          nameRanges: [], // Provide ranges here if using Fuse highlight mapping
          key: `res-${m.item.id}`,
        });
      }
    } else if (activeQuery) {
      rows.push({
        _type: "header",
        title: "No places found",
        key: "hdr-empty",
      });
    }
    return rows;
  }, [activeQuery, matches, recents]);

  function onSelectLocation(loc: UnifiedLocation) {
    pushRecent(loc);

    if (focusedField === "from") {
      setFromLoc(loc);
      setFromQ(loc.name);
      if (!toLoc) {
        setFocusedField("to");
        toInputRef.current?.focus();
      }
    } else {
      setToLoc(loc);
      setToQ(loc.name);
    }
  }

  function onSelectRoute(route: Route) {
    if (fromLoc && toLoc) {
      setJourney(fromLoc, toLoc, route);
      router.replace("/map"); // or router.navigate('/') depending on your routing setup
    }
  }

  function swapFields() {
    const tempQ = fromQ;
    setFromQ(toQ);
    setToQ(tempQ);

    const tempLoc = fromLoc;
    setFromLoc(toLoc);
    setToLoc(tempLoc);
  }

  const HeaderBar = (
    <View
      style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) }]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={15}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Plan Route</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.routeCard}>
        <View style={styles.timeline}>
          <View style={styles.dotFrom} />
          <View style={styles.line} />
          <View style={styles.squareTo} />
        </View>

        <View style={styles.inputStack}>
          <View style={styles.inputWrapper}>
            <TextInput
              value={fromQ}
              onChangeText={(txt) => {
                setFromQ(txt);
                setFromLoc(null);
              }}
              onFocus={() => setFocusedField("from")}
              placeholder="Current Location"
              placeholderTextColor={COLORS.blue}
              style={[
                styles.input,
                focusedField === "from" && styles.inputFocused,
              ]}
              returnKeyType="next"
              onSubmitEditing={() => toInputRef.current?.focus()}
            />
            {fromQ.length > 0 && focusedField === "from" && (
              <Pressable
                onPress={() => {
                  setFromQ("");
                  setFromLoc(null);
                }}
                hitSlop={10}
                style={styles.clearBtn}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={COLORS.subtext}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.inputWrapper}>
            <TextInput
              ref={toInputRef}
              autoFocus
              value={toQ}
              onChangeText={(txt) => {
                setToQ(txt);
                setToLoc(null);
              }}
              onFocus={() => setFocusedField("to")}
              placeholder="Where to?"
              placeholderTextColor={COLORS.subtext}
              style={[
                styles.input,
                focusedField === "to" && styles.inputFocused,
              ]}
              returnKeyType="search"
            />
            {toQ.length > 0 && focusedField === "to" && (
              <Pressable
                onPress={() => {
                  setToQ("");
                  setToLoc(null);
                }}
                hitSlop={10}
                style={styles.clearBtn}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={COLORS.subtext}
                />
              </Pressable>
            )}
          </View>
        </View>

        <Pressable onPress={swapFields} style={styles.swapBtn} hitSlop={10}>
          <Ionicons name="swap-vertical" size={20} color={COLORS.subtext} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {HeaderBar}

      {/* ── BACKGROUND SEARCH LIST ── */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item._type === "header") {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }

          const loc = item.location as UnifiedLocation;

          // Differentiate icons based on type!
          let IconName: any = "location-outline";
          if (item._type === "recent") IconName = "time-outline";
          else if (loc._type === "stop") IconName = "bus-outline";

          return (
            <Pressable
              onPress={() => onSelectLocation(loc)}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.iconContainer}>
                <Ionicons name={IconName} size={20} color={COLORS.text} />
              </View>
              <View style={styles.rowContent}>
                {item.nameRanges && item.nameRanges.length > 0 ? (
                  <Highlight
                    text={loc.name}
                    ranges={item.nameRanges.map((indices: any) => ({
                      indices,
                    }))}
                  />
                ) : (
                  <Text style={styles.rowText} numberOfLines={1}>
                    {loc.name}
                  </Text>
                )}
                {/* Optional Subtext for addresses */}
                {loc._type === "location" && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: COLORS.subtext,
                      marginTop: 2,
                    }}
                  >
                    Mapbox Address
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {/* ── ANIMATED BOTTOM SHEET FOR ROUTES ── */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: sheetAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Available Routes</Text>
        </View>

        {isFetchingRoutes ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.emptyStateSubtext, { marginTop: 16 }]}>
              Finding the best lines...
            </Text>
          </View>
        ) : availableRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bus-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyStateText}>No direct lines found.</Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your origin or destination.
            </Text>
          </View>
        ) : (
          <FlatList
            data={availableRoutes}
            keyExtractor={(item) => `route-${item.route_id}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            renderItem={({ item: route }) => (
              <Pressable
                onPress={() => onSelectRoute(route)}
                style={({ pressed }) => [
                  styles.routeCardItem,
                  pressed && styles.rowPressed,
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: COLORS.primary },
                  ]}
                >
                  <Ionicons name="bus" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.rowContent}>
                  <Text
                    style={[styles.rowText, { fontWeight: "700" }]}
                    numberOfLines={1}
                  >
                    Line {route.route_short_name}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.subtext,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {route.route_long_name}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.border}
                />
              </Pressable>
            )}
          />
        )}
      </Animated.View>
    </View>
  );
}

// Ensure you keep your existing styles object at the bottom of the file!
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.background,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  backBtn: {
    marginLeft: -8,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 4,
    paddingRight: 8,
  },
  timeline: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  dotFrom: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.subtext,
  },
  line: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  squareTo: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.text,
  },
  inputStack: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 44,
    color: COLORS.text,
    fontSize: 16,
  },
  inputFocused: {},
  clearBtn: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 0,
  },
  swapBtn: {
    padding: 8,
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  sectionTitle: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginTop: 12,
  },
  rowText: {
    color: COLORS.text,
    fontSize: 16,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    height: SCREEN_HEIGHT * 0.6,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  routeCardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: COLORS.subtext,
    textAlign: "center",
    marginTop: 8,
  },
});
