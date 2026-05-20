// hooks/useNavigation.ts
import { NavigationEngine, EngineResult } from '@/services/navigationEngine';
import { useJourneyStore } from '@/store/journeyStore';
import { Coords } from '@/utils/mapHelpers';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

const EMA_LOC  = 0.25;
const EMA_SPD  = 0.35;
const EMA_HEAD = 0.3;

function ema(prev: number, next: number, a: number) {
  return prev + a * (next - prev);
}

export function useNavigation() {
  const activeJourney = useJourneyStore((state) => state.activeJourney);
  const setTripStatus = useJourneyStore((state) => state.setTripStatus);

  const engineRef      = useRef<NavigationEngine | null>(null);
  const watchRef       = useRef<Location.LocationSubscription | null>(null);
  const meSmoothRef    = useRef<Coords | null>(null);
  // Ref so the GPS watcher closure always reads the latest step index without re-mounting.
  const stepIndexRef   = useRef<number>(0);

  const [navState, setNavState] = useState<EngineResult | null>(null);
  const [location, setLocation] = useState<Coords | null>(null);

  // Keep stepIndexRef in sync with the latest navState.
  useEffect(() => {
    stepIndexRef.current = navState?.stepIndex ?? 0;
  }, [navState?.stepIndex]);

  // Initialize the engine when a journey becomes active.
  useEffect(() => {
    if (!activeJourney) {
      engineRef.current = null;
      setNavState(null);
      return;
    }

    let allCoords: [number, number][] = [];
    const engineSteps: any[] = [];

    activeJourney.route.segments.forEach((seg: any) => {
      // seg.coordinates is [[lat, lng], ...] from the API — engine needs [lng, lat].
      const segCoords = (seg.coordinates as [number, number][]).map(
        ([lat, lng]) => [lng, lat] as [number, number],
      );
      allCoords.push(...segCoords);

      engineSteps.push({
        instruction: seg.mode === 'WALK' ? `Walk to ${seg.to.name}` : `Board Line ${seg.route_name}`,
        distance:    seg.distance,
        duration:    seg.duration,
        location:    [seg.to.lng, seg.to.lat] as [number, number],
        type:        seg.mode,
        subSteps:    seg.walk_steps,
      });
    });

    engineRef.current = new NavigationEngine(allCoords, engineSteps);
  }, [activeJourney]);

  // Global GPS watcher — mounts once, reads engine state through refs.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
        (loc) => {
          if (!mounted) return;

          const next: Coords = {
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading:   loc.coords.heading ?? meSmoothRef.current?.heading ?? 0,
            speed:     loc.coords.speed   ?? 0,
          };

          // EMA Smoothing
          const p = meSmoothRef.current;
          if (!p) {
            meSmoothRef.current = next;
            setLocation(next);
            return;
          }

          const lat = ema(p.latitude,  next.latitude,  EMA_LOC);
          const lng = ema(p.longitude, next.longitude, EMA_LOC);
          const h0  = p.heading ?? 0;
          const h1  = next.heading ?? h0;
          const dh  = ((h1 - h0 + 540) % 360) - 180;
          const heading = (h0 + EMA_HEAD * dh + 360) % 360;
          const speed   = ema(p.speed ?? 0, next.speed ?? 0, EMA_SPD);

          const smoothed = { latitude: lat, longitude: lng, heading, speed };
          meSmoothRef.current = smoothed;
          setLocation(smoothed);

          if (useJourneyStore.getState().tripStatus === 'IN_TRANSIT' && engineRef.current) {
            const result = engineRef.current.update(
              smoothed.longitude,
              smoothed.latitude,
              smoothed.speed ?? 0,
              stepIndexRef.current,
            );

            // Bus mode override: ignore off-route on transit legs (driver, not walker).
            const stepType = engineRef.current.steps[result.stepIndex]?.type;
            if (result.status === 'off_route' && (stepType === 'BUS' || stepType === 'TRAM')) {
              result.status = 'active';
            }

            stepIndexRef.current = result.stepIndex;
            setNavState(result);
            if (result.status === 'arrived') useJourneyStore.getState().setTripStatus('ARRIVED');
          }
        },
      );
    })();
    return () => { mounted = false; watchRef.current?.remove(); };
  }, []);

  const startNavigation = useCallback(() => {
    if (activeJourney) {
      setTripStatus('IN_TRANSIT');

      if (engineRef.current) {
        engineRef.current.resetProgress();
        stepIndexRef.current = 0;

        // Instant engine update from last known position — avoids 1-2 s latency.
        if (meSmoothRef.current) {
          const instantResult = engineRef.current.update(
            meSmoothRef.current.longitude,
            meSmoothRef.current.latitude,
            meSmoothRef.current.speed ?? 0,
            0,
          );
          stepIndexRef.current = instantResult.stepIndex;
          setNavState(instantResult);
        }
      }
    }
  }, [activeJourney, setTripStatus]);

  const stopNavigation = useCallback(() => {
    setTripStatus('IDLE');
    setNavState(null);
  }, [setTripStatus]);

  return { location, navState, startNavigation, stopNavigation };
}
