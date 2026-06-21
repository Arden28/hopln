import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function RouteLinkInterceptor() {
  const router = useRouter();
  const { fLat, fLng, tLat, tLng, fName, tName } = useLocalSearchParams();

  useEffect(() => {
    if (!fLat || !fLng || !tLat || !tLng) {
      Alert.alert("Invalid Link", "This shared route link appears to be broken or incomplete.");
      router.replace('/');
      return;
    }

    const originLat = parseFloat(fLat as string);
    const originLng = parseFloat(fLng as string);
    const destLat   = parseFloat(tLat as string);
    const destLng   = parseFloat(tLng as string);

    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      Alert.alert("Error", "Could not load the shared journey configuration.");
      router.replace('/');
      return;
    }

    router.replace({
      pathname: '/search',
      params: {
        fLat:  String(originLat),
        fLng:  String(originLng),
        tLat:  String(destLat),
        tLng:  String(destLng),
        fName: fName ? decodeURIComponent(fName as string) : '',
        tName: tName ? decodeURIComponent(tName as string) : '',
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6F00" />
      <Text style={styles.text}>Loading shared route…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  text:      { marginTop: 14, fontSize: 14, fontWeight: '600', color: '#666666' },
});
