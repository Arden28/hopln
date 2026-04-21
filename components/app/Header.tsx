import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";

// Minimalist Text Title instead of an Image Logo
export function MinimalistTitle() {
  return (
    <View style={{ marginLeft: Platform.OS === "ios" ? 0 : 16 }}>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "800",
          color: "#1A1A1A",
          letterSpacing: -1.2, // Tight tracking for a modern, bold look
        }}
      >
        HopIn.
      </Text>
    </View>
  );
}

export function AvatarButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/profile")}
      hitSlop={15} // Slightly larger hitSlop for better UX
      style={({ pressed }) => ({
        marginRight: 16,
        opacity: pressed ? 0.7 : 1, // Visual feedback on press
        // Subtle drop shadow to make it float over the map
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      })}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Image
        source={require("@/assets/images/avatar.png")}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21, // Perfect circle
          backgroundColor: "#F3F4F6", // Neutral fallback
          borderWidth: 2,
          borderColor: "#FFFFFF", // Clean white ring around the avatar
        }}
        contentFit="cover"
        transition={200} // Smooth fade-in
      />
    </Pressable>
  );
}
