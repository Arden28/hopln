import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import api from "@/services/apiClient";
import { CacheService } from "@/services/cache";

const TOKEN_KEY    = "hopln_auth_token";
const ME_STALE_MS  = 5 * 60 * 1000; // re-validate /auth/me after 5 min

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone_number: string | null;
  phone_verified_at: string | null;
  avatar: string | null;
  oauth_provider: string | null;
}

interface AuthState {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  avatarTs:        number;
  lastMeFetchAt:   number;
  setAuth:         (user: AuthUser, token: string) => Promise<void>;
  setUser:         (user: AuthUser) => void;
  logout:          () => Promise<void>;
  initialize:      () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,
      isLoading:       true,
      avatarTs:        0,
      lastMeFetchAt:   0,

      setAuth: async (user, token) => {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        set({ user, token, isAuthenticated: true, avatarTs: Date.now(), lastMeFetchAt: Date.now() });
      },

      setUser: (user) => set((prev) => ({
        user,
        avatarTs: user.avatar !== prev.user?.avatar ? Date.now() : prev.avatarTs,
        lastMeFetchAt: Date.now(),
      })),

      logout: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await CacheService.invalidateAll();
        set({ user: null, token: null, isAuthenticated: false, avatarTs: 0, lastMeFetchAt: 0 });
      },

      initialize: async () => {
        try {
          const token = await SecureStore.getItemAsync(TOKEN_KEY);
          if (!token) {
            set({ isLoading: false });
            return;
          }

          const { user: cachedUser, lastMeFetchAt } = get();
          const isStale = !lastMeFetchAt || Date.now() - lastMeFetchAt > ME_STALE_MS;

          // Hydrate immediately from persisted user so UI appears without spinner
          if (cachedUser) {
            set({ token, isAuthenticated: true, isLoading: false });
          }

          // Always re-validate if stale (or first boot)
          if (isStale || !cachedUser) {
            try {
              const response = await api.get("/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
              });
              set({
                user:            response.data,
                token,
                isAuthenticated: true,
                isLoading:       false,
                avatarTs:        cachedUser?.avatar !== response.data.avatar ? Date.now() : get().avatarTs,
                lastMeFetchAt:   Date.now(),
              });
            } catch {
              if (!cachedUser) {
                // No cached user and network failed — log out
                await SecureStore.deleteItemAsync(TOKEN_KEY);
                set({ user: null, token: null, isAuthenticated: false, isLoading: false, avatarTs: 0 });
              }
              // If we have cached user, keep it shown; network will retry next open
            }
          }
        } catch {
          set({ isLoading: false });
        }
      },
    }),
    {
      name:    "hopln:store:auth",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the user object — token stays in SecureStore
      partialize: (state) => ({
        user:          state.user,
        lastMeFetchAt: state.lastMeFetchAt,
        avatarTs:      state.avatarTs,
      }),
    },
  ),
);
