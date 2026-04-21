import { AvatarButton, MinimalistTitle } from "@/components/app/Header";
import { HapticTab } from "@/components/haptic-tab";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";

export default function TabsLayout() {
  const colorScheme = useColorScheme();

  // Gets device-specific safe boundaries (notches, dynamic islands, etc.)
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      // --- GLOBAL SCREEN PADDING ---
      // This applies a global padding to all screens so they don't hide under the transparent header
      sceneContainerStyle={{
        paddingTop: insets.top + 60, // Safe area top + header height
        backgroundColor: "#F8F9FA", // Light neutral background for the whole app
      }}
      screenOptions={{
        // --- HEADER STYLING ---
        headerTitle: "",
        headerLeft: () => <MinimalistTitle />,
        headerRight: () => <AvatarButton />,
        headerTransparent: true,
        headerShadowVisible: false,

        // --- TAB BAR STYLING ---
        tabBarShowLabel: true, // Restored the labels
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: Platform.OS === "ios" ? 0 : 4, // Minor visual tweak for Android
        },
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: "#8E8E93",
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: "relative", // Made solid, no longer floating
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#F0F0F0", // Subtle border to separate from content
            elevation: 0,
            height: 85, // Standard solid height for iOS
          },
          android: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#F0F0F0",
            elevation: 8,
            height: 65,
            paddingBottom: 8, // Gives the text breathing room
          },
        }),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          headerShown: false,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "map" : "map-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={size + 2}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
