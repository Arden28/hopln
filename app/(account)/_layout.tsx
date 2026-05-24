import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function AccountLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        animation:    "slide_from_right",
        contentStyle: { backgroundColor: dark ? "#0F0F0F" : "#F6F7F8" },
      }}
    />
  );
}
