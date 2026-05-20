// components/app/KwameSheet.tsx
import { ChatMessage, KwameStatus, useKwame } from "@/hooks/useKwame";
import { Coords, getRouteColor, mToNice, sToMin } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";
const DARK   = "#1C1C1E";
const GREY   = "#8E8E93";
const LIGHT  = "#F2F2F7";
const WHITE  = "#FFFFFF";
const BORDER = "#E5E5EA";
const RED    = "#FF3B30";

const { height: SCREEN_H } = Dimensions.get("window");
const FULL_Y   = SCREEN_H * 0.10;
const PEEK_Y   = SCREEN_H * 0.52;
const HIDDEN_Y = SCREEN_H;

const NUM_BARS = 28;

interface KwameSheetProps {
  open: boolean;
  onClose: () => void;
  onStartJourney: (route: any) => void;
  me: Coords | null;
}

// ─── Audio waveform ───────────────────────────────────────────────────────────
// Bars react to meterLevel when listening, simulate speech when Kwame is speaking,
// and show a gentle ripple when processing.

function AudioWave({ status, meterLevel }: { status: KwameStatus; meterLevel: number }) {
  const bars       = useRef(Array.from({ length: NUM_BARS }, () => new Animated.Value(0.15))).current;
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef   = useRef(meterLevel);
  const phaseRef   = useRef(0);

  useEffect(() => { meterRef.current = meterLevel; }, [meterLevel]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    if (status === 'idle' || status === 'error') {
      bars.forEach(b =>
        Animated.spring(b, { toValue: 0.12, useNativeDriver: false, damping: 20 }).start(),
      );
      return;
    }

    tickRef.current = setInterval(() => {
      phaseRef.current += 0.18;
      const phase = phaseRef.current;

      bars.forEach((bar, i) => {
        let target: number;
        const pos = i / NUM_BARS; // 0..1 position along the bar array

        if (status === 'listening') {
          const m     = meterRef.current;
          const noise = (Math.random() - 0.5) * 0.25 * m;
          // Centre bars react more strongly than edges
          const shape = Math.sin(pos * Math.PI);
          target = 0.1 + shape * m * 0.85 + noise;
        } else if (status === 'processing') {
          // Smooth travelling sine wave — "thinking" ripple
          const wave = Math.sin(phase + pos * Math.PI * 3);
          target = 0.18 + 0.22 * ((wave + 1) / 2);
        } else {
          // speaking — energetic random with centre emphasis
          const shape = 0.4 + 0.6 * Math.sin(pos * Math.PI);
          target = 0.25 + shape * (0.55 + Math.random() * 0.45);
        }

        Animated.spring(bar, {
          toValue:        Math.max(0.08, Math.min(1, target)),
          useNativeDriver: false,
          damping:         12,
          stiffness:       280,
        }).start();
      });
    }, 60);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [status, bars]);

  const barColor = status === 'processing' ? GREY : ORANGE;

  return (
    <View style={aw.row}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            aw.bar,
            {
              backgroundColor: barColor,
              height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 80] }),
              opacity: status === 'processing' ? 0.55 : 0.9,
            },
          ]}
        />
      ))}
    </View>
  );
}

const aw = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems:    "center",
    justifyContent: "center",
    gap:           3,
    height:        88,
    paddingHorizontal: 20,
  },
  bar: {
    width:        4,
    borderRadius: 2,
    flex:         1,
    maxWidth:     6,
  },
});

// ─── Voice session overlay ────────────────────────────────────────────────────

