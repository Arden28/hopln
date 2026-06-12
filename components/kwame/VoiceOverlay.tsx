import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  C: any;
  voiceState: string;
  holdingPhrase: string | null;
  ripple1Anim: Animated.Value;
  ripple2Anim: Animated.Value;
  orbScaleAnim: Animated.Value;
  isMuted: boolean;
  isSpeakerOn: boolean;
  voiceContainerOpacity: Animated.AnimatedInterpolation<number>;
  voiceContainerScale: Animated.AnimatedInterpolation<number>;
  handleOrbPress: () => void;
  setIsSpeakerOn: (val: boolean) => void;
  setIsMuted: (val: boolean) => void;
  toggleUiMode: (mode: 'chat' | 'voice') => void;
}

const ORANGE = "#FF6F00";

export default function VoiceOverlay({
  C, voiceState, holdingPhrase, ripple1Anim, ripple2Anim, orbScaleAnim,
  isMuted, isSpeakerOn, voiceContainerOpacity, voiceContainerScale,
  handleOrbPress, setIsSpeakerOn, setIsMuted, toggleUiMode
}: Props) {
  
  const rippleOpacity = ripple1Anim.interpolate({ inputRange: [1, 1.5], outputRange: [0.5, 0] });
  const ripple2Opacity = ripple2Anim.interpolate({ inputRange: [1, 2], outputRange: [0.3, 0] });

  return (
    <Animated.View style={[styles.voiceFullscreenOverlay, { backgroundColor: C.overlay, opacity: voiceContainerOpacity, transform: [{ scale: voiceContainerScale }] }]}>
      <View style={styles.voiceUpperTrack}>
        <Text style={styles.voiceAssistantName}>Kwame Voice</Text>
        <Text style={styles.voiceStatusIndicator}>
          {voiceState === 'listening' ? 'Listening...' : voiceState === 'processing' ? 'Thinking...' : voiceState === 'speaking' ? 'Speaking...' : 'Tap to speak'}
        </Text>
        <View style={styles.transcriptionWrapper}>
          <Text style={[styles.realtimeLiveText, { color: C.text }]}>
            {holdingPhrase || (voiceState === 'listening' ? "Go ahead, I'm listening..." : "Ready when you are.")}
          </Text>
        </View>
      </View>

      <View style={styles.voiceCenterCore}>
        {voiceState === 'listening' && (
          <>
            <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple1Anim }], opacity: rippleOpacity }]} />
            <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple2Anim }], opacity: ripple2Opacity }]} />
          </>
        )}
        
        <TouchableOpacity activeOpacity={1} onPress={handleOrbPress}>
          <Animated.View style={[styles.centralVoiceOrb, { transform: [{ scale: orbScaleAnim }] }, voiceState === 'listening' && styles.orbListeningGlow, voiceState === 'speaking' && styles.orbSpeakingGlow, isMuted && styles.micMutedState]}>
             <Ionicons name={voiceState === 'processing' ? "sync" : "mic"} size={48} color="#FFFFFF" style={styles.orbInnerIcon} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.voiceActionFooter}>
        <TouchableOpacity style={[styles.voiceSecondaryControl, { backgroundColor: C.iconBg, borderColor: C.border }, !isSpeakerOn && styles.controlDisabled]} onPress={() => setIsSpeakerOn(!isSpeakerOn)}>
          <Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={22} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.voiceMicMasterCircle, isMuted && styles.micMutedState]} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.voiceSecondaryControl, { backgroundColor: C.iconBg, borderColor: C.border }]} onPress={() => toggleUiMode('chat')}>
          <Ionicons name="close" size={24} color={C.text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  voiceFullscreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', paddingVertical: 40, paddingHorizontal: 24, zIndex: 9999 },
  voiceUpperTrack: { alignItems: 'center', marginTop: 20 },
  voiceAssistantName: { fontSize: 15, color: '#B3B3B3', fontWeight: '500', letterSpacing: 0.5 },
  voiceStatusIndicator: { fontSize: 13, color: ORANGE, marginTop: 4, fontWeight: '600' },
  transcriptionWrapper: { marginTop: 40, paddingHorizontal: 10 },
  realtimeLiveText: { fontSize: 20, textAlign: 'center', lineHeight: 28, fontWeight: '400' },
  voiceCenterCore: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rippleRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: ORANGE },
  centralVoiceOrb: { width: 140, height: 140, borderRadius: 70, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', shadowColor: ORANGE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 25, elevation: 15 },
  orbInnerIcon: { opacity: 0.9 },
  orbListeningGlow: { shadowRadius: 40, shadowOpacity: 0.8, backgroundColor: '#FF8F00' },
  orbSpeakingGlow: { shadowRadius: 30, shadowOpacity: 0.9 },
  voiceActionFooter: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20 },
  voiceSecondaryControl: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  controlDisabled: { opacity: 0.4 },
  voiceMicMasterCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  micMutedState: { backgroundColor: '#331A00', borderWidth: 1, borderColor: ORANGE },
});