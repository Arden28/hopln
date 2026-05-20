import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

export default function VerifyPhone() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuthStore();

  const params = useLocalSearchParams<{ phone: string; setupToken?: string }>();
  const phone = params.phone ?? "";
  const setupToken = params.setupToken;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);

  const codeRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const resend = async () => {
    setError("");
    setResending(true);
    try {
      await AuthService.sendOtp(phone);
      startCountdown();
    } catch (e: any) {
      setError(e.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const onCodeChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) {
      codeRefs.current[idx + 1]?.focus();
    }
    if (!digit && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
    // Auto-submit when last digit filled
    if (digit && idx === 5) {
      const fullCode = [...next].join("");
      if (fullCode.length === 6) verify(fullCode);
    }
  };

  const verify = async (fullCode?: string) => {
    const codeStr = fullCode ?? code.join("");
    if (codeStr.length < 6) { setError("Enter all 6 digits."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await AuthService.verifyOtp(phone, codeStr, setupToken);

      if ("token" in res) {
        await setAuth(res.user, res.token);
        router.replace("/(tabs)/map");
      } else {
        // email+password flow: phone verified, go to login
        router.replace("/(auth)/login");
      }
    } catch (e: any) {
      setError(e.message || "Verification failed.");
      setCode(["", "", "", "", "", ""]);
      codeRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone.length > 6
    ? phone.slice(0, 4) + "****" + phone.slice(-3)
    : phone;

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

        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait-outline" size={36} color="#FF6F00" />
        </View>

        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{" "}
          <Text style={{ color: "#FFF", fontWeight: "600" }}>{maskedPhone}</Text>
        </Text>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { codeRefs.current[i] = r; }}
              style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
              value={digit}
              onChangeText={(t) => onCodeChange(t, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        <Pressable
          style={[styles.primary, (loading || code.join("").length < 6) && { opacity: 0.5 }]}
          onPress={() => verify()}
          disabled={loading || code.join("").length < 6}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Verify</Text>}
        </Pressable>

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>Resend code in {countdown}s</Text>
          ) : (
            <Pressable onPress={resend} disabled={resending}>
              {resending
                ? <ActivityIndicator color="#FF6F00" size="small" />
                : <Text style={styles.resendLink}>Resend code</Text>
              }
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 16 },
  back: { marginBottom: 8 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,111,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  title: { fontSize: 28, fontWeight: "800", color: "#FFF" },
  subtitle: { fontSize: 15, color: "#888" },
  errorBanner: {
    backgroundColor: "rgba(220,53,69,0.15)",
    color: "#FF6B6B",
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  codeRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 8 },
  codeBox: {
    width: 44,
    height: 56,
    backgroundColor: "#1A1A1A",
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
    borderRadius: 12,
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  codeBoxFilled: { borderColor: "#FF6F00" },
  primary: {
    backgroundColor: "#FF6F00",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  resendRow: { alignItems: "center", marginTop: 4 },
  countdownText: { color: "#666", fontSize: 14 },
  resendLink: { color: "#FF6F00", fontSize: 14, fontWeight: "600" },
});
