import React, { useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { renderMarkdownText } from '../../utils/markdown';
import type { VoiceHistoryEntry } from '../../app/kwame';

interface Props {
  C: any;
  voiceState: 'idle' | 'listening' | 'speaking' | 'processing';
  holdingPhrase: string | null;
  meteringRef: { current: number };
  voiceHistory: VoiceHistoryEntry[];
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
  toggleUiMode: (mode: 'chat' | 'voice', opts?: { keepAudio?: boolean }) => void;
  onQuickReply: (text: string) => void;
  onNavigate: (route: any) => void;
}

const ORANGE  = '#FF6F00';
const N_BARS  = 9;
const BAR_W   = 5;
const BAR_GAP = 4;
const BAR_MAX = 52;
const BAR_MIN = 5;
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 64;

const QUICK_REPLIES = ['Another route', 'How long?', 'Navigate now'];

const STATE_COLORS = {
  idle:       '#6B7280',
  listening:  '#10B981',
  processing: '#F59E0B',
  speaking:   ORANGE,
};

const STATE_ICONS: Record<string, any> = {
  idle:       'radio-button-off-outline',
  listening:  'mic',
  processing: 'sync-outline',
  speaking:   'volume-high-outline',
};

// ── Animated status pill ──────────────────────────────────────────────────────
function StatusPill({ voiceState }: { voiceState: 'idle' | 'listening' | 'speaking' | 'processing' }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 550, useNativeDriver: true }),
      ])
    );
    if (voiceState === 'listening' || voiceState === 'processing') {
      loop.start();
    } else {
      loop.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => loop.stop();
  }, [voiceState]);

  const color  = STATE_COLORS[voiceState];
  const labels = { idle: 'Tap to speak', listening: 'Listening', processing: 'Thinking', speaking: 'Speaking' };

  return (
    <View style={[statusPillStyle.pill, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
      <Animated.View style={[statusPillStyle.dot, { backgroundColor: color, opacity: pulseAnim }]} />
      <Ionicons name={STATE_ICONS[voiceState]} size={12} color={color} />
      <Text style={[statusPillStyle.label, { color }]}>{labels[voiceState]}</Text>
    </View>
  );
}

const statusPillStyle = StyleSheet.create({
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});

// ── Leg pill ──────────────────────────────────────────────────────────────────
function LegPill({ leg, C }: { leg: any; C: any }) {
  const isWalk = leg.mode?.toUpperCase() === 'WALK';
  return (
    <View style={[legPillStyle.pill, { backgroundColor: isWalk ? C.iconBg : `${ORANGE}20` }]}>
      <Ionicons name={isWalk ? 'walk-outline' : 'bus-outline'} size={11} color={isWalk ? C.sub : ORANGE} />
      {!isWalk && leg.routeNumber ? (
        <Text style={[legPillStyle.label, { color: ORANGE }]}>{leg.routeNumber}</Text>
      ) : null}
    </View>
  );
}

const legPillStyle = StyleSheet.create({
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '700' },
});

