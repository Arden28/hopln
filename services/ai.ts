// services/ai.ts
import api, { fetchApi } from "./apiClient";

export interface LatLng { lat: number; lng: number; name?: string; }

export interface UserContext {
  currentLocation?: LatLng;
  aliases?: Record<string, LatLng>;
  userId?: string;
}

export interface TransitPlace { name: string; lat: number; lng: number; }

export interface TransitLeg {
  mode: string;
  routeNumber?: string;
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

export interface SavedPlaceResponse {
  id: number;
  name: string;
  lat: number;
  lng: number;
  pin: "home" | "work" | null;
  category: string | null;
}

export interface LocationResolutionAction {
  errorType: "unresolved_location";
  field: "from" | "to";
  unresolvedName: string;
  isAuthenticated: boolean;
  savedPlaces: SavedPlaceResponse[];
}

export interface AiPlanResponse {
  routes?: RouteSummary[]; 
  spoken_response?: string;
  holding_phrase?: string | null;
  tts_audio?: string | null; 
  actionRequired?: LocationResolutionAction; // Intercepts failed geocoding safely
}

export function mapboxThumb(lng: number, lat: number): string {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lng},${lat},15/300x160@2x?access_token=${token}`;
}

export function mapboxJourneyThumb(fromLng: number, fromLat: number, toLng: number, toLat: number): string {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `pin-s+FF6F00(${fromLng},${fromLat}),pin-s+10B981(${toLng},${toLat})` +
    `/auto/320x130@2x?padding=35&access_token=${token}`
  );
}

export const AiService = {
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
      payload.audio = { base64: audioBase64, mime: mimeType ?? 'audio/wav' };
    }
    
    if (currentLat != null && currentLng != null) {
      payload.lat = currentLat;
      payload.lng = currentLng;
    }
    
    if (aliases && Object.keys(aliases).length > 0) payload.aliases = aliases;

    try {
      // Direct Axios instance call bypassing fetchApi to cleanly inject custom timeouts
      const response = await api.post<AiPlanResponse>("/journey/ai-plan", payload, {
        timeout: 90000, // Generous 90s window for LLM, OTP, and Audio Synthesizer
      });
      return response.data;

    } catch (error) {
      console.error("AI Routing Network Error:", error);
      throw error;
    }
  }
};