import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface ReportVoteState {
  votes: Record<string, "up" | "down">;
  setVote: (id: string, vote: "up" | "down" | null) => void;
}

export const useReportVoteStore = create<ReportVoteState>()(
  persist(
    (set) => ({
      votes: {},
      setVote: (id, vote) =>
        set((s) => {
          const next = { ...s.votes };
          if (vote === null) { delete next[id]; }
          else { next[id] = vote; }
          return { votes: next };
        }),
    }),
    {
      name: "navigo:store:votes",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
