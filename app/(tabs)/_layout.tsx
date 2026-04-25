import { AvatarButton, MinimalistTitle } from "@/components/app/Header";
import { HapticTab } from "@/components/haptic-tab";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Context-specific colors
const ORANGE = "#FF6F00"; 
const INACTIVE_BLACK = "#1A1A1A"; // Changed from Grey to Dark for higher contrast

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      sceneContainerStyle={{
        backgroundColor: "#FFFFFF",
      }}
      screenOptions={{
        headerTitle: "",
        headerLeft: () => <MinimalistTitle />,
        headerRight: () => <AvatarButton />,
        headerTransparent: false,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 0.5,
          borderBottomColor: "#E5E5E5",
          // Adjusted height slightly for a tighter look
          height: Platform.OS === "ios" ? 100 : 70, 
        },
    
        headerLeftContainerStyle: { paddingLeft: 0 },
        headerRightContainerStyle: { paddingRight: 0 },

        // --- TAB BAR STYLING ---
        tabBarShowLabel: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: INACTIVE_BLACK, // Apply the new dark color here
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0, // 0.5
          borderTopColor: "#E5E5E5",
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === "ios" ? 50 + insets.bottom : 64,
          paddingBottom: Platform.OS === "ios" ? insets.bottom - 10 : 0, 
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            // Feather Home looks great, but we use a slightly larger size when focused
            <Feather name="home" size={focused ? 26 : 24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "map" : "map-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={26}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}