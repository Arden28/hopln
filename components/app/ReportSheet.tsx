// components/app/ReportSheet.tsx
import { useNavigation } from "@/hooks/useNavigation";
import { ReportCategory, ReportService } from "@/services/report";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";

interface ReportSheetProps {
  onClose: () => void;
}

const CATEGORIES: { id: ReportCategory; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: "stage_queue",   label: "Long Queue",   desc: "Unusually long wait times at the stage", icon: "people", color: "#FF9500" },
  { id: "accident",      label: "Accident",     desc: "Crash or collision blocking the route",  icon: "warning", color: "#FF3B30" },
  { id: "police_check",  label: "Police Check", desc: "NTSA or traffic police causing delays",  icon: "shield-half", color: "#007AFF" },
  { id: "flooded_route", label: "Flooded",      desc: "Impassable roads due to heavy rain",     icon: "water", color: "#5856D6" },
  { id: "fare_hike",     label: "Fare Hike",    desc: "Fares are significantly higher right now",icon: "trending-up", color: "#34C759" },
];

export default function ReportSheet({ onClose }: ReportSheetProps) {
  const dark = useColorScheme() === "dark";
  const { location: me } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (type: ReportCategory) => {
    if (!me) {
      Alert.alert("Location required", "We need your current location to drop a report.");
      return;
    }

    setIsSubmitting(true);
    try {
      await ReportService.createReport(me.latitude, me.longitude, type);
      Alert.alert("Report Submitted", "Thank you for helping keep the community moving!");
      onClose();
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#FF6F00" />
        <Text style={[styles.loadingText, { color: dark ? "#8E8E93" : "#6B7280" }]}>Posting report...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: dark ? "#FFFFFF" : "#1C1C1E" }]}>Report an Issue</Text>
        <Text style={[styles.subtitle, { color: dark ? "#8E8E93" : "#6B7280" }]}>
          Help improve the commute for everyone in Nairobi.
        </Text>
      </View>

      <View style={styles.list}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={({ pressed }) => [
              styles.row,
              { 
                backgroundColor: dark ? (pressed ? "#2C2C2E" : "transparent") : (pressed ? "#F9FAFB" : "transparent"),
                borderColor: dark ? "#2C2C2E" : "#F3F4F6",
              }
            ]}
            onPress={() => handleSubmit(cat.id)}
          >
            <View style={[styles.iconBox, { backgroundColor: cat.color + "1A" }]}>
              <Ionicons name={cat.icon} size={20} color={cat.color} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.label, { color: dark ? "#FFFFFF" : "#1C1C1E" }]}>{cat.label}</Text>
              <Text style={[styles.desc, { color: dark ? "#8E8E93" : "#6B7280" }]}>{cat.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={dark ? "#3A3A3C" : "#D1D5DB"} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
  },
  loadingState: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "500",
  },
});