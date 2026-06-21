import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Switch, ActivityIndicator, useColorScheme, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAudioPlayer, AudioModule } from 'expo-audio';
import { useKwameSettingsStore } from '../store/kwameSettingsStore';
import { AiService } from '../services/ai';

const ORANGE = '#FF6F00';

function makeC(dark: boolean) {
  return {
    bg:      dark ? '#0D0D0D' : '#F2F2F7',
    card:    dark ? '#1C1C1E' : '#FFFFFF',
    raised:  dark ? '#2C2C2E' : '#F0F0F5',
    text:    dark ? '#FFFFFF' : '#1C1C1E',
    sub:     dark ? '#8E8E93' : '#6C6C70',
    border:  dark ? '#38383A' : '#E5E5EA',
    divider: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  };
}

type C = ReturnType<typeof makeC>;

// ─── Data ────────────────────────────────────────────────────────────────────────

const VOICES = [
  { id: 'en-US-Neural2-D', name: 'Marcus', gender: 'M', trait: 'Warm'   },
  { id: 'en-US-Neural2-J', name: 'Devon',  gender: 'M', trait: 'Deep'   },
  { id: 'en-US-Neural2-F', name: 'Amara',  gender: 'F', trait: 'Warm'   },
  { id: 'en-US-Neural2-H', name: 'Zara',   gender: 'F', trait: 'Bright' },
] as const;

const LANGUAGES = [
  { code: 'en-US', flag: '🇺🇸', name: 'English', region: 'American accent' },
  { code: 'en-KE', flag: '🇰🇪', name: 'English', region: 'Kenyan accent'   },
  { code: 'sw-KE', flag: '🇰🇪', name: 'Swahili', region: 'Kenya'           },
] as const;

// Each language has its own preview voice + text so the preview sounds authentic.
// voiceId: null → reuse the user's selected persona voice (works for en-US only).
const LANG_PREVIEWS: Record<string, { voiceId: string | null; text: string }> = {
  'en-US': {
    voiceId: null,
    text: "Hello! I'm Kwame, your Nairobi transit guide. Ready to navigate the city?",
  },
  'en-KE': {
    voiceId: 'en-KE-Standard-B',
    text: "Hello! I'm Kwame, your Nairobi transit guide. Ready to navigate the city?",
  },
  'sw-KE': {
    voiceId: 'sw-KE-Standard-B',
    text: "Habari! Mimi ni Kwame, msaidizi wako wa usafiri wa Nairobi. Tuko tayari kwenda!",
  },
};

const STYLES = [
  { value: 'casual'       as const, icon: 'chatbubble-ellipses-outline', label: 'Casual',       desc: 'Friendly, like a local' },
  { value: 'professional' as const, icon: 'briefcase-outline',           label: 'Professional', desc: 'Formal and precise'     },
  { value: 'brief'        as const, icon: 'flash-outline',               label: 'Brief',        desc: 'One sentence max'       },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────

const adj = (v: number, delta: number, min: number, max: number, dp: number) =>
  parseFloat(Math.max(min, Math.min(max, v + delta)).toFixed(dp));

// ─── Sub-components ──────────────────────────────────────────────────────────────

function SectionLabel({ label, C }: { label: string; C: C }) {
  return <Text style={[s.sectionLabel, { color: C.sub }]}>{label}</Text>;
}

function RangeBar({ pct, C }: { pct: number; C: C }) {
  const anim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: pct, useNativeDriver: false, speed: 30, bounciness: 0 }).start();
  }, [pct]);
  return (
    <View style={[s.rangeTrack, { backgroundColor: C.divider }]}>
      <Animated.View style={[s.rangeFill, {
        width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
      }]} />
    </View>
  );
}

