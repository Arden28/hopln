import { Redirect } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/store/authStore";

export default function Index() {
  const { isLoading, isAuthenticated, hasSeenOnboarding, initialize } = useAuthStore();

  useEffect(() => {
    // Wait for Zustand to finish rehydrating from AsyncStorage so that
    // cachedUser is available inside initialize() before we hit /auth/me.
    if (useAuthStore.persist.hasHydrated()) {
      initialize();
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => initialize());
      return unsub;
    }
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0A", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#FF6F00" size="large" />
      </View>
    );
  }

  if (isAuthenticated)    return <Redirect href="/(tabs)/map" />;
  if (!hasSeenOnboarding) return <Redirect href="/(auth)/get-started" />;
  return                         <Redirect href="/(tabs)/map" />;
}
