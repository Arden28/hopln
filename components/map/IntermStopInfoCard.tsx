import type { IntermediateStop } from "@/components/map/types";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface IntermStopInfoCardProps {
  stop:    IntermediateStop;
  onClose: () => void;
  dark:    boolean;
}

export function IntermStopInfoCard({ stop, onClose, dark }: IntermStopInfoCardProps) {
  const bg     = dark ? "#1C1C1E" : "#FFFFFF";
  const border = dark ? "#2C2C2E" : "#E5E5EA";
  const text   = dark ? "#FFFFFF" : "#111111";
  const sub    = dark ? "#8E8E93" : "#6B7280";

  return (
    <View style={[s.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={s.cardInner}>
        <View style={[s.chip, { backgroundColor: stop.color + "22", borderColor: stop.color + "66" }]}>
          <View style={[s.chipDot, { backgroundColor: stop.color }]} />
          <Text style={[s.chipText, { color: stop.color }]}>{stop.routeName}</Text>
        </View>
        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: sub }]}>Stop</Text>
            <Text style={[s.stopName, { color: text }]} numberOfLines={2}>{stop.name}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={[s.closeBtn, { backgroundColor: border }]}>
            <Text style={[s.closeX, { color: sub }]}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: "absolute", left: 16, right: 16, bottom: 260,
    borderRadius: 16, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  cardInner:  { padding: 16, gap: 10 },
  chip:       { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, gap: 6 },
  chipDot:    { width: 7, height: 7, borderRadius: 3.5 },
  chipText:   { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  nameRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  label:      { fontSize: 11, fontWeight: "500", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.4 },
  stopName:   { fontSize: 16, fontWeight: "700", lineHeight: 20 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  closeX:     { fontSize: 13, fontWeight: "600" },
});