function VoiceOverlay({
  status,
  meterLevel,
  lastKwameText,
  isCaptionStreaming,
  onStop,
  onFlipToText,
  onEnd,
}: {
  status:             KwameStatus;
  meterLevel:         number;
  lastKwameText:      string;
  isCaptionStreaming: boolean;
  onStop:             () => void;
  onFlipToText:       () => void;
  onEnd:              () => void;
}) {
  const pulseScale       = useRef(new Animated.Value(1)).current;
  const pulseOp          = useRef(new Animated.Value(0)).current;
  const captionScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (lastKwameText) {
      captionScrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [lastKwameText]);

  useEffect(() => {
    if (status === "listening") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1.75, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseOp,   { toValue: 0,    duration: 900, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1,    duration: 0, useNativeDriver: true }),
            Animated.timing(pulseOp,   { toValue: 0.28, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseScale.setValue(1);
    pulseOp.setValue(0);
  }, [status, pulseScale, pulseOp]);

  const statusLabels: Record<KwameStatus, string> = {
    idle:       "Tap to speak",
    listening:  "Listening…",
    processing: "Thinking…",
    speaking:   "Kwame is speaking",
    error:      "Something went wrong",
  };

  const micBtnBg =
    status === "listening"  ? "#FFF0E0" :
    status === "processing" ? "#F2F2F7" :
    status === "speaking"   ? "#FFF0E0" :
    ORANGE;

  const micIconColor =
    status === "listening" || status === "speaking" ? ORANGE : WHITE;

  const micIcon: React.ComponentProps<typeof Ionicons>["name"] =
    status === "listening"  ? "stop"           :
    status === "processing" ? "ellipsis-horizontal" :
    status === "speaking"   ? "volume-medium"  :
    "mic";

  // Tapping mic also interrupts Kwame mid-speech in continuous voice mode
  const canTapMic = status === "idle" || status === "listening" || status === "error" || status === "speaking";

  return (
    <View style={vo.container}>
      {/* Status pill */}
      <View style={vo.statusPill}>
        <View style={[vo.statusDot, { backgroundColor: status === "listening" ? "#34C759" : status === "error" ? RED : ORANGE }]} />
        <Text style={vo.statusLabel}>{statusLabels[status]}</Text>
      </View>

      {/* Waveform — full width, centred vertically */}
      <View style={vo.waveContainer}>
        <AudioWave status={status} meterLevel={meterLevel} />
      </View>

      {/* Caption area — white background, scrollable */}
      <View style={vo.captionArea}>
        <ScrollView
          ref={captionScrollRef}
          style={vo.captionScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[vo.captionText, !lastKwameText && vo.captionPlaceholder]}>
            {lastKwameText || "Kwame is ready…"}
            {isCaptionStreaming && <StreamingCursor color={DARK} />}
          </Text>
        </ScrollView>
      </View>

      {/* Primary mic button */}
      <View style={vo.micArea}>
        <Animated.View
          style={[vo.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOp }]}
        />
        <Pressable
          onPress={canTapMic ? onStop : undefined}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [
            vo.micBtn,
            { backgroundColor: micBtnBg, opacity: pressed ? 0.82 : 1 },
            (status === "listening" || status === "speaking") && vo.micBtnActive,
          ]}
        >
          <Ionicons name={micIcon} size={32} color={micIconColor} />
        </Pressable>
      </View>

      {/* Secondary controls */}
      <View style={vo.secondaryRow}>
        <Pressable
          onPress={onEnd}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={({ pressed }) => [vo.secondaryBtn, vo.endBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="close-circle-outline" size={18} color={RED} />
          <Text style={[vo.secondaryLabel, { color: RED }]}>End Session</Text>
        </Pressable>

        <Pressable
          onPress={onFlipToText}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={({ pressed }) => [vo.secondaryBtn, vo.textBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={DARK} />
          <Text style={[vo.secondaryLabel, { color: DARK }]}>Text Chat</Text>
        </Pressable>
      </View>
    </View>
  );
}

const vo = StyleSheet.create({
  container: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingTop:        16,
    paddingBottom:     24,
    paddingHorizontal: 20,
    backgroundColor:   WHITE,
  },
  statusPill: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             7,
    backgroundColor: LIGHT,
    borderRadius:    20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth:     1,
    borderColor:     BORDER,
  },
  statusDot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize:   13,
    fontWeight: "600",
    color:      DARK,
  },
  waveContainer: {
    flex:           1,
    width:          "100%",
    alignItems:     "center",
    justifyContent: "center",
  },
  captionArea: {
    width:              "100%",
    paddingHorizontal:  12,
    paddingVertical:    8,
    minHeight:          96,
    maxHeight:          120,
    marginBottom:       20,
  },
  captionScroll: {
    flexGrow: 0,
  },
  captionText: {
    fontSize:      18,
    fontWeight:    "600",
    color:         DARK,
    textAlign:     "center",
    lineHeight:    26,
    letterSpacing: 0.1,
  },
  captionPlaceholder: {
    opacity: 0.28,
  },
  micArea: {
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   28,
  },
  pulseRing: {
    position:        "absolute",
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: ORANGE,
  },
  micBtn: {
    width:          88,
    height:         88,
    borderRadius:   44,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOpacity:  0.16,
    shadowRadius:   14,
    shadowOffset:   { width: 0, height: 6 },
    elevation:      10,
  },
  micBtnActive: {
    borderWidth: 2,
    borderColor: ORANGE,
  },
  secondaryRow: {
    flexDirection: "row",
    gap:           12,
    width:         "100%",
  },
  secondaryBtn: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 20,
    borderRadius:    16,
    gap:             8,
    borderWidth:     1,
  },
  endBtn: {
    backgroundColor: "#FFF1F0",
    borderColor:     "#FECACA",
  },
  textBtn: {
    backgroundColor: LIGHT,
    borderColor:     BORDER,
  },
  secondaryLabel: {
    fontSize:   14,
    fontWeight: "600",
  },
});

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: -5, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue:  0, duration: 280, useNativeDriver: true }),
          Animated.delay(560),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [dots]);

  return (
    <View style={td.row}>
      <Image source={require("@/assets/images/kwame.png")} style={td.avatar} />
      <View style={td.bubble}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[td.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
}

const td = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "flex-end", marginBottom: 20, paddingHorizontal: 16 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: LIGHT },
  bubble: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: LIGHT, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 13 },
  dot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREY },
});