function StepRow({
  label, display, pct, onDec, onInc, C,
}: {
  label: string; display: string; pct: number;
  onDec: () => void; onInc: () => void; C: C;
}) {
  return (
    <View style={[s.stepOuter, { borderBottomColor: C.divider }]}>
      <View style={s.stepInner}>
        <Text style={[s.stepLabel, { color: C.text }]}>{label}</Text>
        <View style={s.stepControls}>
          <TouchableOpacity onPress={onDec} hitSlop={10}
            style={[s.stepBtn, { backgroundColor: C.raised, borderColor: C.border }]}>
            <Ionicons name="remove" size={14} color={C.text} />
          </TouchableOpacity>
          <Text style={[s.stepValue, { color: ORANGE }]}>{display}</Text>
          <TouchableOpacity onPress={onInc} hitSlop={10}
            style={[s.stepBtn, { backgroundColor: C.raised, borderColor: C.border }]}>
            <Ionicons name="add" size={14} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>
      <RangeBar pct={pct} C={C} />
    </View>
  );
}

function VoiceRow({
  voice, selected, isLast, onSelect, onPreview, previewing, C,
}: {
  voice: typeof VOICES[number]; selected: boolean; isLast: boolean;
  onSelect: () => void; onPreview: () => void; previewing: boolean; C: C;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.6}
      style={[s.voiceRow, !isLast && { borderBottomColor: C.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[s.initCircle, { backgroundColor: C.raised, borderColor: selected ? ORANGE : 'transparent' }]}>
        <Text style={[s.initLetter, { color: selected ? ORANGE : C.sub }]}>{voice.name[0]}</Text>
      </View>

      <View style={s.voiceLabels}>
        <Text style={[s.voiceName, { color: selected ? ORANGE : C.text }]}>{voice.name}</Text>
        <Text style={[s.voiceTrait, { color: C.sub }]}>
          {voice.gender === 'M' ? 'Male' : 'Female'} · {voice.trait}
        </Text>
      </View>

      <TouchableOpacity onPress={onPreview} hitSlop={12}
        style={[s.previewBtn, { borderColor: C.border }]}>
        {previewing
          ? <ActivityIndicator size="small" color={ORANGE} />
          : <Ionicons name="play" size={13} color={C.sub} />}
      </TouchableOpacity>

      <View style={[s.checkDot, { opacity: selected ? 1 : 0 }]}>
        <Ionicons name="checkmark" size={12} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
}

function LangRow({
  lang, selected, isLast, onSelect, onPreview, previewing, C,
}: {
  lang: typeof LANGUAGES[number]; selected: boolean; isLast: boolean;
  onSelect: () => void; onPreview: () => void; previewing: boolean; C: C;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.6}
      style={[s.listRow, !isLast && { borderBottomColor: C.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <Text style={s.langFlag}>{lang.flag}</Text>
      <View style={s.listLabels}>
        <Text style={[s.listPrimary, { color: C.text }]}>{lang.name}</Text>
        <Text style={[s.listSecondary, { color: C.sub }]}>{lang.region}</Text>
      </View>
      <TouchableOpacity onPress={onPreview} hitSlop={12}
        style={[s.previewBtn, { borderColor: C.border }]}>
        {previewing
          ? <ActivityIndicator size="small" color={ORANGE} />
          : <Ionicons name="play" size={13} color={C.sub} />}
      </TouchableOpacity>
      <View style={[s.checkDot, { opacity: selected ? 1 : 0 }]}>
        <Ionicons name="checkmark" size={12} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
}

function StyleRow({
  item, selected, isLast, onSelect, C,
}: {
  item: typeof STYLES[number]; selected: boolean;
  isLast: boolean; onSelect: () => void; C: C;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.6}
      style={[s.listRow, !isLast && { borderBottomColor: C.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[s.styleIcon, { backgroundColor: C.raised }]}>
        <Ionicons name={item.icon as any} size={17} color={selected ? ORANGE : C.sub} />
      </View>
      <View style={s.listLabels}>
        <Text style={[s.listPrimary, { color: selected ? ORANGE : C.text }]}>{item.label}</Text>
        <Text style={[s.listSecondary, { color: C.sub }]}>{item.desc}</Text>
      </View>
      <View style={[s.checkDot, { opacity: selected ? 1 : 0 }]}>
        <Ionicons name="checkmark" size={12} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────────

export default function KwameSettingsScreen() {
  const router = useRouter();
  const dark   = useColorScheme() === 'dark';
  const C      = makeC(dark);

  const { settings, load, set } = useKwameSettingsStore();
  // Single previewing ID covers both voice-persona and language rows — prevents concurrent previews.
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUri,   setPreviewUri]   = useState<string | null>(null);

  const previewPlayer = useAudioPlayer(previewUri);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (previewUri && previewPlayer) {
      previewPlayer.volume = 1.0;
      previewPlayer.play();
      const playTime = (previewPlayer.duration || 4) * 1000;
      const timer = setTimeout(() => {
        setPreviewingId(null);
        setPreviewUri(null);
      }, playTime + 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUri, previewPlayer]);

  const handleVoicePreview = async (voiceId: string) => {
    if (previewingId) return;
    setPreviewingId(voiceId);
    try {
      await AudioModule.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const { audio } = await AiService.speak(
        "Hi there! I'm Kwame, your Nairobi transit guide. Ready to navigate the city?",
        {
          voice_name:    voiceId,
          speaking_rate: settings.speakingRate,
          pitch:         settings.pitch,
          language_code: settings.languageCode,
        }
      );
      setPreviewUri(`data:audio/mp3;base64,${audio}`);
    } catch {
      setPreviewingId(null);
    }
  };

  const handleLangPreview = async (langCode: string) => {
    if (previewingId) return;
    const preview = LANG_PREVIEWS[langCode];
    if (!preview) return;
    setPreviewingId(langCode);
    try {
      await AudioModule.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const { audio } = await AiService.speak(preview.text, {
        voice_name:    preview.voiceId ?? settings.voiceName,
        speaking_rate: settings.speakingRate,
        pitch:         settings.pitch,
        language_code: langCode,
      });
      setPreviewUri(`data:audio/mp3;base64,${audio}`);
    } catch {
      setPreviewingId(null);
    }
  };

  const speedPct = ((settings.speakingRate - 0.75)         / (1.5 - 0.75)) * 100;
  const pitchPct = ((settings.pitch - (-5))                / 10)            * 100;
  const vadPct   = ((settings.silenceThresholdDb - (-42))  / 17)            * 100;
  const holdPct  = ((settings.silenceHoldMs - 700)         / 1300)          * 100;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: C.bg, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.headerBack}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: C.text }]}>Voice Settings</Text>
          <Text style={[s.headerKwame, { color: ORANGE }]}>Kwame</Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Voice persona ──────────────────────────────────────────────── */}
        <SectionLabel label="VOICE PERSONA" C={C} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {VOICES.map((v, i) => (
            <VoiceRow
              key={v.id}
              voice={v}
              selected={settings.voiceName === v.id}
              isLast={i === VOICES.length - 1}
              onSelect={() => set('voiceName', v.id)}
              onPreview={() => handleVoicePreview(v.id)}
              previewing={previewingId === v.id}
              C={C}
            />
          ))}
        </View>
        <Text style={[s.footnote, { color: C.sub }]}>
          Tap ▶ to preview with your current speed and pitch.
        </Text>

        {/* ── Playback ───────────────────────────────────────────────────── */}
        <SectionLabel label="PLAYBACK" C={C} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <StepRow
            label="Speed"
            display={`${settings.speakingRate.toFixed(2)}×`}
            pct={speedPct}
            onDec={() => set('speakingRate', adj(settings.speakingRate, -0.05, 0.75, 1.5, 2))}
            onInc={() => set('speakingRate', adj(settings.speakingRate, +0.05, 0.75, 1.5, 2))}
            C={C}
          />
          <StepRow
            label="Pitch"
            display={settings.pitch === 0 ? '0' : settings.pitch > 0 ? `+${settings.pitch}` : `${settings.pitch}`}
            pct={pitchPct}
            onDec={() => set('pitch', adj(settings.pitch, -1, -5, 5, 0))}
            onInc={() => set('pitch', adj(settings.pitch, +1, -5, 5, 0))}
            C={C}
          />
        </View>

        {/* ── Language ───────────────────────────────────────────────────── */}
        <SectionLabel label="LANGUAGE" C={C} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {LANGUAGES.map((lang, i) => (
            <LangRow
              key={lang.code}
              lang={lang}
              selected={settings.languageCode === lang.code}
              isLast={i === LANGUAGES.length - 1}
              onSelect={() => set('languageCode', lang.code)}
              onPreview={() => handleLangPreview(lang.code)}
              previewing={previewingId === lang.code}
              C={C}
            />
          ))}
        </View>
        <Text style={[s.footnote, { color: C.sub }]}>
          Tap ▶ to hear how Kwame sounds in each language. Affects directions and local terms.
        </Text>

        {/* ── Personality ────────────────────────────────────────────────── */}
        <SectionLabel label="PERSONALITY" C={C} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {STYLES.map((item, i) => (
            <StyleRow
              key={item.value}
              item={item}
              selected={settings.responseStyle === item.value}
              isLast={i === STYLES.length - 1}
              onSelect={() => set('responseStyle', item.value)}
              C={C}
            />
          ))}
        </View>

        {/* ── Behaviour ──────────────────────────────────────────────────── */}
        <SectionLabel label="BEHAVIOUR" C={C} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.toggleRow}>
            <View style={s.toggleLabels}>
              <Text style={[s.listPrimary, { color: C.text }]}>Auto-listen</Text>
              <Text style={[s.listSecondary, { color: C.sub }]}>
                Restart listening after Kwame finishes speaking
              </Text>
            </View>
            <Switch
              value={settings.autoListen}
              onValueChange={(v) => set('autoListen', v)}
              trackColor={{ false: C.border, true: ORANGE }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── Voice detection ────────────────────────────────────────────── */}
        <SectionLabel label="VOICE DETECTION" C={C} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <StepRow
            label="Sensitivity"
            display={`${settings.silenceThresholdDb} dB`}
            pct={vadPct}
            onDec={() => set('silenceThresholdDb', adj(settings.silenceThresholdDb, -1, -42, -25, 0))}
            onInc={() => set('silenceThresholdDb', adj(settings.silenceThresholdDb, +1, -42, -25, 0))}
            C={C}
          />
          <StepRow
            label="Silence hold"
            display={`${(settings.silenceHoldMs / 1000).toFixed(1)} s`}
            pct={holdPct}
            onDec={() => set('silenceHoldMs', adj(settings.silenceHoldMs, -100, 700, 2000, 0))}
            onInc={() => set('silenceHoldMs', adj(settings.silenceHoldMs, +100, 700, 2000, 0))}
            C={C}
          />
        </View>
        <Text style={[s.footnote, { color: C.sub }]}>
          Lower sensitivity reduces false triggers. Higher hold adds patience before sending.
        </Text>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack:   { width: 40 },
  headerSpacer: { width: 40 },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  headerKwame:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 22, marginLeft: 4,
  },

  footnote: { fontSize: 12, lineHeight: 17, marginTop: 6, marginLeft: 4 },

  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  // Range bar
  rangeTrack: { height: 2, borderRadius: 1, marginHorizontal: 16, marginBottom: 14, overflow: 'hidden' },
  rangeFill:  { height: '100%', borderRadius: 1, backgroundColor: ORANGE },

  // Step row
  stepOuter:    { borderBottomWidth: StyleSheet.hairlineWidth },
  stepInner:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  stepLabel:    { fontSize: 15, fontWeight: '500', flex: 1, letterSpacing: -0.1 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center', alignItems: 'center',
  },
  stepValue: { fontSize: 14, fontWeight: '600', minWidth: 56, textAlign: 'center' },

  // Voice row
  voiceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  initCircle: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 13, borderWidth: 1.5,
  },
  initLetter:  { fontSize: 17, fontWeight: '700' },
  voiceLabels: { flex: 1 },
  voiceName:   { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  voiceTrait:  { fontSize: 12, marginTop: 2 },
  previewBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  checkDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },

  // Shared list row (language + style)
  listRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  langFlag:      { fontSize: 24, marginRight: 14 },
  listLabels:    { flex: 1 },
  listPrimary:   { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  listSecondary: { fontSize: 12, marginTop: 2 },
  styleIcon:     { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 13 },

  // Toggle row
  toggleRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabels: { flex: 1, marginRight: 12 },
});
