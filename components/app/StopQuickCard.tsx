// components/app/StopQuickCard.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";
const BLACK  = "#1C1C1E";
const GREY   = "#8E8E93";
const WHITE  = "#FFFFFF";
const LIGHT  = "#F2F2F7";
const BORDER = "#E5E5EA";

type Stop = { id: string; name: string; lat: number; lng: number; route_nams?: string | null };

interface Props {
  stop: Stop;
  onClose: () => void;
  onGoToStop: () => void;
  onViewDetails: () => void;
  loading?: boolean;
}

function parseRoutes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((r) => r.trim()).filter(Boolean).slice(0, 6);
}

export default function StopQuickCard({ stop, onClose, onGoToStop, onViewDetails, loading = false }: Props) {
  const insets     = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: 160, duration: 220, useNativeDriver: true,
    }).start(onClose);
  };

  const routes = parseRoutes(stop.route_nams);
  const lat    = stop.lat.toFixed(5);
  const lng    = stop.lng.toFixed(5);

  return (
    <Animated.View
      style={[
        s.card,
        { bottom: (insets.bottom || 0) + 12 },
        { transform: [{ translateY }] },
      ]}
    >
      {/* Header row */}
      <View style={s.header}>
        <View style={s.iconBox}>
          <Ionicons name="bus" size={18} color={ORANGE} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={2}>{stop.name}</Text>
          <Text style={s.coords}>{lat}, {lng}</Text>
        </View>

        <Pressable onPress={handleClose} hitSlop={14} style={s.closeBtn}>
          <Ionicons name="close" size={15} color={GREY} />
        </Pressable>
      </View>

      {/* Route badges */}
      {routes.length > 0 && (
        <View style={s.badgesRow}>
          {routes.map((r) => (
            <View key={r} style={s.badge}>
              <Text style={s.badgeText}>{r}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Divider */}
      <View style={s.divider} />

      {/* Action buttons */}
      <View style={s.actions}>
        <Pressable
          style={({ pressed }) => [
            s.primaryBtn,
            { opacity: loading ? 0.75 : pressed ? 0.85 : 1 },
          ]}
          onPress={loading ? undefined : onGoToStop}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color={WHITE} />
              <Text style={s.primaryText}>Finding route…</Text>
            </>
          ) : (
            <>
              <Ionicons name="navigate" size={14} color={WHITE} />
              <Text style={s.primaryText}>Go to stop</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={onViewDetails}
        >
          <Text style={s.secondaryText}>View details</Text>
          <Ionicons name="chevron-forward" size={14} color={ORANGE} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: WHITE,
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: BLACK,
    lineHeight: 20,
  },
  coords: {
    fontSize: 12,
    color: GREY,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: BLACK,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginBottom: 12,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: ORANGE,
    borderRadius: 99,
    paddingVertical: 13,
  },
  primaryText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  secondaryText: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: "600",
  },
});
