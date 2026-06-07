// hooks/useKwame.ts
import { AiService, UserContext } from '@/services/ai';
import { Coords } from '@/utils/mapHelpers';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageType  = 'text' | 'route_card' | 'audio';
export type Role         = 'user' | 'assistant';
export type KwameStatus  = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface ChatMessage {
  id:           string;
  role:         Role;
  type:         MessageType;
  content:      string;
  routeData?:   any;
  audioUri?:    string;
  isStreaming?: boolean;
}

// ─── VAD config ───────────────────────────────────────────────────────────────

const VAD_CONFIG = {
  SILENCE_THRESHOLD_DB: -38,   // dBFS below this is considered silence
  SILENCE_DURATION_MS:  2000,  // ms of continuous silence before auto-stop
  MIN_RECORD_MS:         800,  // ignore VAD during the first 800 ms to avoid clipping
  POLL_INTERVAL_MS:       50,
} as const;

// ─── Recording config, 16 kHz mono, metering enabled for reactive waveform ──

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension:        '.m4a',
    outputFormat:     Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder:     Audio.AndroidAudioEncoder.AAC,
    sampleRate:       16000,
    numberOfChannels: 1,
    bitRate:          128000,
  },
  ios: {
    extension:            '.m4a',
    audioQuality:         Audio.IOSAudioQuality.MAX,
    sampleRate:           16000,
    numberOfChannels:     1,
    bitRate:              128000,
    linearPCMBitDepth:    16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat:     false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
  keepAudioActiveHint: true,
  isMeteringEnabled:   true,
};

const GREETING: ChatMessage = {
  id:      'greeting',
  role:    'assistant',
  type:    'text',
  content: "Jambo! I'm Kwame. Where are we heading today?",
};

