// app/kwame.tsx, full-screen AI assistant screen
import { ChatMessage, KwameStatus, useKwame } from "@/hooks/useKwame";
import { UnifiedLocation, useJourneyStore } from "@/store/journeyStore";
import { Coords, getRouteColor, mToNice, sToMin } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE   = "#FF6F00";
const DARK     = "#1C1C1E";
const GREY     = "#8E8E93";
const LIGHT    = "#F2F2F7";
const WHITE    = "#FFFFFF";
const BORDER   = "#E5E5EA";
const RED      = "#FF3B30";
const WARM     = "#FFF8F0";
const NUM_BARS = 36;

// ─── AudioWave ────────────────────────────────────────────────────────────────

function AudioWave({ status, meterLevel }: { status: KwameStatus; meterLevel: number }) {
  const bars     = useRef(Array.from({ length: NUM_BARS }, () => new Animated.Value(0.12))).current;
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef = useRef(meterLevel);
  const phaseRef = useRef(0);

  useEffect(() => { meterRef.current = meterLevel; }, [meterLevel]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (status === "idle" || status === "error") {
      bars.forEach(b =>
        Animated.spring(b, { toValue: 0.10, useNativeDriver: false, damping: 22 }).start()
      );
      return;
    }
    tickRef.current = setInterval(() => {
      phaseRef.current += 0.18;
      const phase = phaseRef.current;
      bars.forEach((bar, i) => {
        const pos = i / NUM_BARS;
        let target: number;
        if (status === "listening") {
          const m = meterRef.current;
          target = 0.08 + Math.sin(pos * Math.PI) * m * 0.9 + (Math.random() - 0.5) * 0.3 * m;
        } else if (status === "processing") {
          target = 0.16 + 0.24 * ((Math.sin(phase + pos * Math.PI * 3) + 1) / 2);
        } else {
          target = 0.25 + (0.4 + 0.6 * Math.sin(pos * Math.PI)) * (0.6 + Math.random() * 0.4);
        }
        Animated.spring(bar, {
          toValue: Math.max(0.06, Math.min(1, target)),
          useNativeDriver: false, damping: 12, stiffness: 280,
        }).start();
      });
    }, 60);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [status, bars]);

  const barColor = status === "processing" ? GREY : ORANGE;

  return (
    <View style={aw.row}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[aw.bar, {
            backgroundColor: barColor,
            height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 130] }),
            opacity: status === "processing" ? 0.5 : 0.88,
          }]}
        />
      ))}
    </View>
  );
}

const aw = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 3, height: 150, paddingHorizontal: 12,
  },
  bar: { width: 4, borderRadius: 2, flex: 1, maxWidth: 7 },
});

// ─── StreamingCursor ──────────────────────────────────────────────────────────

function StreamingCursor({ color = DARK }: { color?: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [opacity]);
  return <Animated.Text style={{ opacity, color, fontSize: 15 }}>▋</Animated.Text>;
}

// ─── TypingDots ───────────────────────────────────────────────────────────────

function TypingDots() {
  const dark     = useColorScheme() === "dark";
  const bubbleBg = dark ? "#2C2C2E" : WARM;
  const dots     = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 140),
        Animated.timing(dot, { toValue: -6, duration: 280, useNativeDriver: true }),
        Animated.timing(dot, { toValue:  0, duration: 280, useNativeDriver: true }),
        Animated.delay(560),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [dots]);

  return (
    <View style={td.row}>
      <Image source={require("@/assets/images/kwame.png")} style={td.avatar} />
      <View style={[td.bubble, { backgroundColor: bubbleBg }]}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[td.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
}

const td = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, marginBottom: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: LIGHT, flexShrink: 0 },
  bubble: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREY },
});

// ─── AudioBubble ──────────────────────────────────────────────────────────────

function AudioBubble({ audioUri }: { audioUri?: string }) {
  const [playing, setPlaying] = useState(false);
  const soundRef              = useRef<Audio.Sound | null>(null);
  const bars                  = [0.40, 0.72, 0.95, 0.62, 0.85, 0.50, 0.78, 0.42, 0.67, 0.35];

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
    } catch {}
  }, [audioUri, playing]);

  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);

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
          {bars.map((h, i) => <View key={i} style={[ab.bar, { height: h * 22 }]} />)}
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
    backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center",
  },
  wave: { flexDirection: "row", alignItems: "center", gap: 2.5, flex: 1 },
  bar:  { width: 3, backgroundColor: "rgba(255,255,255,0.65)", borderRadius: 2 },
  dur:  { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "500" },
});

