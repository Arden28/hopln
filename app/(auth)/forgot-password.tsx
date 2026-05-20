import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const codeRefs = useRef<(TextInput | null)[]>([]);

  const submitEmail = async () => {
    setError("");
    setLoading(true);
    try {
      await AuthService.forgotPassword(email);
      setInfo("A reset code was sent to your registered phone.");
      setStep("reset");
    } catch (e: any) {
      setError(e.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    const fullCode = code.join("");
    if (fullCode.length < 6) { setError("Enter all 6 digits."); return; }
    setLoading(true);
    try {
      const res = await AuthService.resetPassword(phone, fullCode, password);
      await setAuth(res.user, res.token);
      router.replace("/(tabs)/map");
    } catch (e: any) {
      setError(e.message || "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const onCodeChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) codeRefs.current[idx - 1]?.focus();
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
        <Pressable onPress={() => (step === "reset" ? setStep("email") : router.back())} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>

        <Text style={styles.title}>{step === "email" ? "Forgot password" : "Reset password"}</Text>
        <Text style={styles.subtitle}>
          {step === "email"
            ? "Enter your email and we'll send a reset code to your phone."
            : info || "Enter the code from your phone and choose a new password."}
        </Text>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        {step === "email" ? (
          <>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email address</Text>
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

            <Pressable style={[styles.primary, loading && { opacity: 0.6 }]} onPress={submitEmail} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Send reset code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Phone number (to confirm)</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+254712345678"
                placeholderTextColor="#555"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Verification code</Text>
              <View style={styles.codeRow}>
                {code.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { codeRefs.current[i] = r; }}
                    style={styles.codeBox}
                    value={digit}
                    onChangeText={(t) => onCodeChange(t, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.pwRow}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#555"
                  secureTextEntry={!showPw}
                />
                <Pressable onPress={() => setShowPw((v) => !v)} style={{ padding: 10 }}>
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color="#777" />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat password"
                placeholderTextColor="#555"
                secureTextEntry
              />
            </View>

            <Pressable style={[styles.primary, loading && { opacity: 0.6 }]} onPress={submitReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Reset password</Text>}
            </Pressable>
          </>
        )}
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
  codeRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  codeBox: {
    width: 44,
    height: 52,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 10,
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  primary: {
    backgroundColor: "#FF6F00",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
