// hooks/useHeadingTracker.ts
import { useHeadingStore } from "@/store/headingStore";
import * as Location from "expo-location";
import { useEffect } from "react";

// Circular EMA so the smoothed value wraps correctly across the 0/360 seam.
function emaAngle(prev: number, next: number, a: number): number {
  const d = ((next - prev + 540) % 360) - 180;
  return (prev + a * d + 360) % 360;
}

/**
 * Subscribes once to the device compass and publishes a smoothed bearing to the
 * heading store. Unlike GPS course-over-ground, the compass updates even when
 * the user is standing still — which is what makes the heading beam track in
 * real time at rest. Writing to a store (instead of local state) means the
 * caller does NOT re-render at sensor rate; only store readers do.
 */
export function useHeadingTracker(): void {
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cur = useHeadingStore.getState().heading;
    let last = 0;

    (async () => {
      try {
        sub = await Location.watchHeadingAsync((h) => {
          // trueHeading needs location services; magHeading is always available.
          const raw = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (raw == null || raw < 0) return;

          const now = Date.now();
          if (now - last < 80) return; // throttle to ~12 Hz
          last = now;

          cur = emaAngle(cur, raw, 0.2);
          useHeadingStore.getState().setHeading(cur);
        });
      } catch {
        // Compass unavailable (e.g. emulator) — beam simply points north.
      }
    })();

    return () => { sub?.remove(); };
  }, []);
}
