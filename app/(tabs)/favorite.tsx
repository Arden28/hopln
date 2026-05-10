// app/(tabs)/favorite.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Context-specific colors from your theme
const ORANGE = "#FF6F00";
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const BORDER = "#E5E7EB";
const SUBTEXT = "#6B7280";
const BG_SOFT_ORANGE = "#FFF7ED";
const BG_LIGHT_GREY = "#F3F4F6";

const SAVED_LISTS = [
  { id: "1", title: "Favorites", subtitle: "Private list · 3 places", icon: "heart-outline" as const, color: "#EF4444" },
  { id: "2", title: "Want to go", subtitle: "Private list · 9 places", icon: "flag-outline" as const, color: "#10B981" },
  { id: "3", title: "Travel plans", subtitle: "Private list · 2 places", icon: "briefcase-outline" as const, color: "#3B82F6" },
  { id: "4", title: "Labeled", subtitle: "Private list · 0 places", icon: "pricetag-outline" as const, color: SUBTEXT },
];

const RECENTLY_SAVED = [
  {
    id: "1",
    title: "ALPHA MAX GYM",
    category: "Fitness center",
    list: "Favorites",
    // Unsplash placeholder for the gym
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop", 
  },
  {
    id: "2",
    title: "Desca Junior Academy",
    category: "School",
    list: "Want to go",
    // Unsplash placeholder for a school/building
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=400&auto=format&fit=crop",
  },
];

export default function FavoriteScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>You</Text>
        <Pressable style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={22} color={BLACK} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        
        {/* ── New List Button ── */}
        <Pressable style={styles.newListBtn}>
          <Ionicons name="add" size={20} color={ORANGE} />
          <Text style={styles.newListText}>New list</Text>
        </Pressable>

        {/* ── Saved Lists ── */}
        <View style={styles.listsContainer}>
          {SAVED_LISTS.map((item, index) => (
            <Pressable 
              key={item.id} 
              style={[styles.listItem, index === SAVED_LISTS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.iconContainer}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              
              <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>{item.title}</Text>
                <Text style={styles.listItemSub}>{item.subtitle}</Text>
              </View>
              
              <Pressable style={styles.moreOptionsBtn}>
                <Ionicons name="ellipsis-horizontal" size={20} color={BLACK} />
              </Pressable>
            </Pressable>
          ))}
        </View>

        {/* ── More Dropdown ── */}
        <Pressable style={styles.moreBtn}>
          <Ionicons name="chevron-down" size={16} color={BLACK} />
          <Text style={styles.moreBtnText}>More</Text>
        </Pressable>

        {/* ── Recently Saved ── */}
        <Text style={styles.sectionTitle}>Recently saved</Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentScrollContent}
        >
          {RECENTLY_SAVED.map((place) => (
            <Pressable key={place.id} style={styles.recentCard}>
              <Image source={{ uri: place.image }} style={styles.recentImage} />
              <View style={styles.recentContent}>
                <Text style={styles.recentTitle} numberOfLines={1}>{place.title}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{place.category}</Text>
                <View style={styles.recentTag}>
                  <Ionicons 
                    name={place.list === "Favorites" ? "heart" : "flag"} 
                    size={14} 
                    color={place.list === "Favorites" ? "#EF4444" : "#10B981"} 
                  />
                  <Text style={styles.recentTagText}>{place.list}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "600",
    color: BLACK,
    letterSpacing: -0.5,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_LIGHT_GREY,
    alignItems: "center",
    justifyContent: "center",
  },
  newListBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG_SOFT_ORANGE,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 999, // Pill shape
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  newListText: {
    fontSize: 16,
    fontWeight: "600",
    color: ORANGE,
  },
  listsContainer: {
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    backgroundColor: WHITE,
  },
  iconContainer: {
    width: 32,
    alignItems: "center",
  },
  listItemTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: BLACK,
    marginBottom: 2,
  },
  listItemSub: {
    fontSize: 13,
    color: SUBTEXT,
  },
  moreOptionsBtn: {
    padding: 8,
    marginRight: -8, // Expand touch target slightly to the right edge
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  moreBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: BLACK,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: BLACK,
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  recentScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recentCard: {
    width: 180,
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  recentImage: {
    width: "100%",
    height: 100,
    backgroundColor: BG_LIGHT_GREY,
  },
  recentContent: {
    padding: 12,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: BLACK,
    marginBottom: 4,
  },
  recentSub: {
    fontSize: 13,
    color: SUBTEXT,
    marginBottom: 10,
  },
  recentTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recentTagText: {
    fontSize: 13,
    color: SUBTEXT,
    fontWeight: "500",
  },
});