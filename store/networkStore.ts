// store/networkStore.ts
import { create } from "zustand";

interface NetworkState {
  isOnline: boolean;
  setOnline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  setOnline: (v) => set({ isOnline: v }),
}));
