import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useJourneyStore } from '../store/journeyStore';

export default function RouteLinkInterceptor() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const setJourney = useJourneyStore((state: any) => state.setJourney);

  useEffect(() => {
    // 1. Extract parameters from the URL query string
    const { fLat, fLng, tLat, tLng, fName, tName } = params;

    // 2. Validate that we have the bare minimum coordinates required to map a route
    if (!fLat || !fLng || !tLat || !tLng) {
      Alert.alert(
        "Invalid Link", 
        "This shared route link appears to be broken or incomplete."
      );
      router.replace('/');
      return;
    }

    try {
      // 3. Parse strings into floats and decode URI component strings safely
      const originLat = parseFloat(fLat as string);
      const originLng = parseFloat(fLng as string);
      const destLat = parseFloat(tLat as string);
      const destLng = parseFloat(tLng as string);

      // Basic sanity check on coordinates
      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        throw new Error("Invalid coordinate values");
      }

      const fromLoc = {
        _type: 'location',
        id: fName ? decodeURIComponent(fName as string) : 'Origin',
        name: fName ? decodeURIComponent(fName as string) : 'Origin',
        lat: originLat,
        lng: originLng,
      };

      const toLoc = {
        _type: 'location',
        id: tName ? decodeURIComponent(tName as string) : 'Destination',
        name: tName ? decodeURIComponent(tName as string) : 'Destination',
        lat: destLat,
        lng: destLng,
      };

      // 4. Hydrate your global store. 
      // Passing 'null' as the third argument tells the app to calculate a fresh path 
      // between these two pins using your routing engine rather than using a stale cached shape.
      setJourney(fromLoc, toLoc, null); 

      // 5. Clean redirect using replace.
      // CRITICAL: We use router.replace() instead of router.push(). 
      // This wipes 'route.tsx' from the navigation history. If the user presses the 
      // hardware back button later, they go back to where they were before opening the app, 
      // instead of getting trapped in a loop on this loading screen.
      router.replace('/');

    } catch (error) {
      console.error('Failed to parse deep link coordinates:', error);
      Alert.alert("Error", "Could not load the shared journey configuration.");
      router.replace('/');
    }
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6F00" />
      <Text style={styles.text}>Loading Navigo Route...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF' 
  },
  text: { 
    marginTop: 14, 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#666666' 
  }
});