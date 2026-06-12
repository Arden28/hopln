import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  C: any;
  router: any;
  clearHistory: () => void;
}

const ORANGE = "#FF6F00";

export default function ChatHeader({ C, router, clearHistory }: Props) {
  const handleClearChat = () => {
    Alert.alert("Clear Conversation", "Are you sure you want to clear your chat history with Kwame?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearHistory }
    ]);
  };

  return (
    <View style={[styles.topBar, { backgroundColor: C.bg, borderBottomColor: C.border }]}>
      <View style={styles.topLeftRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={15}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.brandTitle, { color: C.text }]}>Navigo <Text style={styles.accentText}>Kwame</Text></Text>
      </View>
      <View style={styles.topActionsRow}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleClearChat}>
          <Ionicons name="trash-outline" size={22} color={C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  topLeftRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 8, marginLeft: -4 },
  brandTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  accentText: { color: ORANGE },
  topActionsRow: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 6, marginLeft: 6 },
});