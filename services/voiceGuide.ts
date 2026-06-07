// services/voiceGuide.ts
// Thin wrapper around expo-speech for navigation announcements.
// Callers decide WHEN to speak; this module decides HOW.
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import type { ApproachPhase, NavStep } from "./navigationEngine";

type NavHints = "off" | "concise" | "detailed";

// On iOS, AVSpeechSynthesizer respects the ringer/silent switch by default.
// Setting playsInSilentModeIOS overrides this so navigation voice works even
// when the phone is on silent. We configure it once and cache the result.
let _audioConfigured = false;
let _audioPromise: Promise<void> | null = null;

function prepareAudio(): Promise<void> {
  if (_audioConfigured) return Promise.resolve();
  if (!_audioPromise) {
    _audioPromise = Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS:   false,
    })
      .then(() => { _audioConfigured = true; })
      .catch(() => { _audioPromise = null; }); // allow retry on next call
  }
  return _audioPromise ?? Promise.resolve();
}

function niceDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} metres`;
  return `${(m / 1000).toFixed(1)} kilometres`;
}

export const VoiceGuide = {
  /**
   * Speak a navigation cue.
   * Audio session is configured lazily on the first call (< 1 ms after first
   * successful setup). stop() + speak() are called inside the resolved
   * promise so they never race with an in-progress stop on Android TTS.
   */
  announce(text: string) {
    prepareAudio()
      .then(() => {
        Speech.stop();
        Speech.speak(text, { language: "en", rate: 1.05, pitch: 1.0 });
      })
      .catch(() => {
        // Audio session failed, try anyway (works on Android, newer iOS)
        Speech.stop();
        Speech.speak(text, { language: "en", rate: 1.05, pitch: 1.0 });
      });
  },

  stop() {
    Speech.stop();
  },

  /**
   * Build the announcement string for a given approach phase.
   * Returns null when the hints setting should silence this phase.
   */
  buildAnnouncement(
    phase:               ApproachPhase,
    step:                NavStep | undefined,
    distanceToNextStepM: number,
    navHints:            NavHints,
  ): string | null {
    if (!phase || !step || navHints === "off") return null;
    // concise = imminent only; detailed = all three phases
    if (navHints === "concise" && phase !== "imminent") return null;

    const instruction = step.instruction ?? "Continue";

    if (phase === "imminent") return instruction;
    return `In ${niceDistance(distanceToNextStepM)}, ${instruction.toLowerCase()}`;
  },

  /** Stale-key to prevent re-announcing the same phase for the same step. */
  phaseKey(stepIndex: number, phase: ApproachPhase): string {
    return `${stepIndex}-${phase ?? "null"}`;
  },
};
