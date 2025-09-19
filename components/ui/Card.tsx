import { View, ViewProps } from "react-native";
import { palette, radius, shadow } from "../../lib/theme";

export default function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: palette.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: "#EFEFEF",
          ...shadow.card,
        },
        style,
      ]}
    />
  );
}
