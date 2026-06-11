import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, Animated, Dimensions, ActivityIndicator, KeyboardAvoidingView,
  Platform, useColorScheme, Alert, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { AiService, AiPlanResponse, RouteSummary, TransitLeg } from '../services/ai';
import { useChatStore } from '../store/chatStore';

const { width } = Dimensions.get('window');
const ORANGE = "#FF6F00";

function makeC(dark: boolean) {
  return {
    bg:       dark ? "#0F0F0F" : "#FFFFFF",
    card:     dark ? "#1A1A1A" : "#F2F2F7",
    text:     dark ? "#FFFFFF" : "#000000",
    sub:      dark ? "#B3B3B3" : "#8E8E93",
    border:   dark ? "#2A2A2A" : "#E5E5EA",
    iconBg:   dark ? "#2C2C2E" : "#E5E5EA",
    bubbleAI: dark ? "#1A1A1A" : "#F2F2F7",
    overlay:  dark ? "#0A0A0A" : "#FFFFFF",
  };
}

export default function KwameScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const C = makeC(dark);

  // Global State
  const { messages, addMessage, loadHistory, clearHistory } = useChatStore();
  const sessionId = useRef(`session_${Math.random().toString(36).substr(2, 9)}`).current;

  // UI State
  const [uiMode, setUiMode] = useState<'chat' | 'voice'>('chat');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [holdingPhrase, setHoldingPhrase] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Hardware Audio State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Animation Refs
  const voiceTransitionAnim = useRef(new Animated.Value(0)).current; 
  const orbScaleAnim = useRef(new Animated.Value(1)).current;
  const ripple1Anim = useRef(new Animated.Value(1)).current;
  const ripple2Anim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadHistory(sessionId);
    return () => {
      if (recording) recording.stopAndUnloadAsync();
      if (sound) sound.unloadAsync();
    };
  }, []);

  // Hardware: Start Microphone
  const startRecording = async () => {
    try {
      if (sound) await sound.unloadAsync(); // Stop Kwame if he's talking
      
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') return Alert.alert('Microphone permission required');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            // Map decibels (-160 to 0) to a scale multiplier (1.0 to 1.6)
            const db = Math.max(-60, status.metering);
            const scale = 1 + ((db + 60) / 60) * 0.6;
            
            Animated.spring(orbScaleAnim, {
              toValue: scale,
              friction: 4,
              useNativeDriver: true,
            }).start();
          }
        },
        50 // Refresh interval for UI fluidity
      );

      setRecording(recording);
      setVoiceState('listening');

      // Start "Courbure" ambient ripples
      Animated.loop(
        Animated.parallel([
          Animated.timing(ripple1Anim, { toValue: 1.5, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ripple2Anim, { toValue: 2.0, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true })
        ])
      ).start();

    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  // Hardware: Stop Microphone & Process Base64
  const stopRecording = async () => {
    if (!recording) return;
    setVoiceState('processing');
    
    // Stop animations
    ripple1Anim.setValue(1);
    ripple2Anim.setValue(1);
    Animated.spring(orbScaleAnim, { toValue: 1, useNativeDriver: true }).start();

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error("No recording URI found");

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get user location for context (Fallback to central Nairobi if disabled)
      let lat = -1.2921, lng = 36.8219;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      setHoldingPhrase("Processing your route...");

      const response = await AiService.planRoute(sessionId, undefined, base64Audio, 'audio/m4a', lat, lng);
      
      setHoldingPhrase(null);
      
      if (response.spoken_response) {
        addMessage({ id: Math.random().toString(), role: 'assistant', text: response.spoken_response, route: response.route });
      }

      // Play the Native Base64 Audio returned by OpenAI
      if (response.tts_audio && isSpeakerOn) {
        setVoiceState('speaking');
        const audioUri = FileSystem.cacheDirectory + 'kwame_response.wav';
        await FileSystem.writeAsStringAsync(audioUri, response.tts_audio, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (playbackStatus) => {
            if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
              setVoiceState('idle');
            } else if (playbackStatus.isLoaded && playbackStatus.isPlaying) {
              // Simulate speaking amplitude
              const fakeScale = 1.1 + Math.random() * 0.2;
              Animated.spring(orbScaleAnim, { toValue: fakeScale, friction: 3, useNativeDriver: true }).start();
            }
          }
        );
        setSound(newSound);
      } else {
        setVoiceState('idle');
      }

    } catch (err) {
      console.error('Processing failed', err);
      setVoiceState('idle');
      setHoldingPhrase(null);
    }
  };

  // Hardware: Central Orb Tap Logic
  const handleOrbPress = () => {
    if (isMuted) return;
    if (voiceState === 'idle' || voiceState === 'speaking') {
      startRecording();
    } else if (voiceState === 'listening') {
      stopRecording();
    }
  };

  // General Text Handlers
  const toggleUiMode = (targetMode: 'chat' | 'voice') => {
    if (targetMode === 'voice') {
      setUiMode('voice');
      Animated.timing(voiceTransitionAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
        if (!isMuted) startRecording();
      });
    } else {
      if (recording) stopRecording();
      Animated.timing(voiceTransitionAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setUiMode('chat');
        setVoiceState('idle');
      });
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const userQuery = inputText.trim();
    setInputText('');
    setLoading(true);

    addMessage({ id: Math.random().toString(), role: 'user', text: userQuery });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await AiService.planRoute(sessionId, userQuery, undefined, undefined, -1.2921, 36.8219);
      addMessage({
        id: Math.random().toString(), role: 'assistant', text: response.spoken_response || '', route: response.route
      });
    } catch (err) {
      addMessage({ id: Math.random().toString(), role: 'assistant', text: "Network error, please try again." });
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  const renderRouteDetails = (route: RouteSummary) => {
    return (
      <View style={[styles.routeCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[styles.routeHeader, { borderBottomColor: C.border }]}>
          <Text style={[styles.routeHeadline, { color: C.text }]}>{route.summary || "Suggested Travel Plan"}</Text>
          <Text style={styles.routeDuration}>{Math.round(route.total_duration / 60)} min</Text>
        </View>

        {route.legs && route.legs.map((leg: TransitLeg, index: number) => (
          <View key={index} style={styles.legRow}>
            <View style={styles.indicatorContainer}>
              <View style={[styles.indicatorNode, leg.mode === 'WALK' ? { backgroundColor: C.sub } : styles.transitNode]} />
              {index < route.legs.length - 1 && <View style={[styles.indicatorLine, { backgroundColor: C.border }]} />}
            </View>
            <View style={styles.legContent}>
              <Text style={[styles.legTitle, { color: C.text }]}>
                {leg.mode === 'WALK' ? 'Walk to stage' : `Board Matatu Route ${leg.routeNumber || 'Transit'}`}
              </Text>
              <Text style={[styles.legSubtext, { color: C.sub }]}>
                From <Text style={[styles.boldText, { color: C.text }]}>{leg.from.name}</Text> to <Text style={[styles.boldText, { color: C.text }]}>{leg.to.name}</Text>
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const chatScale = voiceTransitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });
  const chatOpacity = voiceTransitionAnim.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0] });
  const voiceContainerOpacity = voiceTransitionAnim.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1] });
  const voiceContainerScale = voiceTransitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] });
  
  const rippleOpacity = ripple1Anim.interpolate({ inputRange: [1, 1.5], outputRange: [0.5, 0] });
  const ripple2Opacity = ripple2Anim.interpolate({ inputRange: [1, 2], outputRange: [0.3, 0] });

  return (
    <SafeAreaView style={[styles.masterContainer, { backgroundColor: C.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.masterContainer}>
        
        {/* ================= SCREEN 1: TEXT CHAT MODE ================= */}
        <Animated.View style={[styles.chatView, { transform: [{ scale: chatScale }], opacity: chatOpacity }]} pointerEvents={uiMode === 'chat' ? 'auto' : 'none'}>
          <View style={[styles.topBar, { backgroundColor: C.bg, borderBottomColor: C.border }]}>
            <View style={styles.topLeftRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={15}>
                <Ionicons name="chevron-back" size={26} color={C.text} />
              </TouchableOpacity>
              <Text style={[styles.brandTitle, { color: C.text }]}>Navigo <Text style={styles.accentText}>Kwame</Text></Text>
            </View>
            <View style={styles.topActionsRow}>
              <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Settings', 'Voice preferences & language controls.')}>
                <Ionicons name="settings-outline" size={22} color={C.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Menu', 'Clear history?', [{ text: 'Cancel' }, { text: 'Clear', onPress: clearHistory }])}>
                <Ionicons name="ellipsis-vertical" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => (
              <View key={msg.id} style={[styles.bubbleWrapper, msg.role === 'user' ? styles.userWrapper : styles.aiWrapper]}>
                <View style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : [styles.aiBubble, { backgroundColor: C.bubbleAI }]]}>
                  <Text style={[styles.messageText, { color: msg.role === 'user' ? '#FFFFFF' : C.text }]}>{msg.text}</Text>
                </View>
                {msg.route && renderRouteDetails(msg.route)}

                {msg.role === 'assistant' && (
                  <View style={styles.bubbleUtilityRow}>
                    <TouchableOpacity onPress={() => copyToClipboard(msg.text)} hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="copy-outline" size={16} color={C.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Listen', 'Not available in text mode without generation.')} hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="volume-medium-outline" size={18} color={C.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="thumbs-up-outline" size={16} color={C.sub} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            {loading && (
              <View style={[styles.bubbleWrapper, styles.aiWrapper]}>
                <View style={[styles.messageBubble, styles.aiBubble, styles.loaderBubble, { backgroundColor: C.bubbleAI }]}>
                  <ActivityIndicator color={ORANGE} size="small" />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.bottomInputDock, { backgroundColor: C.bg, borderTopColor: C.border }]}>
            <View style={[styles.inputPillContainer, { backgroundColor: C.card }]}>
              <TouchableOpacity style={styles.dockAddonButton}>
                <Ionicons name="add" size={24} color={C.sub} />
              </TouchableOpacity>
              <TextInput
                style={[styles.textInputField, { color: C.text }]}
                placeholder="Message Kwame..."
                placeholderTextColor={C.sub}
                value={inputText}
                onChangeText={setInputText}
              />
            </View>
            {inputText.trim().length > 0 ? (
              <TouchableOpacity style={styles.primaryActionButton} onPress={handleSendText}>
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryActionButton} onPress={() => toggleUiMode('voice')}>
                <Ionicons name="pulse" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ================= SCREEN 2: PREMIUM VOICE MODE OVERLAY ================= */}
        {uiMode === 'voice' && (
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
              {/* Courbure Ripple Rings */}
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
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  masterContainer: { flex: 1 },
  chatView: { flex: 1, width: '100%', height: '100%' },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  topLeftRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 8, marginLeft: -4 },
  brandTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  accentText: { color: ORANGE },
  topActionsRow: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 6, marginLeft: 6 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingVertical: 20, paddingHorizontal: 14 },
  bubbleWrapper: { marginBottom: 16, width: '100%', flexDirection: 'column' },
  userWrapper: { alignItems: 'flex-end' },
  aiWrapper: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: width * 0.82, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 18 },
  userBubble: { backgroundColor: ORANGE, borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },
  bubbleUtilityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 8, gap: 16 },
  utilityIcon: { padding: 2 },
  loaderBubble: { paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  messageText: { fontSize: 15, lineHeight: 21 },
  bottomInputDock: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  inputPillContainer: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 22, paddingHorizontal: 12, marginRight: 10 },
  dockAddonButton: { marginRight: 4, padding: 4 },
  textInputField: { flex: 1, fontSize: 15, paddingVertical: 0 },
  primaryActionButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  routeCard: { width: width * 0.85, borderRadius: 14, padding: 14, marginTop: 8, borderWidth: StyleSheet.hairlineWidth },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  routeHeadline: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  routeDuration: { color: ORANGE, fontSize: 14, fontWeight: '700' },
  legRow: { flexDirection: 'row', minHeight: 45 },
  indicatorContainer: { alignItems: 'center', marginRight: 12, width: 12 },
  indicatorNode: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  transitNode: { backgroundColor: ORANGE },
  indicatorLine: { flex: 1, width: 2, marginVertical: 4 },
  legContent: { flex: 1, paddingBottom: 10 },
  legTitle: { fontSize: 13, fontWeight: '600' },
  legSubtext: { fontSize: 12, marginTop: 2 },
  boldText: { fontWeight: '500' },
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