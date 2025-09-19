import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const BLACK = "#000";
const ORANGE = "#FF6F00";
const HAIRLINE = "#E5E7EB";

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color={BLACK} />
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      </View>
      <View style={styles.rowRight}>
        {typeof value === "string" ? (
          <ThemedText style={styles.rowValue}>{value}</ThemedText>
        ) : (
          value
        )}
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </View>
    </Pressable>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pill}>
      <ThemedText style={styles.pillText}>{children}</ThemedText>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top bar (flat) */}
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={BLACK} />
          <ThemedText style={styles.backText}>Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.topbarTitle}>Profile</ThemedText>
        <View style={{ width: 44 }} />{/* spacer to balance back area */}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("@/assets/images/avatar.png")}
          style={styles.avatar}
          contentFit="cover"
        />
        <View style={{ gap: 4 }}>
          <ThemedText type="title" style={{ fontSize: 22, color: BLACK }}>
            Brian Mwangi
          </ThemedText>
          <ThemedText style={{ opacity: 0.7 }}>brianmwangi@email.com</ThemedText>
        </View>
      </View>

      {/* Movement preferences — aligned to Safiri’s goal */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Travel preferences
        </ThemedText>

        <Row icon="navigate-outline" label="Preferred map app" value="System default" />
        <View style={styles.sep} />
        <Row icon="walk-outline" label="Stage hints" value="Concise" />
        <View style={styles.sep} />
        <Row icon="analytics-outline" label="Units" value="Kilometers" />
      </ThemedView>

      {/* Saved places — quick access to common boarding targets */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Saved places
        </ThemedText>

        <Row icon="home-outline" label="Home" value="Add" onPress={() => {}} />
        <View style={styles.sep} />
        <Row icon="briefcase-outline" label="Work" value="Add" onPress={() => {}} />
        <View style={styles.sep} />
        <Row icon="star-outline" label="Favorites" value={<Pill>0</Pill>} onPress={() => {}} />
      </ThemedView>

      {/* Community — contributions fit Safiri’s community-driven mapping */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Community
        </ThemedText>

        <Row icon="add-circle-outline" label="Your submissions" value={<Pill>0</Pill>} onPress={() => {}} />
        <View style={styles.sep} />
        <Row icon="trophy-outline" label="Safiri Points" value={<Pill>0</Pill>} onPress={() => {}} />
      </ThemedView>

      {/* Account */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Account
        </ThemedText>

        <Row icon="person-outline" label="Profile details" onPress={() => {}} />
        <View style={styles.sep} />
        <Row icon="notifications-outline" label="Notifications" onPress={() => {}} />
        <View style={styles.sep} />
        <Row icon="shield-checkmark-outline" label="Privacy & security" onPress={() => {}} />
      </ThemedView>

      {/* Footer actions */}
      <View style={{ gap: 10 }}>
        <Pressable
          onPress={() => {}}
          style={styles.linkBtn}
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={18} color={BLACK} />
          <ThemedText style={styles.linkText}>Terms & Privacy</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {}}
          style={styles.linkBtn}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={18} color={BLACK} />
          <ThemedText style={styles.linkText}>Sign out</ThemedText>
        </Pressable>
        <ThemedText style={styles.version}>v0.1.0</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 14,
    gap: 24,
    backgroundColor: "#F6F7F8", // neutral, not white
  },

  /* Top bar */
  topbar: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: BLACK, fontSize: 16 },
  topbarTitle: { color: BLACK, fontSize: 16, fontWeight: "600" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
  },

  /* Sections */
  section: {
    padding: 6,
    borderRadius: 10,
    gap: 0,
  },
  sectionTitle: {
    fontWeight: "600",
    color: BLACK,
    marginBottom: 10,
  },
  sep: {
    height: 1,
    backgroundColor: HAIRLINE,
    marginLeft: 28, // indented to align under icons
  },

  /* Rows */
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    color: BLACK,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    color: "#4B5563",
  },

  /* Pills */
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FFF3E0", // soft orange tint
  },
  pillText: {
    color: ORANGE,
    fontWeight: "700",
    fontSize: 12,
  },

  /* Footer links */
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  linkText: {
    color: BLACK,
    fontSize: 15,
  },
  version: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
  },
});
