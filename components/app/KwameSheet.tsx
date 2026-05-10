// components/app/KwameSheet.tsx
import { useKwame, ChatMessage } from "@/hooks/useKwame";
import { Coords, mToNice, sToMin } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";
const BLACK = "#1C1C1E";
const GREY = "#8E8E93";
const LIGHT_GREY = "#F2F2F7";
const BG_WHITE = "#FFFFFF";

const { height: SCREEN_H } = Dimensions.get("window");

const FULL_Y = SCREEN_H * 0.12;   
const PEEK_Y = SCREEN_H * 0.55;   
const HIDDEN_Y = SCREEN_H;        

interface KwameSheetProps {
  open: boolean;
  onClose: () => void;
  onStartJourney: (route: any) => void;
  me: Coords | null;
}

const AudioWaveform = () => (
    <View style={styles.waveformContainer}>
        {[12, 18, 10, 24, 16, 8, 20, 14, 10].map((height, i) => (
            <View key={i} style={[styles.waveBar, { height }]} />
        ))}
    </View>
);

export default function KwameSheet({ open, onClose, me, onStartJourney }: KwameSheetProps) {
  const insets = useSafeAreaInsets();
  
  const animatedTop = useRef(new Animated.Value(HIDDEN_Y)).current;
  const currentTop = useRef(HIDDEN_Y);
  
  // ─── NEW: Manual Keyboard Tracking ───
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { messages, status, toggleRecording, submitText, clearChat } = useKwame(me);

  // ─── KEYBOARD UX ENGINE ───
  useEffect(() => {
    // iOS uses 'Will' for smooth animation, Android uses 'Did'
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      
      // Auto-expand the sheet if the user taps the input while in Peek mode
      if (currentTop.current === PEEK_Y) {
          Animated.spring(animatedTop, { toValue: FULL_Y, useNativeDriver: false, damping: 24 }).start();
          currentTop.current = FULL_Y;
      }

      // Smoothly push the bottom of the sheet up
      if (Platform.OS === 'ios') {
          Animated.timing(keyboardHeight, {
            toValue: e.endCoordinates.height,
            duration: e.duration || 250,
            useNativeDriver: false,
          }).start();
      }
    });

    const hideSubscription = Keyboard.addListener(hideEvent, (e) => {
      setIsKeyboardVisible(false);
      
      if (Platform.OS === 'ios') {
          Animated.timing(keyboardHeight, {
            toValue: 0,
            duration: e.duration || 250,
            useNativeDriver: false,
          }).start();
      }
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // ─── GESTURE LOGIC ───
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderMove: (_, gs) => {
        animatedTop.setValue(Math.max(FULL_Y, currentTop.current + gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        const destY = currentTop.current + gs.dy;
        let targetY = currentTop.current;

        if (gs.vy < -0.5 || gs.dy < -50) targetY = FULL_Y; 
        else if (gs.vy > 0.5 || gs.dy > 50) targetY = PEEK_Y; 
        else {
          const dFull = Math.abs(destY - FULL_Y);
          const dPeek = Math.abs(destY - PEEK_Y);
          targetY = dFull < dPeek ? FULL_Y : PEEK_Y;
        }

        // Hide keyboard if they swipe the sheet down
        if (targetY === PEEK_Y) Keyboard.dismiss();

        Animated.spring(animatedTop, { 
            toValue: targetY, 
            useNativeDriver: false, 
            damping: 24, 
            stiffness: 250 
        }).start();
        
        currentTop.current = targetY;
      },
    })
  ).current;

  // ─── LIFECYCLE ───
  useEffect(() => {
    if (open && currentTop.current === HIDDEN_Y) {
      Animated.spring(animatedTop, { toValue: PEEK_Y, useNativeDriver: false, damping: 24, stiffness: 250 }).start();
      currentTop.current = PEEK_Y;
    } else if (!open) {
      Keyboard.dismiss(); // Ensure keyboard closes if sheet closes entirely
      Animated.timing(animatedTop, { toValue: HIDDEN_Y, duration: 250, useNativeDriver: false }).start();
      currentTop.current = HIDDEN_Y;
    }
  }, [open]);

  useEffect(() => {
    if (messages.length > 0 || status !== 'idle') {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, status, isKeyboardVisible]); // Added keyboard dependency so it scrolls to latest message when keyboard opens

  // ─── ACTION HANDLERS ───
  const handleSendText = () => {
    submitText(inputText);
    setInputText("");
  };

  const handleStartRoute = (routeData: any) => {
      Keyboard.dismiss();
      onStartJourney(routeData);
      Animated.spring(animatedTop, { toValue: PEEK_Y, useNativeDriver: false }).start();
      currentTop.current = PEEK_Y;
  };

  const handleCloseTrigger = () => {
      Keyboard.dismiss();
      Animated.timing(animatedTop, { toValue: HIDDEN_Y, duration: 250, useNativeDriver: false }).start(() => {
          onClose();
          currentTop.current = HIDDEN_Y;
      });
  };

  // ─── RENDER MESSAGES ───
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    if (item.type === 'route_card' && item.routeData) {
        return (
            <View style={styles.assistantRow}>
                <View style={styles.avatarSpacer} />
                <View style={styles.routeCard}>
                    <View style={styles.routeHeader}>
                        <Ionicons name="bus" size={20} color={ORANGE} />
                        <Text style={styles.routeTitle}>{item.routeData.summary}</Text>
                    </View>
                    <Text style={styles.routeMetrics}>
                        {sToMin(item.routeData.total_duration)} • {mToNice(item.routeData.total_walk_distance)} walk
                    </Text>
                    <Pressable style={styles.startBtn} onPress={() => handleStartRoute(item.routeData)}>
                        <Text style={styles.startBtnText}>Preview on Map</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (item.type === 'audio') {
        return (
            <View style={[styles.messageRow, styles.userRow]}>
                <View style={[styles.bubble, styles.userBubble, styles.audioBubble]}>
                    <Ionicons name="play-circle" size={28} color={BLACK} style={{ marginRight: 8 }} />
                    <AudioWaveform />
                    <Text style={styles.audioDurationText}>0:04</Text>
                </View>
            </View>
        );
    }

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
            <Image source={require("@/assets/images/kwame.png")} style={styles.msgAvatar} />
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    // ── We animate BOTH 'top' and 'bottom' dynamically now ──
    <Animated.View style={[styles.panel, { top: animatedTop, bottom: keyboardHeight }]}>
      <View {...panResponder.panHandlers} style={styles.headerArea}>
        <View style={styles.handle} />
        <View style={styles.headerBar}>
            <Pressable onPress={clearChat} style={styles.headerIconBtn}>
                <Ionicons name="create-outline" size={24} color={GREY} />
            </Pressable>
            <Text style={styles.headerTitle}>Kwame</Text>
            <Pressable onPress={handleCloseTrigger} style={styles.headerIconBtn}>
                <Ionicons name="close" size={24} color={GREY} />
            </Pressable>
        </View>
      </View>

      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag" // Dismiss keyboard if user scrolls history
          ListFooterComponent={() => (
             <>
                {status === 'processing' && (
                    <View style={styles.loadingRow}>
                        <Image source={require("@/assets/images/kwame.png")} style={styles.msgAvatar} />
                        <ActivityIndicator size="small" color={GREY} style={{ marginLeft: 8 }} />
                    </View>
                )}
                {status === 'listening' && (
                    <View style={[styles.messageRow, styles.userRow]}>
                        <View style={[styles.bubble, styles.userBubble, styles.recordingBubble]}>
                            <View style={styles.pulsingDot} />
                            <Text style={styles.recordingText}>Recording...</Text>
                        </View>
                    </View>
                )}
             </>
          )}
        />

        {/* Dynamic padding: If keyboard is visible, remove the big bottom inset so it sits flush! */}
        <View style={[styles.inputRow, { paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom, 16) }]}>
            <View style={styles.textInputWrapper}>
                <TextInput
                    style={styles.textInput}
                    placeholder="Message Kwame..."
                    placeholderTextColor={GREY}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSendText}
                    returnKeyType="send"
                    multiline
                    maxLength={200}
                />
                {inputText.length > 0 ? (
                    <Pressable style={styles.sendBtn} onPress={handleSendText}>
                        <Ionicons name="arrow-up" size={18} color="#FFF" />
                    </Pressable>
                ) : (
                    <Pressable 
                        style={[styles.micBtn, status === 'listening' && styles.micBtnActive]} 
                        onPress={toggleRecording}
                    >
                        <Ionicons name={status === 'listening' ? 'stop' : 'mic'} size={20} color="#FFF" />
                    </Pressable>
                )}
            </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0, right: 0, 
    backgroundColor: BG_WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 100,
  },
  container: { flex: 1 },
  headerArea: { paddingBottom: 8 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "#D1D1D6", alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: BLACK },
  headerIconBtn: { padding: 4 },
  
  chatContent: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 10 },
  
  messageRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: LIGHT_GREY },
  avatarSpacer: { width: 36 }, 
  
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  userBubble: { backgroundColor: LIGHT_GREY, borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: BG_WHITE }, 
  
  messageText: { fontSize: 16, color: BLACK, lineHeight: 22 },
  userMessageText: { color: BLACK },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },

  audioBubble: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  waveformContainer: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 12 },
  waveBar: { width: 3, backgroundColor: '#A1A1AA', borderRadius: 2 },
  audioDurationText: { fontSize: 13, color: '#52525B', fontWeight: '500' },
  
  recordingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2' },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
  recordingText: { fontSize: 15, color: '#EF4444', fontWeight: '500' },
  
  routeCard: {
      backgroundColor: '#FAFAFA',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E5E5EA',
      padding: 16,
      width: '85%',
      marginBottom: 16,
  },
  routeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  routeTitle: { fontSize: 16, fontWeight: '700', color: BLACK, marginLeft: 8 },
  routeMetrics: { fontSize: 14, color: GREY, marginBottom: 14 },
  startBtn: { backgroundColor: BLACK, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  startBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  inputRow: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F2F2F7', backgroundColor: BG_WHITE },
  textInputWrapper: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: LIGHT_GREY, borderRadius: 24, paddingLeft: 16, paddingRight: 6, minHeight: 48, paddingBottom: 6 },
  textInput: { flex: 1, fontSize: 16, color: BLACK, paddingTop: 10, paddingBottom: 10, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BLACK, alignItems: 'center', justifyContent: 'center' },
  micBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BLACK, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: '#EF4444' },
});