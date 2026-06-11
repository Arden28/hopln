// services/ai.ts
import { fetchApi } from "./apiClient";

export interface LatLng {
  lat: number;
  lng: number;
  name?: string;
}

export interface UserContext {
  currentLocation?: LatLng;
  aliases?: {
    home?: LatLng;
    work?: LatLng;
    school?: LatLng;
    office?: LatLng;
  };
  userId?: string;
}

export interface TransitPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface TransitLeg {
  mode: string; // e.g., "WALK", "BUS"
  routeNumber?: string; // e.g., "111", "46W"
  durationSeconds: number;
  from: TransitPlace;
  to: TransitPlace;
}

export interface RouteSummary {
  summary: string;
  total_duration: number;
  total_walk_distance: number;
  legs: TransitLeg[];
}

export interface AiPlanResponse {
  route?: RouteSummary | null;
  spoken_response?: string;
  holding_phrase?: string | null;
  tts_audio?: string | null; // Base64 Native WAV audio payload
}

export const AiService = {
  /**
   * Dispatches multimodal conversational payloads to the backend optimization engine.
   */
  async planRoute(
    sessionId: string,
    text?: string,
    audioBase64?: string,
    mimeType?: string,
    currentLat?: number,
    currentLng?: number,
    aliases?: UserContext['aliases'],
  ): Promise<AiPlanResponse> {
    const payload: Record<string, any> = { session_id: sessionId };

    if (text) payload.text = text.trim();
    if (audioBase64) {
      payload.audio = {
        base64: audioBase64,
        mime: mimeType ?? 'audio/wav'
      };
    }
    
    if (currentLat != null && currentLng != null) {
      payload.lat = currentLat;
      payload.lng = currentLng;
    }
    
    if (aliases && Object.keys(aliases).length > 0) {
      payload.aliases = aliases;
    }

    try {
      return await fetchApi<AiPlanResponse>("/journey/ai-plan", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("AI Routing Network Error:", error);
      throw error;
    }
  }
};