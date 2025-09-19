import React from "react";
import { Text } from "react-native";

export function Highlight({
  text,
  ranges,
}: {
  text: string;
  ranges: Array<{ indices: [number, number] }>;
}) {
  if (!ranges?.length) return <Text style={{ color: "#000" }}>{text}</Text>;

  const merged: Array<[number, number]> = [];
  const sorted = [...ranges].sort((a, b) => a.indices[0] - b.indices[0]);
  for (const r of sorted) {
    const [s, e] = r.indices;
    if (!merged.length) merged.push([s, e]);
    else {
      const last = merged[merged.length - 1];
      if (s <= last[1] + 1) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
  }

  const parts: React.ReactNode[] = [];
  let last = 0;
  merged.forEach(([start, end], i) => {
    if (start > last) parts.push(<Text key={`n${i}`} style={{ color: "#000" }}>{text.slice(last, start)}</Text>);
    parts.push(<Text key={`h${i}`} style={{ color: "#000", fontWeight: "700" }}>{text.slice(start, end + 1)}</Text>);
    last = end + 1;
  });
  if (last < text.length) parts.push(<Text key="tail" style={{ color: "#000" }}>{text.slice(last)}</Text>);
  return <Text numberOfLines={1}>{parts}</Text>;
}
