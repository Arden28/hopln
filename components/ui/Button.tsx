import { Pressable, PressableProps, Text } from "react-native";
import { palette, radius } from "../../lib/theme";

export default function Button({ style, children, ...rest }: PressableProps & { children?: React.ReactNode }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        {
          backgroundColor: palette.text,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: radius.xl,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>{children}</Text>
    </Pressable>
  );
}
