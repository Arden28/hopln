import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthService } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await AuthService.login(email, password);

      if ("needs_phone_verification" in res) {
        router.push({ pathname: "/(auth)/verify-phone", params: { phone: res.phone } });
        return;
      }

      await setAuth(res.user, res.token);
      router.replace("/(tabs)/map");
    } catch (e: any) {
      setError(e.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0A0A0A" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue navigating Nairobi.</Text>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor="#555"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Password</Text>
            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
          <View style={styles.pwRow}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#555"
              secureTextEntry={!showPw}
            />
            <Pressable onPress={() => setShowPw((v) => !v)} style={{ padding: 10 }}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color="#777" />
            </Pressable>
          </View>
        </View>

        <Pressable style={[styles.primary, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Sign in</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/register")}>
            <Text style={styles.link}>Create one</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 16 },
  back: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFF" },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 8 },
  errorBanner: {
    backgroundColor: "rgba(220,53,69,0.15)",
    color: "#FF6B6B",
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  fieldWrap: { gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#AAA", fontSize: 13 },
  input: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFF",
    fontSize: 15,
  },
  pwRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 12,
  },
  primary: {
    backgroundColor: "#FF6F00",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  footerText: { color: "#888", fontSize: 14 },
  link: { color: "#FF6F00", fontSize: 14, fontWeight: "600" },
});
