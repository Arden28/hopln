// components/app/JourneyDetailsSheet.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator
} from "react-native";

const ORANGE = "#FF6F00";
const BLUE = "#007AFF";      // iOS System Blue
const GREEN = "#34C759";     // iOS System Green
const RED = "#FF3B30";       // iOS System Red
const BLACK = "#1C1C1E";     // iOS Primary Text
const GREY = "#8E8E93";      // iOS Secondary Text
const LIGHT_GREY = "#F2F2F7"; // iOS Grouped Background
const BG = "#FFFFFF";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_Y = SCREEN_HEIGHT * 0.15; // Expanded state (Top of screen)
const MIN_Y = SCREEN_HEIGHT - 290;  // Collapsed state (Bottom of screen)

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

export default function JourneyDetailsSheet({
  activeJourney,
  routeLoading,
  routeInfo,
  navigating,
  onToggleNav,
  onClose,
  mToNice,
  sToMin,
  children,
}: JourneyDetailsSheetProps): React.JSX.Element | null {
  
  // Animation value controls the Y position of the entire sheet
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const lastY = useRef(MIN_Y);

  // ── DRAG GESTURE LOGIC ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        let newY = lastY.current + gestureState.dy;
        if (newY < MAX_Y) newY = MAX_Y; // Prevent dragging too high
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.vy < -0.5 || gestureState.dy < -40) {
          // Swift swipe up -> Expand
          expandSheet();
        } else if (gestureState.vy > 0.5 || gestureState.dy > 40) {
          // Swift swipe down -> Collapse
          collapseSheet();
        } else {
          // Slow drag -> snap to closest detent
          if (lastY.current === MAX_Y) expandSheet();
          else collapseSheet();
        }
      }
    })
  ).current;

  const expandSheet = () => {
    Animated.spring(translateY, { toValue: MAX_Y, useNativeDriver: true, damping: 24, stiffness: 200 }).start();
    lastY.current = MAX_Y;
  };

  const collapseSheet = () => {
    Animated.spring(translateY, { toValue: MIN_Y, useNativeDriver: true, damping: 24, stiffness: 200 }).start();
    lastY.current = MIN_Y;
  };

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  // Slide up to collapsed state on mount
  useEffect(() => {
    if (activeJourney) collapseSheet();
  }, [activeJourney]);

  if (!activeJourney) return null;
  const isTransfer = activeJourney.route.type === "transfer";

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          height: SCREEN_HEIGHT - MAX_Y, // Fills the space when expanded
          transform: [{ translateY }],
        },
      ]}
    >
      {/* ── DRAG ZONE (Header & Context) ── */}
      <View {...panResponder.panHandlers} style={styles.dragZone}>
        
        {/* Grab Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: isTransfer ? `${BLUE}15` : `${ORANGE}15` }]}>
              <Text style={[styles.badgeText, { color: isTransfer ? BLUE : ORANGE }]}>
                {isTransfer ? "Transfer" : "Direct"}
              </Text>
            </View>
            <Text style={styles.summaryText} numberOfLines={1}>
              {activeJourney.route.summary}
            </Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={20} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={GREY} />
          </Pressable>
        </View>

        {/* Context Row (ETA & Dist) */}
        <View style={styles.contextContainer}>
          {routeLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={ORANGE} />
              <Text style={styles.loadingText}>Finding optimal route...</Text>
            </View>
          ) : (
            <View style={styles.etaContainer}>
              <Text style={styles.etaText}>
                {routeInfo ? sToMin(routeInfo.duration).replace('~', '') : "--"}
              </Text>
              <View style={styles.etaSubTextContainer}>
                <Text style={styles.distanceText}>
                  {routeInfo ? mToNice(routeInfo.distance) : "--"}
                </Text>
                <Text style={styles.destinationText} numberOfLines={1}>
                  to {activeJourney.toLoc.name}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: navigating ? RED : ORANGE },
              pressed && { opacity: 0.85 }
            ]}
            onPress={() => onToggleNav(!navigating)}
          >
            <Ionicons 
              name={navigating ? "close-circle" : "navigate"} 
              size={18} 
              color="#FFFFFF" 
              style={{ marginRight: 6 }} 
            />
            <Text style={styles.primaryBtnText}>
              {navigating ? "End Navigation" : "Start Journey"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => {
              // TODO: Implement Add to Favorites logic
              console.log("Add to favorites");
            }}
          >
            <Ionicons name="bookmark-outline" size={24} color={BLACK} />
          </Pressable>
        </View>

        <View style={styles.divider} />
      </View>

      {/* ── SCROLL ZONE (Steps) ── */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // Prevents the ScrollView from fighting with the PanResponder
        bounces={false} 
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 20,
  },
  dragZone: {
    backgroundColor: 'transparent',
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 16,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D1D6",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
    paddingRight: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryText: {
    color: GREY,
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  closeButton: {
    backgroundColor: LIGHT_GREY,
    borderRadius: 16,
    padding: 6,
  },
  contextContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 16,
    color: GREY,
    fontWeight: "500",
  },
  etaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  etaText: {
    fontSize: 24,
    fontWeight: "600", // Elegant bold, not heavy
    color: BLACK,
    letterSpacing: -0.5,
  },
  etaSubTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  distanceText: {
    fontSize: 15,
    fontWeight: "500",
    color: GREY,
  },
  destinationText: {
    fontSize: 16,
    color: BLACK,
    fontWeight: "600",
    marginTop: 2,
  },
actionRow: {
    flexDirection: "row", // Places items side-by-side
    alignItems: "center",
    gap: 12, // Space between the buttons
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  primaryBtn: {
    flex: 1, // Tells the Start button to stretch and take up remaining space
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryBtn: {
    width: 54, // Matches the height of the primary button
    height: 54,
    borderRadius: 16,
    backgroundColor: LIGHT_GREY, // Uses the Apple grouped background color
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
});