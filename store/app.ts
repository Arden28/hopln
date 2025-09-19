import { create } from "zustand";

type SearchState = {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
};

export const useSearch = create<SearchState>((set) => ({
  from: "",
  to: "",
  setFrom: (v) => set({ from: v }),
  setTo: (v) => set({ to: v }),
}));
