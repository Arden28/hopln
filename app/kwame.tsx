import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AiService, AiPlanResponse, RouteSummary, TransitLeg } from '../services/ai';

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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  route?: RouteSummary | null;
}

export default function KwameScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const C = makeC(dark);

  const [uiMode, setUiMode] = useState<'chat' | 'voice'>('chat');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Sasa! I'm Kwame, your Navigo guide. Where are we heading today?",
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [holdingPhrase, setHoldingPhrase] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const voiceTransitionAnim = useRef(new Animated.Value(0)).current; 
  const orbPulseAnim = useRef(new Animated.Value(1)).current;
  const animRunner = useRef<Animated.CompositeAnimation | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const sessionId = useRef(`session_${Math.random().toString(36).substr(2, 9)}`).current;

  // Real-time Audio Amplitude Simulation
  useEffect(() => {
    let isActive = true;

    const simulateAudioWaveform = () => {
      if (!isActive) return;
      
      if (uiMode !== 'voice' || voiceState === 'idle') {
        Animated.spring(orbPulseAnim, { toValue: 1, useNativeDriver: true }).start();
        return;
      }

      const minScale = 1.0;
      const maxScale = voiceState === 'speaking' ? 1.4 : 1.15;
      const randomAmplitude = Math.random() * (maxScale - minScale) + minScale;

      animRunner.current = Animated.spring(orbPulseAnim, {
        toValue: randomAmplitude,
        speed: 25,
        bounciness: 8,
        useNativeDriver: true,
      });

      animRunner.current.start(({ finished }) => {
        if (finished && isActive) simulateAudioWaveform();
      });
    };

    simulateAudioWaveform();

    return () => {
      isActive = false;
      animRunner.current?.stop();
    };
  }, [uiMode, voiceState, orbPulseAnim]);

  const toggleUiMode = (targetMode: 'chat' | 'voice') => {
    if (targetMode === 'voice') {
      setUiMode('voice');
      setVoiceState('listening');
      Animated.timing(voiceTransitionAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(voiceTransitionAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
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

    const temporaryId = Math.random().toString();
    setMessages(prev => [...prev, { id: temporaryId, role: 'user', text: userQuery }]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response: AiPlanResponse = await AiService.planRoute(
        sessionId,
        userQuery,
        undefined,
        undefined,
        -1.2921, 
        36.8219
      );

      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        text: response.spoken_response || '',
        route: response.route
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        text: "Sorry, I ran into an issue finding that route. Please try again soon."
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    // Optional: Add a small toast notification here
  };

  const handleMockVoiceInput = async () => {
    if (voiceState !== 'listening') return;
    
    setVoiceState('speaking');
    setHoldingPhrase("Checking matatus down to the stage...");

    try {
      const response: AiPlanResponse = await AiService.planRoute(
        sessionId,
        "How do I get from Westlands to Kencom?",
        undefined,
        undefined,
        -1.2644,
        36.8044
      );

      setHoldingPhrase(null);
      setMessages(prev => [
        ...prev,
        { id: Math.random().toString(), role: 'user', text: "How do I get from Westlands to Kencom?" },
        {
          id: Math.random().toString(),
          role: 'assistant',
          text: response.spoken_response || '',
          route: response.route
        }
      ]);

      setTimeout(() => setVoiceState('listening'), 5000);
    } catch (e) {
      setHoldingPhrase(null);
      setVoiceState('listening');
    }
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
                From <Text style={[styles.boldText, { color: C.text }]}>{leg.from.name}</Text> to <Text style={[styles.boldText, { color: C.text }]}>{leg.to.name}</Text> ({Math.round(leg.durationSeconds / 60)} mins)
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
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => Alert.alert('Settings', 'Voice preferences & language controls.')}
              >
                <Ionicons name="settings-outline" size={22} color={C.text} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => Alert.alert('Menu', 'Clear history, report an issue, or export data.')}
              >
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
                <View style={[
                  styles.messageBubble, 
                  msg.role === 'user' ? styles.userBubble : [styles.aiBubble, { backgroundColor: C.bubbleAI }]
                ]}>
                  <Text style={[styles.messageText, { color: msg.role === 'user' ? '#FFFFFF' : C.text }]}>
                    {msg.text}
                  </Text>
                </View>
                {msg.route && renderRouteDetails(msg.route)}

                {/* ChatGPT-style Utility Row for AI Responses */}
                {msg.role === 'assistant' && (
                  <View style={styles.bubbleUtilityRow}>
                    <TouchableOpacity onPress={() => copyToClipboard(msg.text)} hitSlop={10} style={styles.utilityIcon}>
                      <Ionicons name="copy-outline" size={16} color={C.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Listen', 'Triggering TTS playback...')} hitSlop={10} style={styles.utilityIcon}>
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
                multiline={false}
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
                {voiceState === 'listening' ? 'Listening...' : voiceState === 'speaking' ? 'Speaking...' : 'Connecting...'}
              </Text>
              
              <View style={styles.transcriptionWrapper}>
                <Text style={[styles.realtimeLiveText, { color: C.text }]}>
                  {holdingPhrase || (voiceState === 'listening' ? "Go ahead, tell me where you want to go..." : "Analyzing optimal route configurations across local networks...")}
                </Text>
              </View>
            </View>

            <View style={styles.voiceCenterCore}>
              <TouchableOpacity activeOpacity={0.9} onPress={handleMockVoiceInput}>
                <Animated.View style={[
                  styles.centralVoiceOrb,
                  { transform: [{ scale: orbPulseAnim }] },
                  voiceState === 'listening' && styles.orbListeningGlow,
                  voiceState === 'speaking' && styles.orbSpeakingGlow,
                ]}>
                   <Ionicons name="mic" size={48} color="#FFFFFF" style={styles.orbInnerIcon} />
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
  masterContainer: {
    flex: 1,
  },
  chatView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 8,
    marginLeft: -4,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  accentText: {
    color: ORANGE,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    marginLeft: 6,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  bubbleWrapper: {
    marginBottom: 16,
    width: '100%',
    flexDirection: 'column',
  },
  userWrapper: {
    alignItems: 'flex-end',
  },
  aiWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.82,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: ORANGE,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  bubbleUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 8,
    gap: 16,
  },
  utilityIcon: {
    padding: 2,
  },
  loaderBubble: {
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bottomInputDock: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputPillContainer: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  dockAddonButton: {
    marginRight: 4,
    padding: 4,
  },
  textInputField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  primaryActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeCard: {
    width: width * 0.85,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  routeHeadline: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  routeDuration: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: '700',
  },
  legRow: {
    flexDirection: 'row',
    minHeight: 45,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginRight: 12,
    width: 12,
  },
  indicatorNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  transitNode: {
    backgroundColor: ORANGE,
  },
  indicatorLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  legContent: {
    flex: 1,
    paddingBottom: 10,
  },
  legTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  legSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '500',
  },
  voiceFullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  voiceUpperTrack: {
    alignItems: 'center',
    marginTop: 20,
  },
  voiceAssistantName: {
    fontSize: 15,
    color: '#B3B3B3',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  voiceStatusIndicator: {
    fontSize: 13,
    color: ORANGE,
    marginTop: 4,
    fontWeight: '600',
  },
  transcriptionWrapper: {
    marginTop: 40,
    paddingHorizontal: 10,
  },
  realtimeLiveText: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '400',
  },
  voiceCenterCore: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralVoiceOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 15,
  },
  orbInnerIcon: {
    opacity: 0.9,
  },
  orbListeningGlow: {
    shadowRadius: 40,
    shadowOpacity: 0.8,
    backgroundColor: '#FF8F00',
  },
  orbSpeakingGlow: {
    shadowRadius: 30,
    shadowOpacity: 0.9,
  },
  voiceActionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  voiceSecondaryControl: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  controlDisabled: {
    opacity: 0.4,
  },
  voiceMicMasterCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  micMutedState: {
    backgroundColor: '#331A00',
    borderWidth: 1,
    borderColor: ORANGE,
  },
});