// ─── Streaming cursor ─────────────────────────────────────────────────────────

function StreamingCursor({ color = DARK }: { color?: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [opacity]);
  return <Animated.Text style={{ opacity, color, fontSize: 15 }}>▋</Animated.Text>;
}

// ─── Audio bubble (playback) ──────────────────────────────────────────────────

function AudioBubble({ audioUri }: { audioUri?: string }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const handleToggle = useCallback(async () => {
    if (!audioUri) return;
    try {
      if (playing) {
        await soundRef.current?.pauseAsync();
        setPlaying(false);
      } else {
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate(st => {
            if (st.isLoaded && st.didJustFinish) {
              setPlaying(false);
              soundRef.current?.unloadAsync();
              soundRef.current = null;
            }
          });
        }
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch (e) {
      console.warn("Audio playback error", e);
    }
  }, [audioUri, playing]);

  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);

  const bars = [0.40, 0.72, 0.95, 0.62, 0.85, 0.50, 0.78, 0.42, 0.67, 0.35];

  return (
    <View style={[s.msgRow, s.userRow]}>
      <View style={[s.bubble, s.userBubble, ab.wrap]}>
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [ab.playBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name={playing ? "pause" : "play"} size={13} color={WHITE} />
        </Pressable>
        <View style={ab.wave}>
          {bars.map((h, i) => (
            <View key={i} style={[ab.bar, { height: h * 22 }]} />
          ))}
        </View>
        <Text style={ab.dur}>0:04</Text>
      </View>
    </View>
  );
}

const ab = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  playBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  wave: { flexDirection: "row", alignItems: "center", gap: 2.5, flex: 1 },
  bar:  { width: 3, backgroundColor: "rgba(255,255,255,0.65)", borderRadius: 2 },
  dur:  { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "500", flexShrink: 0 },
});

// ─── Route card ───────────────────────────────────────────────────────────────

