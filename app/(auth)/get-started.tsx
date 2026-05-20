import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GetStarted() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={["#0A0A0A", "#1A1008", "#0A0A0A"]}
      style={styles.container}
    >
      {/* Subtle orange glow */}
      <View style={styles.glow} />

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
        {/* Logo + tagline */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Ionicons name="bus" size={40} color="#FF6F00" />
          </View>
          <Text style={styles.wordmark}>hopln</Text>
          <Text style={styles.tagline}>Navigate Nairobi,{"\n"}effortlessly.</Text>
        </View>

        {/* Feature chips */}
        <View style={styles.chips}>
          {["Real-time matatu routes", "SMS-verified accounts", "Offline-first maps"].map((label) => (
            <View key={label} style={styles.chip}>
              <Ionicons name="checkmark-circle" size={14} color="#FF6F00" />
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <Pressable
            style={styles.primary}
            onPress={() => router.push("/(auth)/register")}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={styles.ghost}
            onPress={() => router.push("/(auth)/login")}
            accessibilityRole="button"
          >
            <Text style={styles.ghostText}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow: {
    position: "absolute",
    top: "30%",
    alignSelf: "center",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#FF6F00",
    opacity: 0.06,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  hero: { alignItems: "center", gap: 12 },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,111,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 20,
    color: "#AAAAAA",
    textAlign: "center",
    lineHeight: 28,
  },
  chips: { gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipText: { color: "#DDDDDD", fontSize: 14 },
  ctas: { gap: 12 },
  primary: {
    backgroundColor: "#FF6F00",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  ghost: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  ghostText: { color: "#AAAAAA", fontSize: 15 },
});
