// app/(tabs)/search.tsx  (or app/search.tsx)
import type { Stop } from "@/data/stops";
import { useStopSearch } from "@/hooks/useStopSearch";
import { Highlight } from "@/ui/Highlight";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const ORANGE = "#FF6F00";
const BLACK = "#000000";
const BG = "#F6F7F8";

export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");

  // We don’t pass location (interface only) — the hook can still return recents + fuzzy matches
  const { matches, recents, pushRecent /*, clearRecents*/ } = useStopSearch(q, null);

  const data = useMemo(() => {
    // Build a flat list with section headers (Recent / Results) for FlatList
    const rows: Array<
      | { _type: "header"; title: string; key: string }
      | { _type: "recent"; stop: Stop; key: string }
      | { _type: "result"; stop: Stop; key: string; nameRanges?: [number, number][] }
    > = [];

    if (!q && recents.length > 0) {
      rows.push({ _type: "header", title: "Recent", key: "hdr-recent" });
      for (const s of recents) rows.push({ _type: "recent", stop: s, key: `recent-${s.id}` });
    }

    if (matches.length > 0) {
      rows.push({ _type: "header", title: q ? "Results" : "Suggestions", key: "hdr-results" });
      for (const m of matches) {
        rows.push({
          _type: "result",
          stop: m.item,
          nameRanges: (m.matches?.find((mm: any) => mm.key === "name")?.indices ?? []) as [number, number][],
          key: `res-${m.item.id}`,
        });
      }
    } else if (q) {
      rows.push({ _type: "header", title: "No results", key: "hdr-empty" });
    }

    return rows;
  }, [q, matches, recents]);

  function onSelect(stop: Stop) {
    // Interface-only: store in recents then pop back to the previous screen.
    pushRecent(stop);
    // TODO: emit an event or use params to tell the map to focus this stop.
    router.back();
  }

  const HeaderBar = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back-outline" size={22} color={BLACK} />
      </Pressable>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#6B7280" />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Search stops"
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.input}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Optional “voice” or filter icon could go here */}
      <View style={{ width: 8 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      {HeaderBar}

      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item._type === "header") {
            return (
              <Text style={styles.sectionTitle}>
                {item.title}
              </Text>
            );
          }

          const IconName =
            item._type === "recent" ? "time-outline" : ("bus-outline" as const);

          const stop = item.stop;
          const nameRanges = item._type === "result" ? item.nameRanges : [];

          return (
            <Pressable
              onPress={() => onSelect(stop)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Select ${stop.name}`}
            >
              <Ionicons name={IconName} size={18} color={BLACK} />
              {nameRanges && nameRanges.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <Highlight
                    text={stop.name}
                    ranges={nameRanges.map((indices) => ({ indices }))}
                  />
                </View>
              ) : (
                <Text style={styles.rowText} numberOfLines={1}>
                  {stop.name}
                </Text>
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={<View style={{ height: 6 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: BLACK,
    paddingVertical: 0,
  },
  sectionTitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowText: { color: BLACK, flex: 1 },
  sep: { height: 10 },
});
