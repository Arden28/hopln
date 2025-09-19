import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";

const ORANGE = "#FF6F00";

export function LogoTitle() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/home")}
      hitSlop={12}
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <Image source={require("@/assets/images/logo.png")} style={{ width: 100, height: 30 }} />
    </Pressable>
  );
}

export function AvatarButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/profile")}
      hitSlop={12}
      style={{ width: 45, height: 45, borderRadius: 999, overflow: "hidden", marginBlockEnd: 4, marginRight: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Image
        source={require("@/assets/images/avatar.png")} // placeholder; swap to your user photo later
        style={{ width: 45, height: 45, borderRadius: 999 }}
        // contentFit="cover"
      />
    </Pressable>
  );
}
