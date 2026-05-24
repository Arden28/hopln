import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import api from "@/services/apiClient";

const TOKEN_KEY = "hopln_auth_token";

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
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  avatarTs: number;
  setAuth: (user: AuthUser, token: string) => Promise<void>;
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  avatarTs: 0,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ user, token, isAuthenticated: true, avatarTs: Date.now() });
  },

  setUser: (user) => set((prev) => ({
    user,
    avatarTs: user.avatar !== prev.user?.avatar ? Date.now() : prev.avatarTs,
  })),

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ user: null, token: null, isAuthenticated: false, avatarTs: 0 });
  },

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const response = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      set({
        user: response.data,
        token,
        isAuthenticated: true,
        isLoading: false,
        avatarTs: Date.now(),
      });
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, avatarTs: 0 });
    }
  },
}));
