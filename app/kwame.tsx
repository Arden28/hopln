import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, Animated, ActivityIndicator, KeyboardAvoidingView,
  Platform, useColorScheme, Alert, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAudioRecorder, useAudioPlayer, AudioModule } from 'expo-audio';
import * as Location from 'expo-location';

import { AiService, LocationResolutionAction } from '../services/ai';
import { useChatStore } from '../store/chatStore';

// Modular Components
import ChatHeader from '../components/kwame/ChatHeader';
import ActionUI from '../components/kwame/ActionUI';
import RouteCard from '../components/kwame/RouteCard';
import VoiceOverlay from '../components/kwame/VoiceOverlay';
import MessageBubble from '../components/kwame/MessageBubble';

const ORANGE = "#FF6F00";

function RouteScroller({ routes, C }: { routes: any[]; C: any }) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLast = activeIndex >= routes.length - 1;

  const scrollToNext = () => {
    const next = Math.min(activeIndex + 1, routes.length - 1);
    scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={routeScrollerStyles.row}
        onScroll={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH))}
        scrollEventThrottle={16}
      >
        {routes.map((route, i) => <RouteCard key={i} route={route} index={i} C={C} />)}
      </ScrollView>
      {routes.length > 1 && !isLast && (
        <View style={routeScrollerStyles.hintContainer}>
          <TouchableOpacity
            style={[routeScrollerStyles.hintCircle, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={scrollToNext}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={16} color={ORANGE} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const CARD_WIDTH = Dimensions.get('window').width - 28;

const routeScrollerStyles = StyleSheet.create({
  row: { paddingRight: 12, alignItems: 'stretch' },
  hintContainer: { alignItems: 'center', marginTop: 8 },
  hintCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
});

const RECORDING_OPTIONS_WAV = {
  isMeteringEnabled: true,
  android: { extension: '.wav', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
  ios: { extension: '.wav', audioQuality: 127, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
};

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
    actionCard: dark ? "#1C1C1E" : "#F2F2F7",
  };
}

export default function KwameScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const C = makeC(dark);

  const { messages, addMessage, loadHistory, clearHistory } = useChatStore();
  const sessionId = "kwame_main_session";

  const [uiMode, setUiMode] = useState<'chat' | 'voice'>('chat');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [holdingPhrase, setHoldingPhrase] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Go to Bottom UX State
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS_WAV);
  const [audioPlayerUri, setAudioPlayerUri] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer(audioPlayerUri);

  const voiceTransitionAnim = useRef(new Animated.Value(0)).current; 
  const orbScaleAnim = useRef(new Animated.Value(1)).current;
  const ripple1Anim = useRef(new Animated.Value(1)).current;
  const ripple2Anim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const animRunner = useRef<Animated.CompositeAnimation | null>(null);

  const isProcessing = loading || voiceState === 'processing';

  const fetchCurrentLocation = async () => {
    let lat = -1.2921, lng = 36.8219;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch (e) {}
    return { lat, lng };
  };
  
  useEffect(() => { loadHistory(sessionId); }, []);

  useEffect(() => {
    if (audioPlayerUri && audioPlayer) {
      audioPlayer.play();
      const playTime = (audioPlayer.duration || 5) * 1000;
      setTimeout(() => setVoiceState((prev) => prev === 'speaking' ? 'idle' : prev), playTime);
    }
  }, [audioPlayerUri, audioPlayer]);

  useEffect(() => {
    let isActive = true;
    const simulateAudioWaveform = () => {
      if (!isActive) return;
      if (uiMode !== 'voice' || voiceState === 'idle') {
        Animated.spring(orbScaleAnim, { toValue: 1, useNativeDriver: true }).start();
        return;
      }
      const minScale = 1.0;
      const maxScale = voiceState === 'speaking' ? 1.4 : 1.15;
      const randomAmplitude = Math.random() * (maxScale - minScale) + minScale;
      animRunner.current = Animated.spring(orbScaleAnim, {
        toValue: randomAmplitude, speed: 25, bounciness: 8, useNativeDriver: true,
      });
      animRunner.current.start(({ finished }) => {
        if (finished && isActive) simulateAudioWaveform();
      });
    };
    simulateAudioWaveform();
    return () => { isActive = false; animRunner.current?.stop(); };
  }, [uiMode, voiceState, orbScaleAnim]);

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { Alert.alert('Microphone Access', 'Kwame needs microphone access.'); return; }
      if (audioPlayer?.playing) audioPlayer.pause();
      
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setVoiceState('listening');

      Animated.loop(Animated.parallel([
        Animated.timing(ripple1Anim, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
        Animated.timing(ripple2Anim, { toValue: 2.0, duration: 1500, useNativeDriver: true })
      ])).start();
    } catch (err) {
      setVoiceState('idle');
      Alert.alert('Microphone Error', 'Could not initialize the microphone hardware.');
    }
  };

  const stopRecording = async () => {
    if (voiceState !== 'listening') return;
    setVoiceState('processing');
    ripple1Anim.setValue(1);
    ripple2Anim.setValue(1);

    try {
      audioRecorder.stop(); 
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("No recording URI found");

      const fileResp = await fetch(uri);
      const blob = await fileResp.blob();
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const { lat, lng } = await fetchCurrentLocation();

      setHoldingPhrase("Processing your route...");
      const response = await AiService.planRoute(sessionId, undefined, base64Audio, 'audio/wav', lat, lng);
      setHoldingPhrase(null);
      
      if (response.spoken_response) {
        const newMsgId = Math.random().toString();
        setStreamingMessageId(newMsgId);
        addMessage({ id: newMsgId, role: 'assistant', text: response.spoken_response, routes: response.routes, actionRequired: response.actionRequired });
      }

      if (response.tts_audio && isSpeakerOn) {
        setVoiceState('speaking');
        setAudioPlayerUri(`data:audio/wav;base64,${response.tts_audio}`);
      } else {
        setVoiceState('idle');
      }
    } catch (err) {
      setVoiceState('idle');
      setHoldingPhrase(null);
    }
  };

  const handleOrbPress = () => {
    if (isMuted) return;
    if (voiceState === 'idle' || voiceState === 'speaking') {
      startRecording();
    } else if (voiceState === 'listening') {
      stopRecording();
    }
  };

  const toggleUiMode = (targetMode: 'chat' | 'voice') => {
    if (targetMode === 'voice') {
      setUiMode('voice');
      Animated.timing(voiceTransitionAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
        if (!isMuted) startRecording();
      });
    } else {
      if (voiceState === 'listening') stopRecording();
      Animated.timing(voiceTransitionAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setUiMode('chat');
        setVoiceState('idle');
      });
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim() || isProcessing) return;
    const userQuery = inputText.trim();
    setInputText('');
    setLoading(true);

    addMessage({ id: Math.random().toString(), role: 'user', text: userQuery });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { lat, lng } = await fetchCurrentLocation();
      const response = await AiService.planRoute(sessionId, userQuery, undefined, undefined, lat, lng);
      
      const newMsgId = Math.random().toString();
      setStreamingMessageId(newMsgId);
      
      addMessage({ id: newMsgId, role: 'assistant', text: response.spoken_response || '', routes: response.routes, actionRequired: response.actionRequired });
    } catch (err) {
      addMessage({ id: Math.random().toString(), role: 'assistant', text: "Network error, please try again." });
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSelectSavedPlace = async (placeName: string, pLat: number, pLng: number, action: LocationResolutionAction) => {
    setLoading(true);
    const customAliases = { [placeName.toLowerCase()]: { lat: pLat, lng: pLng, name: placeName } };
    const query = action.field === 'from' 
        ? `From ${placeName} to ${action.unresolvedName}` 
        : `Take me to ${placeName}`;

    addMessage({ id: Math.random().toString(), role: 'user', text: `Use saved place: ${placeName}` });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { lat, lng } = await fetchCurrentLocation();
      const response = await AiService.planRoute(sessionId, query, undefined, undefined, lat, lng, customAliases);
      
      const newMsgId = Math.random().toString();
      setStreamingMessageId(newMsgId);
      addMessage({ id: newMsgId, role: 'assistant', text: response.spoken_response || '', routes: response.routes, actionRequired: response.actionRequired });
    } catch (err) {
      addMessage({ id: Math.random().toString(), role: 'assistant', text: "Failed to recalculate." });
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const copyToClipboard = async (text: string) => { await Clipboard.setStringAsync(text); };

  // Track scroll position to show/hide the "Go To Bottom" FAB
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    // Show button if we are scrolled up more than 150px from the bottom
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 150;
    setShowScrollBottom(!isCloseToBottom);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const chatScale = voiceTransitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });
  const chatOpacity = voiceTransitionAnim.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0] });
  const voiceContainerOpacity = voiceTransitionAnim.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1] });
  const voiceContainerScale = voiceTransitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] });

  return (
    <SafeAreaView style={[styles.masterContainer, { backgroundColor: C.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.masterContainer}>
        
        <Animated.View style={[styles.chatView, { transform: [{ scale: chatScale }], opacity: chatOpacity }]} pointerEvents={uiMode === 'chat' ? 'auto' : 'none'}>
          <ChatHeader C={C} router={router} clearHistory={clearHistory} />

          <ScrollView 
            ref={scrollViewRef} 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {messages.map((msg) => (
              <View key={msg.id} style={[styles.bubbleWrapper, msg.role === 'user' ? styles.userWrapper : styles.aiWrapper]}>
                
                <MessageBubble msg={msg} C={C} isStreaming={msg.id === streamingMessageId} />
                <ActionUI msg={msg} C={C} router={router} onSelectPlace={handleSelectSavedPlace} />
                {msg.routes && msg.routes.length > 0 && (
                  <RouteScroller routes={msg.routes} C={C} />
                )}

                {msg.role === 'assistant' && (
                  <View style={styles.bubbleUtilityRow}>
                    <TouchableOpacity onPress={() => copyToClipboard(msg.text)} hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="copy-outline" size={16} color={C.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="volume-medium-outline" size={18} color={C.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="thumbs-up-outline" size={16} color={C.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="thumbs-down-outline" size={16} color={C.sub} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            
            {loading && (
              <View style={[styles.bubbleWrapper, styles.aiWrapper]}>
                <View style={[styles.loaderBubble, { backgroundColor: C.bubbleAI }]}>
                  <ActivityIndicator color={ORANGE} size="small" />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Elegant Floating "Go To Bottom" Button */}
          {showScrollBottom && (
            <Animated.View style={styles.fabContainer}>
              <TouchableOpacity style={[styles.fab, { backgroundColor: C.card, borderColor: C.border }]} onPress={scrollToBottom} activeOpacity={0.8}>
                <Ionicons name="chevron-down" size={24} color={ORANGE} />
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={[styles.bottomInputDock, { backgroundColor: C.bg, borderTopColor: C.border }]}>
            <View style={[styles.inputPillContainer, { backgroundColor: C.card, opacity: isProcessing ? 0.6 : 1 }]}>
              <TouchableOpacity style={styles.dockAddonButton} disabled={isProcessing}>
                <Ionicons name="add" size={24} color={C.sub} />
              </TouchableOpacity>
              <TextInput 
                style={[styles.textInputField, { color: C.text }]} 
                placeholder={isProcessing ? "Kwame is thinking..." : "Message Kwame..."} 
                placeholderTextColor={C.sub} 
                value={inputText} 
                onChangeText={setInputText} 
                editable={!isProcessing} // <-- UX Disable
              />
            </View>
            {inputText.trim().length > 0 ? (
              <TouchableOpacity 
                style={[styles.primaryActionButton, isProcessing && { backgroundColor: C.sub }]} 
                onPress={handleSendText}
                disabled={isProcessing} // <-- UX Disable
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.primaryActionButton, isProcessing && { backgroundColor: C.sub }]} 
                onPress={() => toggleUiMode('voice')}
                disabled={isProcessing} // <-- UX Disable
              >
                <Ionicons name="pulse" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {uiMode === 'voice' && (
          <VoiceOverlay 
            C={C}
            voiceState={voiceState}
            holdingPhrase={holdingPhrase}
            ripple1Anim={ripple1Anim}
            ripple2Anim={ripple2Anim}
            orbScaleAnim={orbScaleAnim}
            isMuted={isMuted}
            isSpeakerOn={isSpeakerOn}
            voiceContainerOpacity={voiceContainerOpacity}
            voiceContainerScale={voiceContainerScale}
            handleOrbPress={handleOrbPress}
            setIsSpeakerOn={setIsSpeakerOn}
            setIsMuted={setIsMuted}
            toggleUiMode={toggleUiMode}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  masterContainer: { flex: 1 },
  chatView: { flex: 1, width: '100%', height: '100%' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingVertical: 20, paddingHorizontal: 14 },
  bubbleWrapper: { marginBottom: 16, width: '100%', flexDirection: 'column' },
  userWrapper: { alignItems: 'flex-end' },
  aiWrapper: { alignItems: 'flex-start' },

  bubbleUtilityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 8, gap: 16 },
  utilityIcon: { padding: 2 },
  loaderBubble: { paddingHorizontal: 24, paddingVertical: 14, borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  /* FAB UX Styling */
  fabContainer: { position: 'absolute', bottom: 70, right: 16, zIndex: 10 },
  fab: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  
  bottomInputDock: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  inputPillContainer: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 22, paddingHorizontal: 12, marginRight: 10 },
  dockAddonButton: { marginRight: 4, padding: 4 },
  textInputField: { flex: 1, fontSize: 15, paddingVertical: 0 },
  primaryActionButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
});