function RouteCard({ item, onPress }: { item: ChatMessage; onPress: () => void }) {
  const data        = item.routeData;
  const segments: any[] = data?.segments ?? [];
  const transitSegs = segments.filter(s => s.mode !== "WALK");

  return (
    <View style={rc.card}>
      <View style={rc.header}>
        <View style={rc.iconBox}>
          <Ionicons name="bus" size={15} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rc.title} numberOfLines={2}>{data?.summary}</Text>
          {transitSegs.length > 0 && (
            <Text style={rc.subtitle}>
              {transitSegs.length} {transitSegs.length === 1 ? "matatu line" : "matatu lines"}
            </Text>
          )}
        </View>
      </View>

      {segments.length > 0 && (
        <View style={rc.strip}>
          {segments.map((seg, i) => {
            const isWalk  = seg.mode === "WALK";
            const color   = isWalk ? "#C7C7CC" : getRouteColor(seg.route_name ?? "");
            const isFirst = i === 0;
            const isLast  = i === segments.length - 1;
            return (
              <View
                key={i}
                style={[
                  rc.stripSeg,
                  { backgroundColor: color, flex: isWalk ? 0.5 : 1 },
                  isFirst && { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
                  isLast  && { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
                ]}
              />
            );
          })}
        </View>
      )}

      <View style={rc.metrics}>
        <View style={rc.metric}>
          <Ionicons name="time-outline" size={12} color={GREY} />
          <Text style={rc.metricText}>{sToMin(data?.total_duration ?? 0)}</Text>
        </View>
        <View style={rc.sep} />
        <View style={rc.metric}>
          <Ionicons name="walk-outline" size={12} color={GREY} />
          <Text style={rc.metricText}>{mToNice(data?.total_walk_distance ?? 0)} walk</Text>
        </View>
        {transitSegs.length > 1 && (
          <>
            <View style={rc.sep} />
            <View style={rc.metric}>
              <Ionicons name="git-branch-outline" size={12} color={GREY} />
              <Text style={rc.metricText}>{transitSegs.length - 1} transfer{transitSegs.length > 2 ? "s" : ""}</Text>
            </View>
          </>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [rc.btn, { opacity: pressed ? 0.82 : 1 }]}
        onPress={onPress}
      >
        <Ionicons name="navigate" size={14} color={WHITE} />
        <Text style={rc.btnText}>Preview on Map</Text>
      </Pressable>
    </View>
  );
}

const rc = StyleSheet.create({
  card: {
    backgroundColor: WHITE, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    padding: 16, width: "88%", marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  header:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  iconBox:    { width: 30, height: 30, borderRadius: 9, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  title:      { fontSize: 14, fontWeight: "700", color: DARK, lineHeight: 19 },
  subtitle:   { fontSize: 11, color: GREY, marginTop: 2, fontWeight: "500" },
  strip:      { flexDirection: "row", height: 6, borderRadius: 4, overflow: "hidden", marginBottom: 12, gap: 2 },
  stripSeg:   { height: "100%" },
  metrics:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  metric:     { flexDirection: "row", alignItems: "center", gap: 4 },
  metricText: { fontSize: 12, color: GREY, fontWeight: "500" },
  sep:        { width: 3, height: 3, borderRadius: 1.5, backgroundColor: GREY },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: ORANGE, paddingVertical: 12, borderRadius: 14,
  },
  btnText: { color: WHITE, fontWeight: "700", fontSize: 14 },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onChipPress }: { onChipPress: (text: string) => void }) {
  const chips = ["How do I get to CBD?", "Fastest route to Westlands", "Bus to JKIA"];
  return (
    <View style={es.wrap}>
      <View style={es.avatarRing}>
        <Image source={require("@/assets/images/kwame.png")} style={es.avatar} />
      </View>
      <Text style={es.title}>Ask Kwame anything</Text>
      <Text style={es.sub}>{"Plan your matatu trip, find routes,\nor get transit advice for Nairobi."}</Text>
      <View style={es.chips}>
        {chips.map(chip => (
          <Pressable
            key={chip}
            style={({ pressed }) => [es.chip, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => onChipPress(chip)}
          >
            <Text style={es.chipText}>{chip}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40, gap: 12 },
  avatarRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatar:     { width: 52, height: 52, borderRadius: 26 },
  title:      { fontSize: 20, fontWeight: "700", color: DARK, letterSpacing: -0.3 },
  sub:        { fontSize: 14, color: GREY, textAlign: "center", lineHeight: 21 },
  chips:      { flexDirection: "column", gap: 8, marginTop: 8, width: "100%" },
  chip: {
    backgroundColor: LIGHT, borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 16, borderWidth: 1, borderColor: BORDER,
  },
  chipText: { fontSize: 14, color: DARK, fontWeight: "500" },
});

// ─── Main sheet ───────────────────────────────────────────────────────────────

export default function KwameSheet({ open, onClose, me, onStartJourney }: KwameSheetProps) {
  const insets      = useSafeAreaInsets();
  const animatedTop = useRef(new Animated.Value(HIDDEN_Y)).current;
  const currentTop  = useRef(HIDDEN_Y);
  const keyboardH   = useRef(new Animated.Value(0)).current;
  const [isKbVisible, setKbVisible] = useState(false);
  const [inputText, setInputText]   = useState("");
  const flatListRef = useRef<FlatList>(null);

  const {
    messages, status, meterLevel, voiceMode, lastKwameText, isCaptionStreaming,
    toggleRecording, submitText, clearChat, exitVoiceMode,
  } = useKwame(me);

  // ── Keyboard engine ───────────────────────────────────────────────────────
  // iOS: animate keyboardH in sync with the keyboard using keyboardWill* events.
  // Android: edgeToEdgeEnabled + adjustResize shrinks the window automatically,
  // so keyboardH stays 0 and the panel bottom naturally sits above the keyboard.
  useEffect(() => {
    const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEv, e => {
      setKbVisible(true);
      if (currentTop.current >= PEEK_Y) {
        Animated.spring(animatedTop, { toValue: FULL_Y, useNativeDriver: false, damping: 24 }).start();
        currentTop.current = FULL_Y;
      }
      if (Platform.OS === "ios") {
        Animated.timing(keyboardH, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
      }
    });

    const hide = Keyboard.addListener(hideEv, e => {
      setKbVisible(false);
      if (Platform.OS === "ios") {
        Animated.timing(keyboardH, { toValue: 0, duration: e.duration || 250, useNativeDriver: false }).start();
      }
    });

    return () => { show.remove(); hide.remove(); };
  }, [animatedTop, keyboardH]);

  // ── Pan responder ─────────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderMove: (_, gs) => {
        animatedTop.setValue(Math.max(FULL_Y, currentTop.current + gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        const dest = currentTop.current + gs.dy;
        let target: number;
        if      (gs.vy < -0.5 || gs.dy < -50) target = FULL_Y;
        else if (gs.vy >  0.5 || gs.dy >  50) target = PEEK_Y;
        else target = Math.abs(dest - FULL_Y) < Math.abs(dest - PEEK_Y) ? FULL_Y : PEEK_Y;
        if (target === PEEK_Y) Keyboard.dismiss();
        Animated.spring(animatedTop, { toValue: target, useNativeDriver: false, damping: 24, stiffness: 250 }).start();
        currentTop.current = target;
      },
    })
  ).current;

  // ── Open / close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && currentTop.current === HIDDEN_Y) {
      Animated.spring(animatedTop, { toValue: PEEK_Y, useNativeDriver: false, damping: 24, stiffness: 250 }).start();
      currentTop.current = PEEK_Y;
    } else if (!open) {
      Keyboard.dismiss();
      Animated.timing(animatedTop, { toValue: HIDDEN_Y, duration: 250, useNativeDriver: false }).start();
      currentTop.current = HIDDEN_Y;
    }
  }, [open, animatedTop]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, status]);

  useEffect(() => {
    if (isKbVisible) {
      const delay = Platform.OS === "ios" ? 300 : 120;
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), delay);
      return () => clearTimeout(t);
    }
  }, [isKbVisible]);

  // When voice mode activates, expand to full height
  useEffect(() => {
    if (voiceMode) {
      Animated.spring(animatedTop, { toValue: FULL_Y, useNativeDriver: false, damping: 24, stiffness: 250 }).start();
      currentTop.current = FULL_Y;
      Keyboard.dismiss();
    }
  }, [voiceMode, animatedTop]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!inputText.trim()) return;
    submitText(inputText);
    setInputText("");
  };

  const handleVoice = () => {
    if (status === "idle" || status === "error") {
      Keyboard.dismiss();
    }
    toggleRecording();
  };

  const handleStartRoute = useCallback((routeData: any) => {
    Keyboard.dismiss();
    onStartJourney(routeData);
    Animated.spring(animatedTop, { toValue: PEEK_Y, useNativeDriver: false }).start();
    currentTop.current = PEEK_Y;
  }, [onStartJourney, animatedTop]);

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.timing(animatedTop, { toValue: HIDDEN_Y, duration: 250, useNativeDriver: false }).start(() => {
      onClose();
      currentTop.current = HIDDEN_Y;
    });
  };

  const handleChip = (text: string) => {
    Animated.spring(animatedTop, { toValue: FULL_Y, useNativeDriver: false, damping: 24, stiffness: 250 }).start();
    currentTop.current = FULL_Y;
    submitText(text);
  };

  const handleExitVoice = () => {
    exitVoiceMode();
    // Ensure the sheet stays visible in text mode
    if (currentTop.current > PEEK_Y) {
      Animated.spring(animatedTop, { toValue: PEEK_Y, useNativeDriver: false, damping: 24 }).start();
      currentTop.current = PEEK_Y;
    }
  };

  // ── Message renderer ──────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";

    if (item.type === "audio") {
      return <AudioBubble audioUri={item.audioUri} />;
    }

    if (item.type === "route_card" && item.routeData) {
      return (
        <View style={s.assistantRow}>
          <Image source={require("@/assets/images/kwame.png")} style={s.avatar} />
          <RouteCard item={item} onPress={() => handleStartRoute(item.routeData)} />
        </View>
      );
    }

    return (
      <View style={[s.msgRow, isUser ? s.userRow : s.assistantRow]}>
        {!isUser && <Image source={require("@/assets/images/kwame.png")} style={s.avatar} />}
        <View style={[s.bubble, isUser ? s.userBubble : s.kwameBubble]}>
          <Text style={isUser ? s.userText : s.kwameText}>
            {item.content}
            {item.isStreaming && !isUser && <StreamingCursor />}
          </Text>
        </View>
      </View>
    );
  }, [handleStartRoute]);

  const isProcessing = status === "processing";

  return (
    <Animated.View style={[s.panel, { top: animatedTop, bottom: voiceMode ? 0 : keyboardH }]}>

      {/* ── HEADER ── */}
      <View
        {...(!voiceMode ? pan.panHandlers : {})}
        style={s.headerArea}
      >
        {!voiceMode && <View style={s.handle} />}
        <View style={[s.headerBar, voiceMode && { marginTop: 10 }]}>
          <Pressable onPress={handleClose} hitSlop={14} style={s.headerBtn}>
            <Ionicons name="close" size={20} color={GREY} />
          </Pressable>
          <View style={s.headerCenter}>
            <View style={s.headerAvatarRing}>
              <Image source={require("@/assets/images/kwame.png")} style={s.headerAvatar} />
            </View>
            <Text style={s.headerTitle}>Kwame</Text>
          </View>
          <Pressable onPress={clearChat} hitSlop={14} style={s.headerBtn}>
            <Ionicons name="create-outline" size={20} color={DARK} />
          </Pressable>
        </View>
      </View>

      {/* ── BODY ── */}
      {voiceMode ? (
        <VoiceOverlay
          status={status}
          meterLevel={meterLevel}
          lastKwameText={lastKwameText}
          isCaptionStreaming={isCaptionStreaming}
          onStop={handleVoice}
          onFlipToText={handleExitVoice}
          onEnd={handleClose}
        />
      ) : (
        <>
          <View style={s.body}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[s.chatContent, messages.length === 0 && { flex: 1 }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              ListEmptyComponent={
                !isProcessing
                  ? <EmptyState onChipPress={handleChip} />
                  : <View style={{ height: 16 }} />
              }
              ListFooterComponent={isProcessing ? <TypingDots /> : null}
            />
          </View>

          {/* ── INPUT BAR ── */}
          <View style={[s.inputArea, { paddingBottom: isKbVisible ? 8 : Math.max(insets.bottom, 12) }]}>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="Ask Kwame…"
                placeholderTextColor={GREY}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline
                maxLength={200}
              />
              {inputText.trim().length > 0 ? (
                <Pressable
                  style={({ pressed }) => [s.sendBtn, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleSend}
                >
                  <Ionicons name="arrow-up" size={18} color={WHITE} />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [s.micBtn, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleVoice}
                >
                  <Ionicons name="mic" size={19} color={WHITE} />
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0, right: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius:  20,
    elevation:     24,
    zIndex:        100,
    overflow:      "hidden",
  },

  headerArea: { paddingBottom: 10 },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D1D6",
    alignSelf: "center", marginTop: 10, marginBottom: 14,
  },
  headerBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter:     { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatarRing: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center" },
  headerAvatar:     { width: 26, height: 26, borderRadius: 13 },
  headerTitle:      { fontSize: 17, fontWeight: "700", color: DARK },

  body:        { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  msgRow:       { flexDirection: "row", marginBottom: 10, alignItems: "flex-end" },
  userRow:      { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start", alignItems: "flex-end" },

  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: LIGHT, flexShrink: 0 },

  bubble:      { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20 },
  userBubble:  { backgroundColor: DARK, borderBottomRightRadius: 4 },
  kwameBubble: { backgroundColor: LIGHT, borderBottomLeftRadius: 4 },

  userText:  { fontSize: 15, color: WHITE, lineHeight: 22 },
  kwameText: { fontSize: 15, color: DARK,  lineHeight: 22 },

  inputArea: {
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
    backgroundColor: WHITE,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1, backgroundColor: LIGHT, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 15, color: DARK, maxHeight: 100,
    borderWidth: 1, borderColor: BORDER,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: DARK, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
});
