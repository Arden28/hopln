import { TextInput, TextInputProps, View } from "react-native";
import { palette, radius } from "../../lib/theme";

export default function Input(props: TextInputProps) {
  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: "#ECECEC",
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <TextInput
        placeholderTextColor="#9CA3AF"
        style={{ fontSize: 16, color: palette.text }}
        {...props}
      />
    </View>
  );
}
