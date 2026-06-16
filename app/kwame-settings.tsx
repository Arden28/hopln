import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Switch, ActivityIndicator, useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useKwameSettingsStore, KwameSettings } from '../store/kwameSettingsStore';
import { AiService } from '../services/ai';

const ORANGE = '#FF6F00';

function makeC(dark: boolean) {
  return {
    bg:      dark ? '#0F0F0F' : '#FFFFFF',
    card:    dark ? '#1A1A1A' : '#F2F2F7',
    text:    dark ? '#FFFFFF' : '#000000',
    sub:     dark ? '#8E8E93' : '#8E8E93',
    border:  dark ? '#2A2A2A' : '#E5E5EA',
    section: dark ? '#3A3A3C' : '#C7C7CC',
  };
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, C }: { title: string; C: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: C.sub }]}>{title.toUpperCase()}</Text>
  );
}

// ── Step control (−/+) ────────────────────────────────────────────────────────
function StepControl({
  value, label, onDecrement, onIncrement, disabled, C,
}: {
  value: string; label: string; onDecrement: () => void; onIncrement: () => void; disabled?: boolean; C: any;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: C.border }]}>
      <Text style={[styles.rowLabel, { color: C.text }]}>{label}</Text>
      <View style={styles.stepRow}>
        <TouchableOpacity
          onPress={onDecrement} disabled={disabled}
          style={[styles.stepBtn, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <Ionicons name="remove" size={16} color={disabled ? C.sub : C.text} />
        </TouchableOpacity>
        <Text style={[styles.stepValue, { color: ORANGE }]}>{value}</Text>
        <TouchableOpacity
          onPress={onIncrement} disabled={disabled}
          style={[styles.stepBtn, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <Ionicons name="add" size={16} color={disabled ? C.sub : C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Chip group ────────────────────────────────────────────────────────────────
function ChipGroup<T extends string>({
  value, options, onChange, C,
}: {
  value: T; options: { label: string; value: T }[]; onChange: (v: T) => void; C: any;
}) {
  return (
    <View style={styles.chipGroup}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.chipGroupItem,
              { backgroundColor: active ? ORANGE : C.card, borderColor: active ? ORANGE : C.border },
            ]}
          >
            <Text style={[styles.chipGroupText, { color: active ? '#FFF' : C.text }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Voice card ────────────────────────────────────────────────────────────────
const VOICES: { id: string; label: string; desc: string }[] = [
  { id: 'en-US-Neural2-D', label: 'Marcus',  desc: 'Male · Warm' },
  { id: 'en-US-Neural2-J', label: 'Devon',   desc: 'Male · Deep' },
  { id: 'en-US-Neural2-F', label: 'Amara',   desc: 'Female · Warm' },
  { id: 'en-US-Neural2-H', label: 'Zara',    desc: 'Female · Bright' },
];

function VoiceCard({
  voice, selected, onSelect, onPreview, previewing, C,
}: {
  voice: typeof VOICES[0]; selected: boolean; onSelect: () => void;
  onPreview: () => void; previewing: boolean; C: any;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[
        styles.voiceCard,
        { backgroundColor: C.card, borderColor: selected ? ORANGE : C.border },
        selected && { borderWidth: 1.5 },
      ]}
      activeOpacity={0.8}
    >
      <View style={styles.voiceCardLeft}>
        <View style={[styles.voiceRadio, { borderColor: selected ? ORANGE : C.section }]}>
          {selected && <View style={styles.voiceRadioDot} />}
        </View>
        <View>
          <Text style={[styles.voiceCardName, { color: C.text }]}>{voice.label}</Text>
          <Text style={[styles.voiceCardDesc, { color: C.sub }]}>{voice.desc}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onPreview}
        style={[styles.previewBtn, { backgroundColor: `${ORANGE}18`, borderColor: `${ORANGE}30` }]}
        hitSlop={8}
      >
        {previewing
          ? <ActivityIndicator size="small" color={ORANGE} />
          : <Ionicons name="play" size={14} color={ORANGE} />
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function KwameSettingsScreen() {
  const router = useRouter();
  const dark   = useColorScheme() === 'dark';
  const C      = makeC(dark);

  const { settings, load, set } = useKwameSettingsStore();
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const clamp = (v: number, min: number, max: number, step: number) =>
    Math.round(Math.max(min, Math.min(max, v)) / step) * step;

  const handlePreview = async (voiceId: string) => {
    if (previewingVoice) return;
    setPreviewingVoice(voiceId);
    try {
      await AiService.speak("Hey there! I'm Kwame, your Nairobi transit guide.", {
        voice_name:    voiceId,
        speaking_rate: settings.speakingRate,
        pitch:         settings.pitch,
        language_code: settings.languageCode,
      });
    } catch {}
    setPreviewingVoice(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>
          Kwame <Text style={{ color: ORANGE }}>Settings</Text>
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Voice ─────────────────────────────────────────────────────── */}
        <SectionHeader title="Voice" C={C} />
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {VOICES.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              selected={settings.voiceName === v.id}
              onSelect={() => set('voiceName', v.id)}
              onPreview={() => handlePreview(v.id)}
              previewing={previewingVoice === v.id}
              C={C}
            />
          ))}
        </View>

        {/* ── Speed & Pitch ─────────────────────────────────────────────── */}
        <SectionHeader title="Playback" C={C} />
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <StepControl
            label="Speed"
            value={`${settings.speakingRate.toFixed(2)}×`}
            onDecrement={() => set('speakingRate', clamp(settings.speakingRate - 0.05, 0.75, 1.5, 0.05))}
            onIncrement={() => set('speakingRate', clamp(settings.speakingRate + 0.05, 0.75, 1.5, 0.05))}
            C={C}
          />
          <StepControl
            label="Pitch"
            value={settings.pitch === 0 ? '0' : settings.pitch > 0 ? `+${settings.pitch}` : `${settings.pitch}`}
            onDecrement={() => set('pitch', clamp(settings.pitch - 1, -5, 5, 1))}
            onIncrement={() => set('pitch', clamp(settings.pitch + 1, -5, 5, 1))}
            C={C}
          />
        </View>

        {/* ── Language ──────────────────────────────────────────────────── */}
        <SectionHeader title="Language" C={C} />
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 14 }]}>
          <ChipGroup
            value={settings.languageCode as KwameSettings['languageCode']}
            options={[
              { label: 'en-US', value: 'en-US' },
              { label: 'en-KE', value: 'en-KE' },
              { label: 'sw-KE', value: 'sw-KE' },
            ]}
            onChange={(v) => set('languageCode', v)}
            C={C}
          />
        </View>

        {/* ── Response style ─────────────────────────────────────────────── */}
        <SectionHeader title="Response Style" C={C} />
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 14 }]}>
          <ChipGroup
            value={settings.responseStyle}
            options={[
              { label: 'Casual', value: 'casual' },
              { label: 'Professional', value: 'professional' },
              { label: 'Brief', value: 'brief' },
            ]}
            onChange={(v) => set('responseStyle', v)}
            C={C}
          />
        </View>

        {/* ── Behaviour ─────────────────────────────────────────────────── */}
        <SectionHeader title="Behaviour" C={C} />
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.row, { borderBottomColor: C.border, borderBottomWidth: 0 }]}>
            <View style={styles.rowLabelGroup}>
              <Text style={[styles.rowLabel, { color: C.text }]}>Auto-listen</Text>
              <Text style={[styles.rowSub, { color: C.sub }]}>Restart recording after Kwame finishes speaking</Text>
            </View>
            <Switch
              value={settings.autoListen}
              onValueChange={(v) => set('autoListen', v)}
              trackColor={{ false: C.border, true: ORANGE }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── VAD sensitivity ────────────────────────────────────────────── */}
        <SectionHeader title="Voice Detection" C={C} />
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <StepControl
            label="Sensitivity"
            value={`${settings.silenceThresholdDb} dB`}
            onDecrement={() => set('silenceThresholdDb', clamp(settings.silenceThresholdDb - 1, -42, -25, 1))}
            onIncrement={() => set('silenceThresholdDb', clamp(settings.silenceThresholdDb + 1, -42, -25, 1))}
            C={C}
          />
          <StepControl
            label="Silence hold"
            value={`${(settings.silenceHoldMs / 1000).toFixed(1)} s`}
            onDecrement={() => set('silenceHoldMs', clamp(settings.silenceHoldMs - 100, 700, 2000, 100))}
            onIncrement={() => set('silenceHoldMs', clamp(settings.silenceHoldMs + 100, 700, 2000, 100))}
            C={C}
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 34 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  sectionHeader: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 20, marginLeft: 4,
  },

  card: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel:      { fontSize: 15, fontWeight: '500' },
  rowLabelGroup: { flex: 1, marginRight: 12 },
  rowSub:        { fontSize: 12, marginTop: 2, lineHeight: 16 },

  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn:   { width: 30, height: 30, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  stepValue: { fontSize: 14, fontWeight: '700', minWidth: 52, textAlign: 'center' },

  chipGroup:     { flexDirection: 'row', gap: 8 },
  chipGroupItem: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  chipGroupText: { fontSize: 13, fontWeight: '600' },

  voiceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  voiceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceRadio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  voiceRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  voiceCardName: { fontSize: 15, fontWeight: '600' },
  voiceCardDesc: { fontSize: 12, marginTop: 1 },
  previewBtn:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
});
