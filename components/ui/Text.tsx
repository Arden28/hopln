import { Text as RNText, TextProps } from "react-native";
import { palette } from "../../lib/theme";

export function H1(props: TextProps) {
  return <RNText {...props} style={[{ fontSize: 32, fontWeight: "700", color: palette.text }, props.style]} />;
}
export function H2(props: TextProps) {
  return <RNText {...props} style={[{ fontSize: 20, fontWeight: "700", color: palette.text }, props.style]} />;
}
export function P(props: TextProps) {
  return <RNText {...props} style={[{ fontSize: 16, color: palette.text }, props.style]} />;
}
export function Sub(props: TextProps) {
  return <RNText {...props} style={[{ fontSize: 13, color: palette.sub }, props.style]} />;
}
