import api from "./apiClient";

export type ContributionType =
  | "delay_report"
  | "stop_review"
  | "stop_photo"
  | "stop_edit"
  | "route_correction"
  | "new_stop";

export type ContributionStatus = "pending" | "auto_approved" | "approved" | "rejected";

export interface Contribution {
  id: number;
  user_id: number;
  type: ContributionType;
  stop_id: string | null;
  title: string | null;
  description: string | null;
  data: Record<string, any> | null;
  status: ContributionStatus;
  points_awarded: number;
  expires_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  stop?: { id: string; name: string };
}

export interface Badge {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement_type: string;
  requirement_value: number;
  requirement_meta: Record<string, any> | null;
  points_bonus: number;
  earned?: boolean;
  earned_at?: string | null;
}

export interface CommunityStats {
  points: number;
  level: number;
  level_label: string;
  points_to_next_level: number;
  next_level_label: string;
  submissions_count: number;
  badges_count: number;
  badges_preview: Pick<Badge, "slug" | "name" | "icon" | "color">[];
}

export interface CreateContributionResult {
  data: Contribution;
  points_awarded: number;
  new_badges: string[];
  new_level: number | null;
}

export interface CreateContributionPayload {
  type: ContributionType;
  stop_id?: string | null;
  title?: string;
  description?: string;
  data?: Record<string, any>;
}

export const ContributionService = {
  async getContributions(): Promise<Contribution[]> {
    const res = await api.get<{ data: Contribution[] }>("/user/contributions");
    return res.data.data;
  },

  async createContribution(payload: CreateContributionPayload): Promise<CreateContributionResult> {
    const res = await api.post<CreateContributionResult>("/user/contributions", payload);
    return res.data;
  },

  async deleteContribution(id: number): Promise<void> {
    await api.delete(`/user/contributions/${id}`);
  },

  async vote(id: number, vote: "up" | "down"): Promise<void> {
    await api.post(`/contributions/${id}/vote`, { vote });
  },

  async getNearby(lat: number, lng: number, radius = 5000): Promise<Contribution[]> {
    const res = await api.get<{ data: Contribution[] }>("/contributions/nearby", {
      params: { lat, lng, radius },
    });
    return res.data.data;
  },

  async getStats(): Promise<CommunityStats> {
    const res = await api.get<CommunityStats>("/user/community/stats");
    return res.data;
  },

  async getBadges(): Promise<{ earned: Badge[]; locked: Badge[] }> {
    const res = await api.get<{ earned: Badge[]; locked: Badge[] }>("/user/badges");
    return res.data;
  },

  async getLeaderboard(): Promise<{ id: number; name: string; avatar: string | null; points: number }[]> {
    const res = await api.get<{ data: any[] }>("/community/leaderboard");
    return res.data.data;
  },
};
