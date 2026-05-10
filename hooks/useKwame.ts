// hooks/useKwame.ts
import { AiService } from '@/services/ai';
import { Coords } from '@/utils/mapHelpers';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useState, useRef, useCallback } from 'react';

// ─── TYPES ───
export type MessageType = 'text' | 'route_card' | 'audio';
export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  type: MessageType;
  content: string;
  routeData?: any; 
}

export function useKwame(me: Coords | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
      id: 'greeting',
      role: 'assistant',
      type: 'text',
      content: "Jambo! I'm Kwame. Where are we heading today?"
  }]);
  
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).substring(7) }]);
  };

  const toggleRecording = async () => {
    if (status === 'idle' || status === 'error') {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') return;

        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        
        recordingRef.current = recording;
        setStatus('listening');
        Speech.stop(); 
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    } else if (status === 'listening') {
      const recording = recordingRef.current;
      if (!recording) return;

      setStatus('processing');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (!uri) return;

        // Render a distinct Audio Bubble for the user
        addMessage({ role: 'user', type: 'audio', content: 'Voice Memo' });

        const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        await handleAiRequest(null, base64Audio);
      } catch (err) {
        console.error(err);
        setStatus('error');
      } finally {
        recordingRef.current = null;
      }
    }
  };

  const submitText = async (text: string) => {
    if (!text.trim()) return;
    Speech.stop();
    addMessage({ role: 'user', type: 'text', content: text });
    setStatus('processing');
    await handleAiRequest(text, null);
  };

  const handleAiRequest = async (text: string | null, audioBase64: string | null) => {
    try {
      const result = await AiService.planRoute(
        text || undefined, 
        audioBase64 || undefined, 
        undefined, 
        me?.latitude, 
        me?.longitude
      );

      if (result?.route) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const responseText = result.spoken_response || "Here is the route I found.";
        addMessage({ role: 'assistant', type: 'text', content: responseText });
        addMessage({ role: 'assistant', type: 'route_card', content: '', routeData: result.route });

        Speech.speak(responseText, { language: 'en-GB', rate: 0.95, pitch: 1.0 });
        setStatus('idle');
      } else if (result?.spoken_response) {
        addMessage({ role: 'assistant', type: 'text', content: result.spoken_response });
        Speech.speak(result.spoken_response, { language: 'en-GB', rate: 0.95 });
        setStatus('idle');
      } else {
        throw new Error("Invalid response format.");
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = "Sorry, I couldn't reach the servers right now.";
      addMessage({ role: 'assistant', type: 'text', content: errMsg });
      Speech.speak(errMsg, { language: 'en-GB' });
      setStatus('error');
    }
  };

  const clearChat = useCallback(() => {
      setMessages([{ id: Math.random().toString(), role: 'assistant', type: 'text', content: "New chat started. Where to?" }]);
  }, []);

  return { messages, status, toggleRecording, submitText, clearChat };
}