import { create } from "zustand";

interface ReportVoteState {
  votes: Record<string, "up" | "down">;
  setVote: (id: string, vote: "up" | "down" | null) => void;
}

// In-memory vote state: persists across ReportDetailCard opens within the
// same session. Prevents the card from showing userVote=null when reopened
// after a vote was already cast (which made votes look "phantom" to the user).
export const useReportVoteStore = create<ReportVoteState>((set) => ({
  votes: {},
  setVote: (id, vote) =>
    set((s) => {
      const next = { ...s.votes };
      if (vote === null) { delete next[id]; }
      else { next[id] = vote; }
      return { votes: next };
    }),
}));
