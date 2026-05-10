// hooks/useAiVoice.ts
import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

export function useAiVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      // Force iOS to prioritize our recording and pause background music
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecordingAndGetBase64 = async (): Promise<string | null> => {
    setIsRecording(false);
    setIsProcessing(true); // Switch UI to "Thinking" state
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const recording = recordingRef.current;
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (!uri) return null;

      // Convert the audio file to Base64 string directly on the device!
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      return base64Audio;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return null;
    } finally {
      recordingRef.current = null;
    }
  };

  const resetState = () => setIsProcessing(false);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecordingAndGetBase64,
    resetState
  };
}