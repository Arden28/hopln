import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const qc = new QueryClient();

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: "white" }} />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
