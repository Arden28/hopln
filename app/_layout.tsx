import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const qc = new QueryClient();

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
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
