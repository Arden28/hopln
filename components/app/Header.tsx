import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";

// Minimalist Text Title
export function MinimalistTitle() {
  return (
    // Standardize the margin for both platforms
    <View style={{ marginLeft: 16 }}> 
      <Text
        style={{
          fontSize: 26, // Slightly larger to match the bold "HopIn." vibe
          fontWeight: "900", // "Black" weight for maximum impact
          color: "#000000",
          letterSpacing: -1.5, 
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
      hitSlop={15}
      style={({ pressed }) => ({
        marginRight: 16, // Matches the left margin
        opacity: pressed ? 0.7 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <View style={{
        // Using a View wrapper for shadow to keep the Image border clean
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <Image
          source={require("@/assets/images/avatar.png")}
          style={{
            width: 38, // Slightly smaller to keep the header compact
            height: 38,
            borderRadius: 19,
            backgroundColor: "#F3F4F6",
            borderWidth: 1, // Thinner border looks more "pro" on white
            borderColor: "#EFEFEF",
          }}
          contentFit="cover"
          transition={200}
        />
      </View>
    </Pressable>
  );
}