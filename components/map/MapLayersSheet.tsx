import { useMapLayersStore, type MapLayers } from "@/store/mapLayersStore";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Switch, Text, View } from "react-native";

const ORANGE  = "#FF6F00";
const TRAVEL  = 460; // off-screen translate distance for the slide animation

interface MapLayersSheetProps {
  visible:   boolean;
  onDismiss: () => void;
  dark:      boolean;
}

interface LayerDef {
  key:         keyof MapLayers | string;
  icon:        keyof typeof Ionicons.glyphMap;
  label:       string;
  description: string;
  active:      boolean; // false → "Soon" (not yet implemented)
}

// v1 ships Reports only; the rest are previewed as "Soon" so users see the roadmap.
const LAYER_DEFS: LayerDef[] = [
  { key: "reports",   icon: "megaphone-outline", label: "Live reports",  description: "Accidents, police checks, flooding & fare alerts", active: true  },
  { key: "coolSpots", icon: "sparkles-outline",  label: "Cool spots",    description: "Curated places around you",                       active: false },
  { key: "heatmap",   icon: "flame-outline",     label: "Stop density",  description: "Where matatu stages cluster",                     active: false },
  { key: "saved",     icon: "bookmark-outline",  label: "Saved places",  description: "Your home, work & favorites",                     active: false },
];

export function MapLayersSheet({ visible, onDismiss, dark }: MapLayersSheetProps) {
  const layers = useMapLayersStore((s) => s.layers);
  const toggle = useMapLayersStore((s) => s.toggle);

  // Keep the sheet mounted through its exit animation.
  const [mounted, setMounted] = useState(visible);
  const ty = useRef(new Animated.Value(TRAVEL)).current;
  const bg = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 240, mass: 0.9 }),
        Animated.timing(bg, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(ty, { toValue: TRAVEL, duration: 230, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(bg, { toValue: 0,      duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  if (!mounted) return null;

  const C = {
    card:      dark ? "#1C1C1E" : "#FFFFFF",
    text:      dark ? "#FFFFFF" : "#1C1C1E",
    sub:       dark ? "#8E8E93" : "#6B7280",
    hairline:  dark ? "#2C2C2E" : "#E5E7EB",
    switchOff: dark ? "#3A3A3C" : "#D1D5DB",
    soft:      dark ? "rgba(255,111,0,0.18)" : "#FFF3E0",
    pressed:   dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
  };

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      <Animated.View
        style={[s.card, { backgroundColor: C.card, transform: [{ translateY: ty }] }]}
      >
        <View style={s.handle} />

        <View style={s.titleRow}>
          <Text style={[s.title, { color: C.text }]}>Map layers</Text>
          <Pressable onPress={onDismiss} hitSlop={12} style={[s.closeBtn, { backgroundColor: dark ? "#2C2C2E" : "#F2F2F7" }]}>
            <Ionicons name="close" size={15} color={C.sub} />
          </Pressable>
        </View>

        {LAYER_DEFS.map((def, i) => {
          const isOn = def.active && !!layers[def.key as keyof MapLayers];
          const onToggle = () => { if (def.active) toggle(def.key as keyof MapLayers); };
          return (
            <View key={def.key}>
              {i > 0 && <View style={[s.sep, { backgroundColor: C.hairline }]} />}
              <Pressable
                onPress={onToggle}
                disabled={!def.active}
                style={({ pressed }) => [
                  s.row,
                  !def.active && { opacity: 0.55 },
                  pressed && def.active && { backgroundColor: C.pressed },
                ]}
              >
                <View style={[s.iconWrap, { backgroundColor: C.soft }]}>
                  <Ionicons name={def.icon} size={18} color={ORANGE} />
                </View>
                <View style={s.body}>
                  <View style={s.labelRow}>
                    <Text style={[s.label, { color: C.text }]}>{def.label}</Text>
                    {!def.active && (
                      <View style={[s.soonPill, { backgroundColor: C.soft }]}>
                        <Text style={s.soonText}>Soon</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.desc, { color: C.sub }]}>{def.description}</Text>
                </View>
                <Switch
                  value={isOn}
                  disabled={!def.active}
                  onValueChange={onToggle}
                  trackColor={{ false: C.switchOff, true: ORANGE }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={C.switchOff}
                />
              </Pressable>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 50 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    20,
    paddingTop:           12,
    paddingBottom:        36,
    shadowColor:          "#000",
    shadowOpacity:        0.2,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            20,
  },
  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
    backgroundColor: "#C7C7CC",
    alignSelf:    "center",
    marginBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title:    { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 52 },

  row: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              12,
    paddingVertical:  12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius:     14,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  body:     { flex: 1, gap: 2 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label:    { fontSize: 15, fontWeight: "600" },
  desc:     { fontSize: 12, lineHeight: 16 },

  soonPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  soonText: { color: ORANGE, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
});
