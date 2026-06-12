import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LocationResolutionAction } from '../../services/ai';

interface Props {
  msg: any;
  C: any;
  router: any;
  onSelectPlace: (name: string, lat: number, lng: number, action: LocationResolutionAction) => void;
}

export default function ActionUI({ msg, C, router, onSelectPlace }: Props) {
  if (!msg.actionRequired) return null;
  const action = msg.actionRequired;

  if (!action.isAuthenticated) {
    return (
      <View style={[styles.actionCardContainer, { backgroundColor: C.actionCard, borderColor: C.border }]}>
        <Text style={[styles.actionCardTitle, { color: C.text }]}>Authentication Required</Text>
        <Text style={[styles.actionCardDesc, { color: C.sub }]}>Log in to search or route using your custom saved places (Home, Work, Gym, etc).</Text>
        <TouchableOpacity style={styles.authButton} onPress={() => router.push('/login')}>
          <Text style={styles.authButtonText}>Sign In to Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.actionCardContainer, { backgroundColor: 'transparent', borderWidth: 0 }]}>
      <Text style={[styles.actionCardDesc, { color: C.sub, marginBottom: 8 }]}>
        Select an alternative for "{action.unresolvedName}":
      </Text>
      
      {action.savedPlaces.length === 0 ? (
         <TouchableOpacity style={[styles.authButton, { backgroundColor: C.actionCard, borderColor: C.border, borderWidth: 1 }]} onPress={() => router.push('/settings')}>
           <Text style={[styles.authButtonText, { color: C.text }]}>+ Add a Saved Place</Text>
         </TouchableOpacity>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {action.savedPlaces.map((place: any) => (
            <TouchableOpacity 
              key={place.id} 
              style={[styles.chipButton, { backgroundColor: C.actionCard, borderColor: C.border }]}
              onPress={() => onSelectPlace(place.name, place.lat, place.lng, action)}
            >
              <Text style={[styles.chipText, { color: C.text }]}>
                {place.pin === "home" ? "🏠 " : place.pin === "work" ? "💼 " : "📍 "}
                {place.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionCardContainer: { marginTop: 10, padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  actionCardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  actionCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  authButton: { backgroundColor: '#FFFFFF', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  authButtonText: { color: '#000000', fontSize: 13, fontWeight: '600' },
  chipScroll: { paddingVertical: 4 },
  chipButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '500' },
});