// ── Voice route card ──────────────────────────────────────────────────────────
function fmtDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function VoiceRouteCard({ route, C, onNavigate }: { route: any; C: any; onNavigate: (r: any) => void }) {
  const legs = route.legs || route.segments || [];
  if (legs.length === 0) return null;
  const transitLegs = legs.filter((l: any) => l.mode?.toUpperCase() !== 'WALK');
  const from = legs[0]?.from?.name;
  const to   = legs[legs.length - 1]?.to?.name;

  return (
    <View style={[cardStyle.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={cardStyle.header}>
        <View style={cardStyle.headerLeft}>
          <Ionicons name="navigate-circle-outline" size={15} color={ORANGE} />
          <Text style={[cardStyle.summary, { color: C.text }]} numberOfLines={1}>
            {route.summary || 'Route'}
          </Text>
        </View>
        <View style={[cardStyle.badge, { backgroundColor: `${ORANGE}18` }]}>
          <Ionicons name="time-outline" size={11} color={ORANGE} />
          <Text style={[cardStyle.badgeText, { color: ORANGE }]}>
            {route.total_duration ? fmtDuration(route.total_duration) : '—'}
          </Text>
        </View>
      </View>

      <View style={cardStyle.routeLine}>
        <View style={cardStyle.dotOrange} />
        <Text style={[cardStyle.routeStop, { color: C.sub }]} numberOfLines={1}>{from || 'Origin'}</Text>
      </View>
      <View style={[cardStyle.connector, { backgroundColor: C.border }]} />
      <View style={cardStyle.routeLine}>
        <View style={cardStyle.dotGreen} />
        <Text style={[cardStyle.routeStop, { color: C.sub }]} numberOfLines={1}>{to || 'Destination'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cardStyle.pillsRow} style={cardStyle.pillsScroll}>
        {legs.map((leg: any, i: number) => <LegPill key={i} leg={leg} C={C} />)}
      </ScrollView>

      {transitLegs.length > 0 && (
        <Text style={[cardStyle.transitSummary, { color: C.sub }]} numberOfLines={1}>
          {transitLegs.map((l: any) => l.routeNumber || 'Matatu').join(' → ')}
        </Text>
      )}

      <TouchableOpacity style={cardStyle.navigateBtn} onPress={() => onNavigate(route)} activeOpacity={0.85}>
        <Ionicons name="arrow-forward-circle" size={15} color="#FFF" />
        <Text style={cardStyle.navigateBtnText}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );
}

const cardStyle = StyleSheet.create({
  card: {
    width: CARD_W, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    padding: 13, marginRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 },
  summary:        { fontSize: 13, fontWeight: '700', flex: 1 },
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  badgeText:      { fontSize: 11, fontWeight: '700' },
  routeLine:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotOrange:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE },
  dotGreen:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' },
  connector:      { width: 2, height: 8, marginLeft: 2.5, marginVertical: 2 },
  routeStop:      { fontSize: 11, flex: 1 },
  pillsScroll:    { marginTop: 9 },
  pillsRow:       { flexDirection: 'row', gap: 5 },
  transitSummary: { fontSize: 10, marginTop: 5, fontWeight: '500' },
  navigateBtn: {
    marginTop: 11, backgroundColor: ORANGE, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9,
  },
  navigateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});

// ── Main component ────────────────────────────────────────────────────────────
export default function VoiceOverlay({
  C, voiceState, holdingPhrase, meteringRef,
  voiceHistory,
  ripple1Anim, ripple2Anim, orbScaleAnim,
  isMuted, isSpeakerOn, voiceContainerOpacity, voiceContainerScale,
  handleOrbPress, setIsSpeakerOn, setIsMuted, toggleUiMode, onQuickReply, onNavigate,
}: Props) {

  // ── Waveform bars ───────────────────────────────────────────────────────────
  const barSpreads = useMemo(
    () => Array.from({ length: N_BARS }, () => 0.7 + Math.random() * 0.6), []
  );
  const barAnims = useRef(
    Array.from({ length: N_BARS }, () => new Animated.Value(BAR_MIN))
  ).current;
  const barSmoothedRef = useRef<number[]>(new Array(N_BARS).fill(BAR_MIN));

  useEffect(() => {
    if (voiceState !== 'listening') {
      barAnims.forEach(a => a.setValue(BAR_MIN));
      barSmoothedRef.current.fill(BAR_MIN);
      return;
    }
    const id = setInterval(() => {
      const db     = Math.max(-60, Math.min(0, meteringRef.current));
      const energy = (db + 60) / 60;
      barAnims.forEach((anim, i) => {
        const target   = Math.max(BAR_MIN, energy * BAR_MAX * barSpreads[i]);
        const smoothed = barSmoothedRef.current[i] * 0.35 + target * 0.65;
        barSmoothedRef.current[i] = smoothed;
        anim.setValue(smoothed);
      });
    }, 50);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  // ── History scroll ref — auto-scroll to bottom ──────────────────────────────
  const historyScrollRef = useRef<ScrollView>(null);

  // ── Content panel fade-in ───────────────────────────────────────────────────
  const contentOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(contentOpacity, {
      toValue: voiceHistory.length > 0 ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceHistory.length]);

  // ── Ripple for speaking ─────────────────────────────────────────────────────
  const rippleOpacity  = ripple1Anim.interpolate({ inputRange: [1, 1.5], outputRange: [0.4, 0] });
  const ripple2Opacity = ripple2Anim.interpolate({ inputRange: [1, 2.0], outputRange: [0.25, 0] });

  // ── Orb glow ring ──────────────────────────────────────────────────────────
  const orbGlowAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbGlowAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(orbGlowAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    if (voiceState === 'listening' || voiceState === 'speaking') {
      loop.start();
    } else {
      loop.stop();
      orbGlowAnim.setValue(1);
    }
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  const stateColor  = STATE_COLORS[voiceState];
  const lastEntry   = voiceHistory.length > 0 ? voiceHistory[voiceHistory.length - 1] : null;
  const showChips   = lastEntry?.role === 'kwame';

  return (
    <Animated.View style={[
      styles.overlay,
      { backgroundColor: C.overlay, opacity: voiceContainerOpacity, transform: [{ scale: voiceContainerScale }] },
    ]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={[styles.assistantName, { color: ORANGE }]}>Kwame</Text>
        <StatusPill voiceState={voiceState} />
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: C.iconBg, borderColor: C.border }]}
          onPress={() => toggleUiMode('chat')}
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* ── Unified history panel ─────────────────────────────────────────── */}
      {voiceHistory.length > 0 ? (
        <Animated.View style={[styles.historyPanel, { opacity: contentOpacity }]}>
          <ScrollView
            ref={historyScrollRef}
            style={styles.historyScroll}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => historyScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {voiceHistory.map((entry) => (
              <View key={entry.id}>
                {entry.role === 'user' ? (
                  // Right-aligned user pill
                  <View style={styles.userEntryRow}>
                    <View style={[styles.userEntryPill, { backgroundColor: `${ORANGE}22` }]}>
                      <Ionicons name="mic-outline" size={11} color={ORANGE} style={{ marginRight: 4 }} />
                      <Text style={[styles.userEntryText, { color: ORANGE }]}>{entry.text}</Text>
                    </View>
                  </View>
                ) : (
                  // Left-aligned Kwame bubble + inline route cards
                  <View style={styles.kwameEntryRow}>
                    {renderMarkdownText(
                      entry.text,
                      [styles.kwameEntryText, { color: C.text }],
                      ORANGE
                    )}
                    {entry.routes && entry.routes.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.inlineRoutesRow}
                        decelerationRate="fast"
                        snapToInterval={CARD_W + 12}
                        snapToAlignment="start"
                        style={styles.inlineRoutesScroll}
                      >
                        {entry.routes.map((route: any, i: number) => (
                          <VoiceRouteCard key={i} route={route} C={C} onNavigate={onNavigate} />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            ))}

            {/* Quick reply chips — only after last kwame message */}
            {showChips && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
                {QUICK_REPLIES.map(reply => (
                  <TouchableOpacity
                    key={reply}
                    style={[styles.chip, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => onQuickReply(reply)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: C.text }]}>{reply}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </ScrollView>
        </Animated.View>
      ) : (
        // Placeholder when nothing to show yet
        <View style={styles.placeholderWrapper}>
          <Text style={[styles.placeholderText, { color: C.sub }]}>
            {holdingPhrase || (voiceState === 'listening' ? "Go ahead, I'm listening…" : 'Ready when you are.')}
          </Text>
        </View>
      )}

      {/* ── Orb ────────────────────────────────────────────────────────────── */}
      <View style={styles.centerCore}>
        {voiceState === 'speaking' && (
          <>
            <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple1Anim }], opacity: rippleOpacity }]} />
            <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple2Anim }], opacity: ripple2Opacity }]} />
          </>
        )}

        <Animated.View style={[
          styles.orbGlowRing,
          { borderColor: `${stateColor}60`, transform: [{ scale: orbGlowAnim }] },
          voiceState === 'idle' && { opacity: 0 },
        ]} />

        {voiceState === 'listening' && (
          <View style={styles.waveformRow}>
            {barAnims.map((anim, i) => (
              <Animated.View key={i} style={[styles.waveBar, { height: anim }]} />
            ))}
          </View>
        )}

        <TouchableOpacity activeOpacity={1} onPress={handleOrbPress} style={styles.orbHitArea}>
          <Animated.View style={[
            styles.orb,
            { transform: [{ scale: orbScaleAnim }] },
            voiceState === 'listening'  && { backgroundColor: '#FF8F00', shadowColor: '#FF8F00', shadowRadius: 40, shadowOpacity: 0.9 },
            voiceState === 'speaking'   && { shadowRadius: 32, shadowOpacity: 0.9 },
            voiceState === 'processing' && { backgroundColor: '#CC5800' },
            isMuted && { backgroundColor: '#331A00' },
          ]}>
            <View style={styles.orbHighlight} />
            <Ionicons
              name={
                voiceState === 'processing' ? 'sync'       :
                voiceState === 'speaking'   ? 'volume-high' : 'mic'
              }
              size={46}
              color="#FFFFFF"
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* ── Footer controls ─────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: C.iconBg, borderColor: C.border }, !isSpeakerOn && styles.dimmed]}
          onPress={() => setIsSpeakerOn(!isSpeakerOn)}
        >
          <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={22} color={C.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.micBtn, isMuted && { backgroundColor: '#331A00', borderWidth: 1, borderColor: ORANGE }]}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={30} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Go to chat without cutting audio */}
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: C.iconBg, borderColor: C.border }]}
          onPress={() => toggleUiMode('chat', { keepAudio: true })}
        >
          <Ionicons name="chatbubble-outline" size={20} color={C.text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
    paddingTop: 18, paddingBottom: 32, paddingHorizontal: 20,
    flexDirection: 'column',
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  assistantName: { fontSize: 15, fontWeight: '700', letterSpacing: 0.6 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // History panel
  historyPanel:  { flex: 1, marginBottom: 8 },
  historyScroll: { flex: 1 },

  // User entry (right-aligned)
  userEntryRow:  { alignItems: 'flex-end', marginBottom: 10 },
  userEntryPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, maxWidth: SCREEN_W * 0.7 },
  userEntryText: { fontSize: 13, fontStyle: 'italic', opacity: 0.85 },

  // Kwame entry (left-aligned)
  kwameEntryRow:      { alignItems: 'flex-start', marginBottom: 12 },
  kwameEntryText:     { fontSize: 15, lineHeight: 23, fontWeight: '400', paddingHorizontal: 2 },
  inlineRoutesScroll: { marginTop: 8 },
  inlineRoutesRow:    { paddingHorizontal: 2, paddingBottom: 2 },

  // Chips
  chipsScroll: { marginTop: 4 },
  chipsRow:    { flexDirection: 'row', gap: 7, paddingHorizontal: 2, paddingBottom: 8 },
  chip:        { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 5 },
  chipText:    { fontSize: 12, fontWeight: '500' },

  // Placeholder
  placeholderWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText:    { fontSize: 17, textAlign: 'center', lineHeight: 25 },

  // Orb area
  centerCore: { justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 24 },

  rippleRing:   { position: 'absolute', width: 148, height: 148, borderRadius: 74, backgroundColor: ORANGE },

  orbGlowRing: {
    position: 'absolute',
    width: 172, height: 172, borderRadius: 86,
    borderWidth: 2, borderColor: `${ORANGE}60`,
  },

  waveformRow: { flexDirection: 'row', alignItems: 'center', gap: BAR_GAP, height: BAR_MAX + 8 },
  waveBar:     { width: BAR_W, borderRadius: 3, backgroundColor: ORANGE },

  orbHitArea: {},
  orb: {
    width: 148, height: 148, borderRadius: 74, backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65, shadowRadius: 28, elevation: 18,
  },
  orbHighlight: {
    position: 'absolute', top: 18, left: 22,
    width: 36, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-30deg' }],
  },

  // Footer
  footer: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtn: {
    width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  micBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
  },
  dimmed: { opacity: 0.4 },
});
