import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { useNetworkStore } from "@/store/networkStore";
import { registerLocationTask } from "@/tasks/locationTask";

// Register background location task at module-eval time — before any component mounts.
registerLocationTask();

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5 * 60 * 1000,  // 5 min before background refresh
      gcTime:              30 * 60 * 1000,  // 30 min in cache after unmount
      retry:                1,
      refetchOnWindowFocus: false,           // not applicable in React Native
      refetchOnReconnect:   true,
    },
  },
});

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const setOnline = useNetworkStore((s) => s.setOnline);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? true);
    });
    return unsub;
  }, [setOnline]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#0A0A0A" }} />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(account)" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="kwame" options={{ animation: "slide_from_bottom", gestureEnabled: true }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
