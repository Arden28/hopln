export const palette = {
  bg: "#F7F7F8",
  card: "#FFFFFF",
  text: "#0A0A0A",
  sub: "#6B7280",
  line: "#E5E7EB",
  primary: "#111827", // near-black, Apple vibe
  tint: "#2F7AFE",    // subtle blue accent
  success: "#16A34A",
  danger: "#DC2626",
};

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
};
