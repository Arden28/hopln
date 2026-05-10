// services/ai.service.ts
import { fetchApi } from "./apiClient";

export const AiService = {
  async planRoute(text?: string, audioBase64?: string, mimeType?: string, currentLat?: number, currentLng?: number) {
    const payload: any = {};
    
    if (text) payload.text = text;
    if (audioBase64) {
        payload.audio = {
            base64: audioBase64,
            mime: mimeType || 'audio/m4a'
        };
    }
    
    // Pass the user's actual GPS to the backend!
    if (currentLat && currentLng) {
        payload.lat = currentLat;
        payload.lng = currentLng;
    }

    const data = await fetchApi<{ route: any, spoken_response?: string }>("/journey/ai-plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data;
  },
};