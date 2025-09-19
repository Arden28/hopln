import { AvatarButton, LogoTitle } from "@/components/app/Header";
import { HapticTab } from '@/components/haptic-tab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/theme';
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from 'react';
import { Platform, useColorScheme } from "react-native";
export default function TabsLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTransparent: false,
        headerShadowVisible: false,
        headerTitle: () => <LogoTitle />,
        headerRight: () => <AvatarButton />,
        headerStyle: { backgroundColor: "#F6F7F8" }, // neutral, not white
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