const genId        = () => Math.random().toString(36).substring(2, 9);
const genSessionId = () => `ks_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useKwame(me: Coords | null) {
  const [messages, setMessages]               = useState<ChatMessage[]>([GREETING]);
  const [status, setStatus]                   = useState<KwameStatus>('idle');
  const [meterLevel, setMeterLevel]           = useState(0);
  const [voiceMode, setVoiceMode]             = useState(false);
  const [lastKwameText, setLastKwameText]     = useState('');
  const [isCaptionStreaming, setIsCaptionStreaming] = useState(false);

  // ── State mirrors, avoid stale closures inside setInterval / async callbacks ─
  const statusRef    = useRef<KwameStatus>('idle');
  const voiceModeRef = useRef(false);
  const meRef        = useRef<Coords | null>(me);

  useEffect(() => { statusRef.current    = status;    }, [status]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { meRef.current        = me;        }, [me]);

  // ── Stable refs ───────────────────────────────────────────────────────────
  const sessionIdRef          = useRef(genSessionId());
  const recordingRef          = useRef<Audio.Recording | null>(null);
  const meterIntervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamCaptionRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsSoundRef           = useRef<Audio.Sound | null>(null);
  const silenceStartRef       = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Break circular deps: startMetering → autoStopRecording → handleAiRequest → startRecording → startMetering
  const autoStopRef       = useRef<(() => Promise<void>) | null>(null);
  const startRecordingRef = useRef<((isAutoRestart?: boolean) => Promise<void>) | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addMessage = (msg: Omit<ChatMessage, 'id'>) =>
    setMessages(prev => [...prev, { ...msg, id: genId() }]);

  const streamIntoMessage = (text: string, msgId: string, onDone?: () => void) => {
    if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    const speed = Math.min(30, Math.max(10, Math.round(2000 / text.length)));
    let i = 0;
    streamTimerRef.current = setInterval(() => {
      i++;
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, content: text.slice(0, i), isStreaming: i < text.length }
            : m,
        ),
      );
      if (i >= text.length) {
        clearInterval(streamTimerRef.current!);
        streamTimerRef.current = null;
        onDone?.();
      }
    }, speed);
  };

  const streamCaption = (text: string) => {
    if (streamCaptionRef.current) clearInterval(streamCaptionRef.current);
    setLastKwameText('');
    setIsCaptionStreaming(true);
    const speed = Math.min(22, Math.max(7, Math.round(1400 / text.length)));
    let i = 0;
    streamCaptionRef.current = setInterval(() => {
      i++;
      setLastKwameText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(streamCaptionRef.current!);
        streamCaptionRef.current = null;
        setIsCaptionStreaming(false);
      }
    }, speed);
  };

  const stopCaptionStream = () => {
    if (streamCaptionRef.current) {
      clearInterval(streamCaptionRef.current);
      streamCaptionRef.current = null;
    }
    setIsCaptionStreaming(false);
  };

  // ── TTS ───────────────────────────────────────────────────────────────────

  const stopTTS = useCallback(async () => {
    Speech.stop();
    if (ttsSoundRef.current) {
      try { await ttsSoundRef.current.stopAsync(); }   catch {}
      try { await ttsSoundRef.current.unloadAsync(); } catch {}
      ttsSoundRef.current = null;
    }
  }, []);

  const playTTSAudio = useCallback(
    (base64Mp3: string, fallbackText: string): Promise<void> =>
      new Promise(async resolve => {
        await stopTTS();
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
          const path = (FileSystem.cacheDirectory ?? '') + 'kwame_tts.mp3';
          await FileSystem.writeAsStringAsync(path, base64Mp3, { encoding: 'base64' });
          const { sound } = await Audio.Sound.createAsync({ uri: path });
          ttsSoundRef.current = sound;
          sound.setOnPlaybackStatusUpdate(st => {
            if (st.isLoaded && st.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              if (ttsSoundRef.current === sound) ttsSoundRef.current = null;
              resolve();
            }
          });
          await sound.playAsync();
        } catch (e) {
          console.warn('TTS playback error, falling back to expo-speech', e);
          Speech.speak(fallbackText, {
            language: 'en-GB', rate: 0.95, pitch: 1.0,
            onDone: resolve,
          });
        }
      }),
    [stopTTS],
  );

  // ── Metering + VAD ────────────────────────────────────────────────────────

  const stopMetering = () => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    setMeterLevel(0);
    silenceStartRef.current = null;
  };

  const startMetering = () => {
    silenceStartRef.current = null;
    meterIntervalRef.current = setInterval(async () => {
      if (!recordingRef.current) return;
      try {
        const s = await recordingRef.current.getStatusAsync();
        if (s.isRecording && s.metering != null) {
          // dBFS range: ~−60 to 0 → normalise to 0–1
          setMeterLevel(Math.max(0, Math.min(1, (s.metering + 60) / 60)));

          // VAD, skip the first MIN_RECORD_MS to avoid clipping the start of speech
          const elapsed = Date.now() - recordingStartTimeRef.current;
          if (elapsed < VAD_CONFIG.MIN_RECORD_MS) return;

          if (s.metering < VAD_CONFIG.SILENCE_THRESHOLD_DB) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= VAD_CONFIG.SILENCE_DURATION_MS) {
              silenceStartRef.current = null; // prevent double-trigger before interval clears
              autoStopRef.current?.();
            }
          } else {
            silenceStartRef.current = null; // voice detected, reset silence timer
          }
        }
      } catch {}
    }, VAD_CONFIG.POLL_INTERVAL_MS);
  };

  // ── User context ──────────────────────────────────────────────────────────

  const buildUserContext = (): UserContext => {
    const loc = meRef.current;
    if (!loc) return {};

    const coords = { lat: loc.latitude, lng: loc.longitude };
    return {
      currentLocation: coords,
      // Temporary fallback: all alias keywords resolve to current GPS.
      // Auth upgrade path: replace each entry with the user's actual saved address coords.
      aliases: {
        home:   coords,
        work:   coords,
        school: coords,
        office: coords,
      },
    };
  };

  // ── AI request ────────────────────────────────────────────────────────────

  const handleAiRequest = async (
    text:            string | null,
    audioBase64:     string | null,
    userAudioMsgId?: string,
  ) => {
    try {
      const ctx = buildUserContext();
      const result = await AiService.planRoute(
        sessionIdRef.current,
        text        ?? undefined,
        audioBase64 ?? undefined,
        undefined,
        ctx.currentLocation?.lat,
        ctx.currentLocation?.lng,
        ctx.aliases,
      );

      // Replace audio bubble with transcript text once it arrives
      if (result?.transcript && userAudioMsgId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === userAudioMsgId
              ? { ...m, type: 'text' as const, content: result.transcript! }
              : m,
          ),
        );
      }

      // Play holding phrase audio before the final response
      if (result?.holding_phrase) {
        setLastKwameText(result.holding_phrase);
        if (result.holding_tts) {
          await playTTSAudio(result.holding_tts, result.holding_phrase);
        }
      }

      const responseText = result?.spoken_response ?? "Here's what I found.";

      const speakFinal = async () => {
        setStatus('speaking');
        statusRef.current = 'speaking';
        // Start caption stream in sync with TTS so text and audio appear together
        streamCaption(responseText);
        if (result?.tts_audio) {
          await playTTSAudio(result.tts_audio, responseText);
        } else {
          await new Promise<void>(resolve => {
            Speech.speak(responseText, { language: 'en-GB', rate: 0.95, pitch: 1.0, onDone: resolve });
          });
        }
        setStatus('idle');
        statusRef.current = 'idle';

        // Continuous voice mode: auto-restart mic after Kwame finishes speaking
        if (voiceModeRef.current) {
          startRecordingRef.current?.(true);
        }
      };

      if (result?.route) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const textMsgId = genId();
        setMessages(prev => [...prev, {
          id: textMsgId, role: 'assistant', type: 'text', content: '', isStreaming: true,
        }]);
        streamIntoMessage(responseText, textMsgId, () => {
          addMessage({ role: 'assistant', type: 'route_card', content: '', routeData: result.route });
          speakFinal();
        });
      } else if (result?.spoken_response) {
        const textMsgId = genId();
        setMessages(prev => [...prev, {
          id: textMsgId, role: 'assistant', type: 'text', content: '', isStreaming: true,
        }]);
        streamIntoMessage(result.spoken_response, textMsgId, () => speakFinal());
      } else {
        throw new Error('Empty response from AI.');
      }

    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = "Sorry, I couldn't reach the servers right now.";
      setLastKwameText(errMsg);
      addMessage({ role: 'assistant', type: 'text', content: errMsg });
      Speech.speak(errMsg, { language: 'en-GB' });
      setStatus('error');
      statusRef.current = 'error';
    }
  };

  // ── Recording ─────────────────────────────────────────────────────────────

  const autoStopRecording = async () => {
    // Synchronously update statusRef to block any re-entry from the VAD interval
    if (statusRef.current !== 'listening') return;
    statusRef.current = 'processing';

    const recording = recordingRef.current;
    if (!recording) return;

    stopMetering();
    setStatus('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return;

      const audioMsgId = genId();
      setMessages(prev => [...prev, {
        id: audioMsgId, role: 'user', type: 'audio',
        content: 'Voice message', audioUri: uri,
      }]);

      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      await handleAiRequest(null, base64Audio, audioMsgId);

    } catch (err) {
      console.error(err);
      setStatus('error');
      statusRef.current = 'error';
    } finally {
      recordingRef.current = null;
    }
  };
  autoStopRef.current = autoStopRecording;

  const startRecording = async (isAutoRestart = false) => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') return;

      await stopTTS();

      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current          = recording;
      recordingStartTimeRef.current = Date.now();
      statusRef.current             = 'listening';
      setStatus('listening');

      if (!isAutoRestart) {
        voiceModeRef.current = true;
        setVoiceMode(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      startMetering();
    } catch (err) {
      console.error(err);
      statusRef.current = 'error';
      setStatus('error');
    }
  };
  startRecordingRef.current = startRecording;

  // ── Public actions ────────────────────────────────────────────────────────

  const toggleRecording = async () => {
    const s = statusRef.current;
    if (s === 'idle' || s === 'error') {
      await startRecording(false);
    } else if (s === 'listening') {
      await autoStopRecording();
    } else if (s === 'speaking') {
      // Interrupt Kwame mid-speech and go straight to listening
      await stopTTS();
      statusRef.current = 'idle';
      setStatus('idle');
      if (voiceModeRef.current) {
        await startRecording(true);
      }
    }
  };

  const submitText = async (text: string) => {
    if (!text.trim()) return;
    await stopTTS();
    addMessage({ role: 'user', type: 'text', content: text });
    statusRef.current = 'processing';
    setStatus('processing');
    setLastKwameText('');
    await handleAiRequest(text, null);
  };

  const clearChat = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    stopTTS();
    stopMetering();
    stopCaptionStream();
    sessionIdRef.current  = genSessionId();
    statusRef.current     = 'idle';
    setMessages([{ id: genId(), role: 'assistant', type: 'text', content: "New chat started. Where to?" }]);
    setStatus('idle');
    setLastKwameText('');
  }, [stopTTS]);

  const exitVoiceMode = useCallback(async () => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    stopMetering();
    stopCaptionStream();
    await stopTTS();
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    statusRef.current = 'idle';
    setStatus('idle');
  }, [stopTTS]);

  return {
    messages,
    status,
    meterLevel,
    voiceMode,
    lastKwameText,
    isCaptionStreaming,
    toggleRecording,
    submitText,
    clearChat,
    exitVoiceMode,
  };
}
