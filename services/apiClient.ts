// services/apiClient.ts
import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Platform } from "react-native";
import { useAuthStore } from "@/store/authStore";

const getBaseUrl = () => {
  // 1. Priorité absolue à la variable d'environnement si elle existe
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Pour ton iPhone en Dev Build : on utilise ton IP fixe
  // On vérifie qu'on n'est pas sur un simulateur/émulateur
  if (!Platform.isTV && !Constants.isDevice) {
    // Si c'est un émulateur Android
    if (Platform.OS === "android") return "http://10.0.2.2:8000/api/v1";
    // Si c'est un simulateur iOS (Mac)
    return "http://localhost:8000/api/v1";
  }

  // 3. Fallback pour ton iPhone physique (ton IP locale actuelle)
  return "http://192.168.100.1:8000/api/v1";
};

export const BASE_URL = getBaseUrl();

if (__DEV__) {
  console.log("🚀 API Configured with URL:", BASE_URL);
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 120000, // 120s, AI pipeline (Whisper + GPT + OTP + TTS) can take up to 90s
});

// --- REQUEST: attach Bearer token + logger ---
api.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().token;
    if (token && !config.headers["Authorization"]) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    if (__DEV__) {
      console.log(
        `[REQ: ${config.method?.toUpperCase()}] ${config.url}`,
        config.data || "",
      );
    }
    return config;
  },
  (error) => {
    console.error("Request Error:", error);
    return Promise.reject(error);
  },
);

// --- RESPONSE: logger + 401 handler ---
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[RES: ${response.status}] ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const isLogoutEndpoint = error.config?.url?.includes("/auth/logout");

    if (error.response?.status === 401 && !isLogoutEndpoint) {
      // Only logout when we actually had a token in the store. Skipping this
      // prevents unauthenticated requests (e.g. push-token sync fired before
      // initialize() completes) from wrongly clearing the session.
      const hadToken = !!useAuthStore.getState().token;
      if (hadToken) {
        await useAuthStore.getState().logout();
        router.replace("/(auth)/login");
      }
    }

    if (error.response && !(isLogoutEndpoint && error.response.status === 401)) {
      console.error(
        `[${error.response.status}] API Error:`,
        error.response.data,
      );
    } else if (error.request) {
      console.error("Network Error: Laravel server might be unreachable.");
      console.error(
        `Attempted to reach: ${error.config?.baseURL}${error.config?.url}`,
      );
    } else {
      console.error("Setup Error:", error.message);
    }

    const customError = {
      message: (error.response?.data as any)?.message || "Server connection error",
      status:  error.response?.status,
      errors:  (error.response?.data as any)?.errors,
      data:    error.response?.data as any,
    };

    return Promise.reject(customError);
  },
);

export async function fetchApi<T>(
  endpoint: string,
  options: any = {},
): Promise<T> {
  try {
    const response = await api.request<T>({
      url: endpoint,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

// In-flight deduplication: prevents duplicate parallel GET requests for the same key
const _inflight = new Map<string, Promise<any>>();

export function dedupedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (_inflight.has(key)) return _inflight.get(key)!;
  const p = fetcher().finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

export default api;
