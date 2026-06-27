// hooks/useRatePrompt.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "navigo:rate_prompt_v1";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Replace <REPLACE_WITH_APP_STORE_ID> with the numeric Apple ID once the app is live.
const ANDROID_MARKET = "market://details?id=com.navigo.ke";
const ANDROID_HTTPS  = "https://play.google.com/store/apps/details?id=com.navigo.ke";
const IOS_URL        = "https://apps.apple.com/app/id<REPLACE_WITH_APP_STORE_ID>?action=write-review";

interface RatePromptState {
  completedJourneys: number;
  /** Randomised in [3..7] so the prompt doesn't feel mechanical. */
  threshold:         number;
  promptedAt:        number | null;
  done:              boolean;
}

function randomThreshold(): number {
  return Math.floor(Math.random() * 5) + 3;
}

async function readState(): Promise<RatePromptState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RatePromptState;
  } catch { /* fall through */ }
  return { completedJourneys: 0, threshold: randomThreshold(), promptedAt: null, done: false };
}

async function writeState(state: RatePromptState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export function useRatePrompt() {
  const [visible, setVisible] = useState(false);

  /** Call after each journey completion (tripStatus → "ARRIVED"). */
  const onJourneyComplete = useCallback(async () => {
    const state = await readState();
    if (state.done) return;

    state.completedJourneys += 1;

    const cooldownActive = state.promptedAt !== null && Date.now() - state.promptedAt < COOLDOWN_MS;
    const shouldShow = state.completedJourneys >= state.threshold && !cooldownActive;

    if (shouldShow) {
      state.threshold  = state.completedJourneys + randomThreshold();
      state.promptedAt = Date.now();
    }

    await writeState(state);
    if (shouldShow) setVisible(true);
  }, []);

  const onRate = useCallback(async () => {
    setVisible(false);
    const state = await readState();
    await writeState({ ...state, done: true });

    const url = Platform.OS === "ios" ? IOS_URL : ANDROID_MARKET;
    Linking.openURL(url).catch(() => {
      if (Platform.OS === "android") Linking.openURL(ANDROID_HTTPS).catch(() => {});
    });
  }, []);

  const onLater = useCallback(async () => {
    setVisible(false);
    const state = await readState();
    await writeState({ ...state, promptedAt: Date.now() });
  }, []);

  return { visible, onJourneyComplete, onRate, onLater };
}
