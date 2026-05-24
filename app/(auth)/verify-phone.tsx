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
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthService } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

export default function VerifyPhone() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuthStore();
  const dark = useColorScheme() === "dark";

  const params = useLocalSearchParams<{ phone?: string; setupToken?: string }>();
  const phone = params.phone ?? "";
  const setupToken = params.setupToken;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);

  const codeRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const C = theme(dark);

  useEffect(() => {
    startCountdown();
    setTimeout(() => codeRefs.current[0]?.focus(), 400);
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
    if (!phone) return;
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
    if (digit && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) codeRefs.current[idx - 1]?.focus();
    if (digit && idx === 5) {
      const full = next.join("");
      if (full.length === 6) verify(full);
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
        router.replace("/(auth)/login" as any);
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
    ? phone.slice(0, 4) + " *** " + phone.slice(-3)
    : phone;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <View style={[styles.backBtn, { backgroundColor: C.inputBg }]}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </View>
        </Pressable>

        {/* Icon badge */}
        <View style={[styles.badge, { backgroundColor: C.accentBg }]}>
          <Ionicons name="phone-portrait-outline" size={28} color={C.accent} />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: C.text }]}>Verify your phone</Text>
          <Text style={[styles.subtitle, { color: C.textSub }]}>
            We sent a 6-digit code to{" "}
            <Text style={[styles.phoneText, { color: C.text }]}>{maskedPhone}</Text>
          </Text>
        </View>

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: C.errBg, borderColor: C.errBd }]}>
            <Ionicons name="alert-circle-outline" size={16} color={C.errText} />
            <Text style={[styles.errorText, { color: C.errText }]}>{error}</Text>
          </View>
        )}

        {/* OTP input */}
        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { codeRefs.current[i] = r; }}
              style={[
                styles.codeBox,
                {
                  backgroundColor: C.inputBg,
                  borderColor: digit ? C.accent : C.inputBd,
                  color: C.text,
                },
              ]}
              value={digit}
              onChangeText={(t) => onCodeChange(t, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify button */}
        <Pressable
          style={[
            styles.primary,
            { backgroundColor: C.accent },
            (loading || code.join("").length < 6) && styles.btnDisabled,
          ]}
          onPress={() => verify()}
          disabled={loading || code.join("").length < 6}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryText}>Verify code</Text>
          )}
        </Pressable>

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={[styles.countdownText, { color: C.textSub }]}>
              Resend code in{" "}
              <Text style={{ color: C.accent, fontWeight: "600" }}>{countdown}s</Text>
            </Text>
          ) : (
            <Pressable onPress={resend} disabled={resending} style={styles.resendBtn}>
              {resending ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <Text style={[styles.resendText, { color: C.accent }]}>Resend code</Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function theme(dark: boolean) {
  return {
    bg:          dark ? "#0F0F0F" : "#FFFFFF",
    text:        dark ? "#F9FAFB" : "#111827",
    textSub:     dark ? "#9CA3AF" : "#6B7280",
    inputBg:     dark ? "#1C1C1E" : "#F3F4F6",
    inputBd:     dark ? "#2C2C2E" : "#E5E7EB",
    accent:      "#FF6F00",
    accentBg:    dark ? "rgba(255,111,0,0.12)" : "#FFF7ED",
    errBg:       dark ? "rgba(220,38,38,0.1)" : "#FEF2F2",
    errBd:       dark ? "rgba(220,38,38,0.2)" : "#FECACA",
    errText:     dark ? "#FF6B6B" : "#DC2626",
  };
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 24 },
  back: {},
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  header: { gap: 8 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  phoneText: { fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14 },
  codeRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  codeBox: {
    width: 46,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  primary: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  resendRow: { alignItems: "center" },
  resendBtn: { paddingVertical: 4 },
  countdownText: { fontSize: 14 },
  resendText: { fontSize: 14, fontWeight: "600" },
});
