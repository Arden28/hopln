import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSearch } from "../../store/app";

const ORANGE = "#FF6F00"; // primary accent
const BLACK = "#000000";  // strong black

function PrimaryButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.cta,
        { backgroundColor: pressed ? "#E55F00" : ORANGE },
      ]}
    >
      <Ionicons name={icon} size={18} color="white" style={{ marginRight: 6 }} />
      <Text style={styles.ctaText}>{title}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { from, to, setFrom, setTo } = useSearch();
  const router = useRouter();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#FFF3E0", dark: "#4A2C00" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.headerImage}
        />
      }
    >
      {/* Title */}
      <ThemedView style={styles.section}>
        <ThemedText type="title" style={styles.title}>
          Hopln 🚍
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Get to the right stage, faster.
        </ThemedText>
      </ThemedView>

      {/* Intro */}
      <ThemedView style={styles.section}>
        <ThemedText style={styles.text}>
          Know exactly <Text style={styles.bold}>where to board</Text>. Clear stage
          directions and simple route hints, so you move with confidence across town.
        </ThemedText>
      </ThemedView>

      {/* Actions */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.subtitleStrong}>
          Get moving
        </ThemedText>

        <View style={styles.actions}>
          <PrimaryButton
            title="Open Map"
            icon="map-outline"
            onPress={() => router.push("/(tabs)/map")}
          />
          <PrimaryButton
            title="Find a Stage"
            icon="search-outline"
            onPress={() => router.push("/(tabs)/search")}
          />
        </View>

        <View style={styles.helperRow}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <ThemedText style={styles.helperText}>
            Tip: Search by place or landmark to see nearby stages.
          </ThemedText>
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
  section: {
    gap: 8,
  },
  title: {
    color: BLACK,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: BLACK,
    fontSize: 16,
    opacity: 0.7,
  },
  subtitleStrong: {
    color: BLACK,
    fontSize: 18,
    fontWeight: "600",
  },
  text: {
    color: BLACK,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    color: BLACK,
    fontWeight: "600",
  },
  actions: {
    marginTop: 12,
    flexDirection: "column",
    gap: 12,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 999,
  },
  ctaText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  helperRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  helperText: {
    fontSize: 13,
    color: "#4B5563",
  },
});
