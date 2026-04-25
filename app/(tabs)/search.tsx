// app/(tabs)/search.tsx
import { useStopSearch } from "@/hooks/useStopSearch";
import { RouteService,  type Route } from "@/services/route";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
import { Highlight } from "@/ui/Highlight";
import * as Location from "expo-location";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


import {
  getRouteColor,
} from "@/utils/mapHelpers";

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

  const [currentLocation, setCurrentLocation] = useState<UnifiedLocation | null>(null);
  const [fromQ, setFromQ] = useState("");
  const [toQ, setToQ] = useState("");

  const [fromLoc, setFromLoc] = useState<UnifiedLocation | null>(null);
  const [toLoc, setToLoc] = useState<UnifiedLocation | null>(null);

  const setJourney = useJourneyStore((state) => state.setJourney);

  const [focusedField, setFocusedField] = useState<Field>("to");
  const toInputRef = useRef<TextInput>(null);

  const activeQuery = focusedField === "from" ? fromQ : toQ;
  const { matches, recents, pushRecent } = useStopSearch(activeQuery, null);

  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);

  // Get current GPS location once when screen opens
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          _type: "location",
          id: "current_location",
          name: "Current Location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      }
    })();
  }, []);

  // ── THE API HANDOFF ──
  useEffect(() => {
    if (fromLoc && toLoc) {
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();

      setIsFetchingRoutes(true);

      // Call the Laravel Backend!
      const fetchRoutes = async () => {
        try {
          const routes = await RouteService.calculateJourney(fromLoc, toLoc);
          setAvailableRoutes(routes);
        } catch (error) {
          console.error("Failed to fetch routes:", error);
          setAvailableRoutes([]);
        } finally {
          setIsFetchingRoutes(false);
        }
      };

      fetchRoutes();
    } else {
      Animated.timing(sheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setAvailableRoutes([]);
    }
  }, [fromLoc, toLoc, sheetAnim]);

  const data = useMemo(() => {
    const rows: any[] = [];

    if (focusedField === "from" && currentLocation) {
      rows.push({
        _type: "current-location",
        location: currentLocation,
        key: "current-location",
      });
    }

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
        rows.push({
          _type: "result",
          location: m.item,
          nameRanges: [],
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
      router.replace("/map");
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

      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {

          if (item._type === "current-location") {
            return (
              <Pressable
                onPress={() => onSelectLocation(item.location)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconContainer, { backgroundColor: COLORS.blue }]}>
                  <Ionicons name="locate" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowText} numberOfLines={1}>
                    {item.location.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.subtext, marginTop: 2 }}>
                    Use my current location
                  </Text>
                </View>
              </Pressable>
            );
          }

          if (item._type === "header") {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }

          const loc = item.location as UnifiedLocation;
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

                {/* ── Badge Design for Serving Lines ── */}
                {loc._type === "stop" && loc.route_nams && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ fontSize: 12, color: COLORS.subtext, marginRight: 6, fontWeight: "500" }}>
                      Serves
                    </Text>
                    {/* Horizontal scroll prevents the row from getting too tall if there are 10+ lines */}
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      contentContainerStyle={{ alignItems: 'center' }}
                      pointerEvents="none" 
                    >
                      {loc.route_nams.split(',').map((routeName, index) => {
                        const cleanName = routeName.trim();
                        const badgeColor = getRouteColor(cleanName); // <-- Grab the dynamic color!

                        return (
                          <View
                            key={index}
                            style={{
                              backgroundColor: `${badgeColor}15`, // 15% opacity of the line color
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              marginRight: 6,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: `${badgeColor}30`, // 30% opacity for the border
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: badgeColor, // Full opacity for the text
                              }}
                            >
                              {cleanName}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

              </View>
            </Pressable>
          );
        }}
      />

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
            keyExtractor={(item, index) => `route-${index}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            renderItem={({ item: route }) => {
              
              // Build a dynamic title based on the segments ──
              const title = route.type === 'transfer' && route.segments.length > 1
                ? `Line ${route.segments[0]?.route_name} ➔ ${route.segments[1]?.route_name}`
                : `Line ${route.segments[0]?.route_name}`;

              return (
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
                      { backgroundColor: route.type === 'transfer' ? COLORS.blue : COLORS.primary },
                    ]}
                  >
                    <Ionicons 
                      name={route.type === 'transfer' ? "git-network-outline" : "bus"} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                  </View>
                  <View style={styles.rowContent}>
                    
                    {/* Display the dynamic line numbers here */}
                    <Text
                      style={[styles.rowText, { fontWeight: "700" }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    
                    {/* Keep the summary text underneath for extra context */}
                    <Text
                      style={{
                        color: COLORS.subtext,
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {route.summary}
                    </Text>
                    
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.border}
                  />
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  headerTitle: { fontSize: 17, fontWeight: "600", color: COLORS.text },
  backBtn: { marginLeft: -8 },
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
  squareTo: { width: 8, height: 8, backgroundColor: COLORS.text },
  inputStack: { flex: 1 },
  inputWrapper: { flexDirection: "row", alignItems: "center" },
  input: { flex: 1, height: 44, color: COLORS.text, fontSize: 16 },
  inputFocused: {},
  clearBtn: { padding: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 0 },
  swapBtn: { padding: 8, marginLeft: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  sectionTitle: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowPressed: { opacity: 0.5 },
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
  rowText: { color: COLORS.text, fontSize: 16 },
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
  sheetTitle: { fontSize: 20, fontWeight: "700", color: COLORS.text },
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
