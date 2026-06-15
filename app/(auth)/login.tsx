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
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { AuthService } from "@/services/auth";
import { useAuthStore, type AuthUser } from "@/store/authStore";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuthStore();
  const dark = useColorScheme() === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const C = theme(dark);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await AuthService.login(email, password);
      // [PHONE VERIFICATION DISABLED] — restore block below to re-enable
      // if ("needs_phone_verification" in res) {
      //   router.push({ pathname: "/(auth)/verify-phone", params: { phone: res.phone } });
      //   return;
      // }
      await setAuth(res.user, res.token);
      router.replace("/(tabs)/map");
    } catch (e: any) {
      // [PHONE VERIFICATION DISABLED] — restore block below to re-enable
      // if (e.status === 403 && e.data?.needs_phone_verification) {
      //   router.push({ pathname: "/(auth)/verify-phone", params: { phone: e.data.phone } });
      //   return;
      // }
      setError(e.message || "Wrong email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSuccess = async (user: AuthUser, token: string) => {
    await setAuth(user, token);
    router.replace("/(tabs)/map");
  };

  const handleNeedsPhone = (setupToken: string) => {
    router.push({ pathname: "/(auth)/verify-phone", params: { setupToken } });
  };

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
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.back}>
          <View style={[styles.backBtn, { backgroundColor: C.inputBg }]}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </View>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: C.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: C.textSub }]}>
            Sign in to continue navigating Nairobi.
          </Text>
        </View>

        {/* Error */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: C.errBg, borderColor: C.errBd }]}>
            <Ionicons name="alert-circle-outline" size={16} color={C.errText} />
            <Text style={[styles.errorText, { color: C.errText }]}>{error}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            C={C}
          />

          <View style={styles.fieldWrap}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: C.textSub }]}>Password</Text>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={[styles.linkSmall, { color: C.accent }]}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={[styles.pwRow, { backgroundColor: C.inputBg, borderColor: C.inputBd }]}>
              <TextInput
                style={[styles.pwInput, { color: C.text }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={C.placeholder}
                secureTextEntry={!showPw}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPw ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={C.textSub}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Sign in */}
        <Pressable
          style={[styles.primary, { backgroundColor: C.accent }, loading && styles.btnDisabled]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryText}>Sign in</Text>
          )}
        </Pressable>

        {/* Social */}
        <SocialButtons
          onSuccess={handleSocialSuccess}
          onNeedsPhone={handleNeedsPhone}
          onError={setError}
          disabled={loading}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.textSub }]}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/register")}>
            <Text style={[styles.link, { color: C.accent }]}>Create one</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  C,
  ...props
}: { label: string; C: ReturnType<typeof theme> } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: C.textSub }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBd, color: C.text }]}
        placeholderTextColor={C.placeholder}
        {...props}
      />
    </View>
  );
}

function theme(dark: boolean) {
  return {
    bg:          dark ? "#0F0F0F" : "#FFFFFF",
    text:        dark ? "#F9FAFB" : "#111827",
    textSub:     dark ? "#9CA3AF" : "#6B7280",
    inputBg:     dark ? "#1C1C1E" : "#F3F4F6",
    inputBd:     dark ? "#2C2C2E" : "#E5E7EB",
    placeholder: dark ? "#4B5563" : "#9CA3AF",
    accent:      "#FF6F00",
    errBg:       dark ? "rgba(220,38,38,0.1)" : "#FEF2F2",
    errBd:       dark ? "rgba(220,38,38,0.2)" : "#FECACA",
    errText:     dark ? "#FF6B6B" : "#DC2626",
  };
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 20 },
  back: { marginBottom: 4 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  header: { gap: 6 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14 },
  form: { gap: 16 },
  fieldWrap: { gap: 8 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13, fontWeight: "500" },
  linkSmall: { fontSize: 13, fontWeight: "600" },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  pwRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingLeft: 16,
  },
  pwInput: { flex: 1, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14, height: "100%", justifyContent: "center" },
  primary: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.55 },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "600" },
});
