// store/headingStore.ts
import { create } from "zustand";

// Live device bearing (degrees, 0..360, clockwise from north), sourced from the
// magnetometer. Kept in a store so the sensor's high update rate only re-renders
// the components that actually read it — not the whole map screen.
interface HeadingState {
  heading: number;
  setHeading: (h: number) => void;
}

export const useHeadingStore = create<HeadingState>((set) => ({
  heading: 0,
  setHeading: (heading) => set({ heading }),
}));
