// services/ai.ts
import { fetchApi } from "./apiClient";

export interface UserContext {
  currentLocation?: { lat: number; lng: number };
  /**
   * Resolved coordinates for personal alias keywords.
   * Today: populated from current GPS.
   * With auth: populated from the user's saved profile addresses.
   */
  aliases?: {
    home?:   { lat: number; lng: number };
    work?:   { lat: number; lng: number };
    school?: { lat: number; lng: number };
    office?: { lat: number; lng: number };
  };
  userId?: string;
}

export interface AiPlanResponse {
  route?:           any;
  spoken_response?: string;
  holding_phrase?:  string;
  holding_tts?:     string; // base64 MP3 played while route is calculating
  transcript?:      string;
  tts_audio?:       string; // base64 MP3 for the final spoken response
}

export const AiService = {
  async planRoute(
    sessionId:    string,
    text?:        string,
    audioBase64?: string,
    mimeType?:    string,
    currentLat?:  number,
    currentLng?:  number,
    aliases?:     UserContext['aliases'],
  ): Promise<AiPlanResponse> {
    const payload: Record<string, any> = { session_id: sessionId };

    if (text)        payload.text  = text;
    if (audioBase64) payload.audio = { base64: audioBase64, mime: mimeType ?? 'audio/m4a' };
    if (currentLat != null && currentLng != null) {
      payload.lat = currentLat;
      payload.lng = currentLng;
    }
    if (aliases && Object.keys(aliases).length > 0) {
      payload.aliases = aliases;
    }

    return fetchApi<AiPlanResponse>("/journey/ai-plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
