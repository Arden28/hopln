import { create } from "zustand";
import {
  Badge,
  CommunityStats,
  Contribution,
  ContributionService,
  CreateContributionPayload,
} from "@/services/contribution";

interface ContributionStore {
  contributions: Contribution[];
  stats: CommunityStats | null;
  badges: { earned: Badge[]; locked: Badge[] };
  loaded: boolean;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  submit: (payload: CreateContributionPayload) => Promise<{ points_awarded: number; new_badges: string[] }>;
  removeContribution: (id: number) => Promise<void>;
}

export const useContributionStore = create<ContributionStore>((set, get) => ({
  contributions: [],
  stats: null,
  badges: { earned: [], locked: [] },
  loaded: false,

  async fetch() {
    if (get().loaded) return;
    await get().refresh();
  },

  async refresh() {
    const [contributions, stats, badges] = await Promise.all([
      ContributionService.getContributions(),
      ContributionService.getStats(),
      ContributionService.getBadges(),
    ]);
    set({ contributions, stats, badges, loaded: true });
  },

  reset() {
    set({ contributions: [], stats: null, badges: { earned: [], locked: [] }, loaded: false });
  },

  async submit(payload) {
    const result = await ContributionService.createContribution(payload);
    set((s) => ({
      contributions: [result.data, ...s.contributions],
      stats: s.stats
        ? {
            ...s.stats,
            points: s.stats.points + result.points_awarded,
            submissions_count: s.stats.submissions_count + 1,
          }
        : null,
    }));
    if (result.new_badges.length > 0) {
      const badges = await ContributionService.getBadges();
      const stats = await ContributionService.getStats();
      set({ badges, stats });
    }
    return { points_awarded: result.points_awarded, new_badges: result.new_badges };
  },

  async removeContribution(id) {
    set((s) => ({
      contributions: s.contributions.filter((c) => c.id !== id),
      stats: s.stats
        ? { ...s.stats, submissions_count: Math.max(0, s.stats.submissions_count - 1) }
        : null,
    }));
    await ContributionService.deleteContribution(id);
  },
}));
