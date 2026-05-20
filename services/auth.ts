import api from "@/services/apiClient";
import { AuthUser } from "@/store/authStore";

export interface AuthTokenResponse {
  token: string;
  user: AuthUser;
}

export interface NeedsPhoneResponse {
  needs_phone_verification: true;
  phone: string;
}

export interface NeedsPhoneSetupResponse {
  needs_phone: true;
  setup_token: string;
}

export const AuthService = {
  async register(data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone_number: string;
  }): Promise<NeedsPhoneResponse> {
    const res = await api.post("/auth/register", data);
    return res.data;
  },

  async login(
    email: string,
    password: string,
  ): Promise<AuthTokenResponse | NeedsPhoneResponse> {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
  },

  async me(): Promise<AuthUser> {
    const res = await api.get("/auth/me");
    return res.data;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },

  async googleAuth(
    idToken: string,
  ): Promise<AuthTokenResponse | NeedsPhoneSetupResponse> {
    const res = await api.post("/auth/google", { id_token: idToken });
    return res.data;
  },

  async appleAuth(
    identityToken: string,
    user?: { name?: string; email?: string },
  ): Promise<AuthTokenResponse | NeedsPhoneSetupResponse> {
    const res = await api.post("/auth/apple", { identity_token: identityToken, user });
    return res.data;
  },

  async sendOtp(phone: string): Promise<void> {
    await api.post("/auth/phone/send", { phone });
  },

  async verifyOtp(
    phone: string,
    code: string,
    setupToken?: string,
  ): Promise<AuthTokenResponse | { verified: true }> {
    const res = await api.post("/auth/phone/verify", {
      phone,
      code,
      ...(setupToken ? { setup_token: setupToken } : {}),
    });
    return res.data;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post("/auth/password/forgot", { email });
  },

  async resetPassword(
    phone: string,
    code: string,
    password: string,
  ): Promise<AuthTokenResponse> {
    const res = await api.post("/auth/password/reset", {
      phone,
      code,
      password,
      password_confirmation: password,
    });
    return res.data;
  },
};