// ─── RouteCard ────────────────────────────────────────────────────────────────

function RouteCard({ item, onPress }: { item: ChatMessage; onPress: () => void }) {
  const dark        = useColorScheme() === "dark";
  const cardBg      = dark ? "#1C1C1E" : WHITE;
  const cardBd      = dark ? "#2C2C2E" : BORDER;
  const titleColor  = dark ? WHITE : DARK;
  const iconBoxBg   = dark ? "rgba(255,111,0,0.18)" : "#FFF3E0";
  const data        = item.routeData;
  const segments: any[] = data?.segments ?? [];
  const transitSegs = segments.filter((seg: any) => seg.mode !== "WALK");

  return (
    <View style={[rc.card, { backgroundColor: cardBg, borderColor: cardBd }]}>
      <View style={rc.header}>
        <View style={[rc.iconBox, { backgroundColor: iconBoxBg }]}>
          <Ionicons name="bus" size={15} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rc.title, { color: titleColor }]} numberOfLines={2}>{data?.summary}</Text>
          {transitSegs.length > 0 && (
            <Text style={rc.subtitle}>
              {transitSegs.length} {transitSegs.length === 1 ? "matatu line" : "matatu lines"}
            </Text>
          )}
        </View>
      </View>

      {segments.length > 0 && (
        <View style={rc.strip}>
          {segments.map((seg: any, i: number) => {
            const isWalk = seg.mode === "WALK";
            const color  = isWalk ? "#C7C7CC" : getRouteColor(seg.route_name ?? "");
            return (
              <View
                key={i}
                style={[
                  rc.stripSeg,
                  { backgroundColor: color, flex: isWalk ? 0.5 : 1 },
                  i === 0 && { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
                  i === segments.length - 1 && { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
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
              <Text style={rc.metricText}>
                {transitSegs.length - 1} transfer{transitSegs.length > 2 ? "s" : ""}
              </Text>
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
    borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 4,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  header:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  iconBox:    { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  title:      { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  subtitle:   { fontSize: 11, color: GREY, marginTop: 2, fontWeight: "500" },
  strip:      { flexDirection: "row", height: 6, borderRadius: 4, overflow: "hidden", marginBottom: 12, gap: 2 },
  stripSeg:   { height: "100%" },
  metrics:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  metric:     { flexDirection: "row", alignItems: "center", gap: 4 },
  metricText: { fontSize: 12, color: GREY, fontWeight: "500" },
  sep:        { width: 3, height: 3, borderRadius: 1.5, backgroundColor: GREY },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: ORANGE, paddingVertical: 13, borderRadius: 14,
  },
  btnText: { color: WHITE, fontWeight: "700", fontSize: 14 },
});

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onChipPress }: { onChipPress: (text: string) => void }) {
  const dark = useColorScheme() === "dark";
  const EC = {
    title:   dark ? WHITE : DARK,
    chipBg:  dark ? "#2C2C2E" : LIGHT,
    chipBd:  dark ? "#3A3A3C" : BORDER,
    chipTxt: dark ? WHITE : DARK,
  };
  const chips = ["How do I get to CBD?", "Fastest route to Westlands", "Bus to JKIA"];

  return (
    <View style={es.wrap}>
      <View style={es.avatarRing}>
        <Image source={require("@/assets/images/kwame.png")} style={es.avatar} />
      </View>
      <Text style={[es.title, { color: EC.title }]}>Ask Kwame anything</Text>
      <Text style={es.sub}>{"Plan your matatu trip, find routes,\nor get transit advice for Nairobi."}</Text>
      <View style={es.chips}>
        {chips.map(chip => (
          <Pressable
            key={chip}
            style={({ pressed }) => [
              es.chip,
              { backgroundColor: EC.chipBg, borderColor: EC.chipBd },
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => onChipPress(chip)}
          >
            <Ionicons name="arrow-forward-circle-outline" size={16} color={ORANGE} />
            <Text style={[es.chipText, { color: EC.chipTxt }]}>{chip}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 48, gap: 14 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  avatar:     { width: 62, height: 62, borderRadius: 31 },
  title:      { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  sub:        { fontSize: 15, color: GREY, textAlign: "center", lineHeight: 23 },
  chips:      { gap: 10, marginTop: 8, width: "100%" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: "500", flex: 1 },
});

// ─── VoiceOverlay ─────────────────────────────────────────────────────────────

function VoiceOverlay({
  status, meterLevel, lastKwameText, isCaptionStreaming,
  onStop, onFlipToText, onEnd, safeTop, safeBottom,
}: {
  status:             KwameStatus;
  meterLevel:         number;
  lastKwameText:      string;
  isCaptionStreaming: boolean;
  onStop:             () => void;
  onFlipToText:       () => void;
  onEnd:              () => void;
  safeTop:            number;
  safeBottom:         number;
}) {
  const dark = useColorScheme() === "dark";
  const VC = {
    bg:      dark ? "#0F0F0F" : WHITE,
    pillBg:  dark ? "#2C2C2E" : LIGHT,
    pillBd:  dark ? "#3A3A3C" : BORDER,
    label:   dark ? WHITE : DARK,
    caption: dark ? WHITE : DARK,
    endBg:   dark ? "rgba(255,59,48,0.12)" : "#FFF1F0",
    endBd:   dark ? "rgba(255,59,48,0.28)" : "#FECACA",
    textBg:  dark ? "#2C2C2E" : LIGHT,
    textBd:  dark ? "#3A3A3C" : BORDER,
    textClr: dark ? WHITE : DARK,
    micIdle: dark ? "#2C2C2E" : LIGHT,
  };

  const pulseScale       = useRef(new Animated.Value(1)).current;
  const pulseOp          = useRef(new Animated.Value(0)).current;
  const captionScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (lastKwameText) captionScrollRef.current?.scrollToEnd({ animated: false });
  }, [lastKwameText]);

  useEffect(() => {
    if (status === "listening") {
      const loop = Animated.loop(Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.85, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOp,   { toValue: 0,    duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOp,   { toValue: 0.3,  duration: 0, useNativeDriver: true }),
        ]),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulseScale.setValue(1);
    pulseOp.setValue(0);
  }, [status, pulseScale, pulseOp]);

  const labels: Record<KwameStatus, string> = {
    idle:       "Tap to speak",
    listening:  "Listening…",
    processing: "Thinking…",
    speaking:   "Kwame is speaking",
    error:      "Something went wrong",
  };

  const micBg =
    status === "listening"  ? "#FFF0E0" :
    status === "processing" ? VC.micIdle :
    status === "speaking"   ? "#FFF0E0" :
    ORANGE;

  const micIconColor = status === "listening" || status === "speaking" ? ORANGE : WHITE;

  const micIcon: React.ComponentProps<typeof Ionicons>["name"] =
    status === "listening"  ? "stop"                :
    status === "processing" ? "ellipsis-horizontal" :
    status === "speaking"   ? "volume-medium"       :
    "mic";

  const canTapMic = status === "idle" || status === "listening" || status === "error" || status === "speaking";
  const dotColor  = status === "listening" ? "#34C759" : status === "error" ? RED : ORANGE;

  return (
    <View style={[vo.container, { backgroundColor: VC.bg, paddingTop: safeTop + 20, paddingBottom: safeBottom + 24 }]}>
      <View style={[vo.pill, { backgroundColor: VC.pillBg, borderColor: VC.pillBd }]}>
        <View style={[vo.dot, { backgroundColor: dotColor }]} />
        <Text style={[vo.pillText, { color: VC.label }]}>{labels[status]}</Text>
      </View>

      <View style={vo.wave}>
        <AudioWave status={status} meterLevel={meterLevel} />
      </View>

      <View style={vo.caption}>
        <ScrollView ref={captionScrollRef} showsVerticalScrollIndicator={false}>
          <Text style={[vo.captionText, { color: VC.caption }, !lastKwameText && vo.captionFade]}>
            {lastKwameText || "Kwame is ready…"}
            {isCaptionStreaming && <StreamingCursor color={VC.caption} />}
          </Text>
        </ScrollView>
      </View>

      <View style={vo.micArea}>
        <Animated.View style={[vo.pulse, { transform: [{ scale: pulseScale }], opacity: pulseOp }]} />
        <Pressable
          onPress={canTapMic ? onStop : undefined}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [
            vo.mic,
            { backgroundColor: micBg, opacity: pressed ? 0.82 : 1 },
            (status === "listening" || status === "speaking") && { borderWidth: 2.5, borderColor: ORANGE },
          ]}
        >
          <Ionicons name={micIcon} size={36} color={micIconColor} />
        </Pressable>
      </View>

      <View style={vo.btns}>
        <Pressable
          onPress={onEnd}
          style={({ pressed }) => [vo.btn, { backgroundColor: VC.endBg, borderColor: VC.endBd }, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="close-circle-outline" size={18} color={RED} />
          <Text style={[vo.btnLabel, { color: RED }]}>End Session</Text>
        </Pressable>
        <Pressable
          onPress={onFlipToText}
          style={({ pressed }) => [vo.btn, { backgroundColor: VC.textBg, borderColor: VC.textBd }, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={VC.textClr} />
          <Text style={[vo.btnLabel, { color: VC.textClr }]}>Text Chat</Text>
        </Pressable>
      </View>
    </View>
  );
}

const vo = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1,
  },
  dot:       { width: 7, height: 7, borderRadius: 3.5 },
  pillText:  { fontSize: 13, fontWeight: "600" },
  wave:      { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  caption: {
    width: "100%", paddingHorizontal: 8, paddingVertical: 8,
    minHeight: 100, maxHeight: 150, marginBottom: 28,
  },
  captionText: { fontSize: 20, fontWeight: "600", textAlign: "center", lineHeight: 29, letterSpacing: 0.1 },
  captionFade: { opacity: 0.25 },
  micArea:     { alignItems: "center", justifyContent: "center", marginBottom: 40 },
  pulse:       { position: "absolute", width: 108, height: 108, borderRadius: 54, backgroundColor: ORANGE },
  mic: {
    width: 108, height: 108, borderRadius: 54,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  btns:     { flexDirection: "row", gap: 12, width: "100%" },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 18, borderRadius: 18, gap: 8, borderWidth: 1,
  },
  btnLabel: { fontSize: 14, fontWeight: "600" },
});

// ─── KwameScreen ──────────────────────────────────────────────────────────────

export default function KwameScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const dark    = useColorScheme() === "dark";

  const KC = {
    bg:          dark ? "#0F0F0F" : WHITE,
    header:      dark ? "#1C1C1E" : WHITE,
    headerBd:    dark ? "#2C2C2E" : "#F0F0F5",
    title:       dark ? WHITE : DARK,
    kwameBubble: dark ? "#2C2C2E" : WARM,
    kwameText:   dark ? WHITE : DARK,
    userBubble:  dark ? "#3A3A3C" : DARK,
    inputBg:     dark ? "#2C2C2E" : LIGHT,
    inputText:   dark ? WHITE : DARK,
    inputBd:     dark ? "#3A3A3C" : BORDER,
    inputArea:   dark ? "#1C1C1E" : WHITE,
    inputBarBd:  dark ? "#2C2C2E" : BORDER,
    sendBg:      dark ? "#3A3A3C" : DARK,
  };

  const [me, setMe]               = useState<Coords | null>(null);
  const meRef                     = useRef<Coords | null>(null);
  const [inputText, setInputText] = useState("");
  const flatListRef               = useRef<FlatList>(null);
  const { setJourney }            = useJourneyStore();

  // ── Get GPS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c: Coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMe(c);
      meRef.current = c;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 25 },
        (loc) => {
          const u: Coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setMe(u);
          meRef.current = u;
        }
      );
    })();
    return () => { sub?.remove(); };
  }, []);

  // ── Kwame hook ─────────────────────────────────────────────────────────────
  const {
    messages, status, meterLevel, voiceMode, lastKwameText, isCaptionStreaming,
    toggleRecording, submitText, clearChat, exitVoiceMode,
  } = useKwame(me);

  // Auto-scroll when messages or processing state changes
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, status]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!inputText.trim()) return;
    submitText(inputText);
    setInputText("");
  };

  const handleVoice = () => {
    if (status === "idle" || status === "error") Keyboard.dismiss();
    toggleRecording();
  };

  const handleStartRoute = useCallback((routeData: any) => {
    const loc = meRef.current;
    const fromLoc: UnifiedLocation = {
      id:    "current_location",
      name:  "Current Location",
      _type: "location",
      lat:   loc?.latitude  ?? 0,
      lng:   loc?.longitude ?? 0,
    };
    const toLoc: UnifiedLocation = {
      id:    routeData.summary,
      name:  routeData.summary.replace(/^Via /i, ""),
      _type: "location",
      lat:   routeData.segments[routeData.segments.length - 1].to.lat,
      lng:   routeData.segments[routeData.segments.length - 1].to.lng,
    };
    setJourney(fromLoc, toLoc, { ...routeData, is_ai_derived: true });
    router.back();
  }, [setJourney, router]);

  const handleChip = useCallback((text: string) => submitText(text), [submitText]);

  const handleClose = () => {
    Keyboard.dismiss();
    router.back();
  };

  // ── Message renderer ───────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";

    if (item.type === "audio") return <AudioBubble audioUri={item.audioUri} />;

    if (item.type === "route_card" && item.routeData) {
      return (
        <View style={s.assistantRow}>
          <Image source={require("@/assets/images/kwame.png")} style={s.avatar} />
          <View style={{ flex: 1 }}>
            <RouteCard item={item} onPress={() => handleStartRoute(item.routeData)} />
          </View>
        </View>
      );
    }

    return (
      <View style={[s.msgRow, isUser ? s.userRow : s.assistantRow]}>
        {!isUser && <Image source={require("@/assets/images/kwame.png")} style={s.avatar} />}
        <View style={[
          s.bubble,
          isUser
            ? [s.userBubble, { backgroundColor: KC.userBubble }]
            : [s.kwameBubble, { backgroundColor: KC.kwameBubble }],
        ]}>
          <Text style={isUser ? s.userText : [s.kwameText, { color: KC.kwameText }]}>
            {item.content}
            {item.isStreaming && !isUser && <StreamingCursor color={KC.kwameText} />}
          </Text>
        </View>
      </View>
    );
  };

  const isProcessing  = status === "processing";
  const isFirstRound  = messages.length <= 1;

  return (
    <View style={[s.screen, { backgroundColor: KC.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {voiceMode ? (
        <VoiceOverlay
          status={status}
          meterLevel={meterLevel}
          lastKwameText={lastKwameText}
          isCaptionStreaming={isCaptionStreaming}
          onStop={handleVoice}
          onFlipToText={exitVoiceMode}
          onEnd={handleClose}
          safeTop={insets.top}
          safeBottom={insets.bottom}
        />
      ) : (
        <>
          {/* ── Header ── */}
          <View style={[s.header, {
            paddingTop: insets.top + 10,
            backgroundColor: KC.header,
            borderBottomColor: KC.headerBd,
          }]}>
            <Pressable onPress={handleClose} hitSlop={14} style={s.headerBtn}>
              <Ionicons name="close" size={22} color={GREY} />
            </Pressable>
            <View style={s.headerCenter}>
              <View style={s.avatarRing}>
                <Image source={require("@/assets/images/kwame.png")} style={s.headerAvatar} />
              </View>
              <Text style={[s.headerTitle, { color: KC.title }]}>Kwame</Text>
            </View>
            <Pressable onPress={clearChat} hitSlop={14} style={s.headerBtn}>
              <Ionicons name="create-outline" size={22} color={KC.title} />
            </Pressable>
          </View>

          {/* ── Chat + Input ── */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[s.chatContent, isFirstRound && !isProcessing && { flex: 1 }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              ListEmptyComponent={
                !isProcessing ? <EmptyState onChipPress={handleChip} /> : null
              }
              ListFooterComponent={isProcessing ? <TypingDots /> : null}
            />

            {/* ── Input bar ── */}
            <View style={[s.inputArea, {
              paddingBottom: insets.bottom + 8,
              backgroundColor: KC.inputArea,
              borderTopColor: KC.inputBarBd,
            }]}>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, {
                    backgroundColor: KC.inputBg,
                    color: KC.inputText,
                    borderColor: KC.inputBd,
                  }]}
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
                    style={({ pressed }) => [s.actionBtn, { opacity: pressed ? 0.8 : 1, backgroundColor: KC.sendBg }]}
                    onPress={handleSend}
                  >
                    <Ionicons name="arrow-up" size={18} color={WHITE} />
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [s.actionBtn, s.micOrange, { opacity: pressed ? 0.8 : 1 }]}
                    onPress={handleVoice}
                  >
                    <Ionicons name="mic" size={19} color={WHITE} />
                  </Pressable>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn:    { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarRing:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 28, height: 28, borderRadius: 14 },
  headerTitle:  { fontSize: 17, fontWeight: "700" },

  chatContent:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  msgRow:       { flexDirection: "row", marginBottom: 10, alignItems: "flex-end" },
  userRow:      { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start", alignItems: "flex-end" },

  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: LIGHT, flexShrink: 0 },

  bubble:      { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20 },
  userBubble:  { borderBottomRightRadius: 4 },
  kwameBubble: { borderBottomLeftRadius: 4 },

  userText:  { fontSize: 15, color: WHITE, lineHeight: 22 },
  kwameText: { fontSize: 15, lineHeight: 22 },

  inputArea: {
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 15, maxHeight: 100, borderWidth: 1,
  },
  actionBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  micOrange: { backgroundColor: ORANGE },
});
