// hooks/useNavigation.ts
import { NavigationEngine, EngineResult } from '@/services/navigationEngine';
import { useJourneyStore } from '@/store/journeyStore';
import { Coords } from '@/utils/mapHelpers';
import polyline from '@mapbox/polyline';
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
  const tripStatus    = useJourneyStore((state) => state.tripStatus);
  const setTripStatus = useJourneyStore((state) => state.setTripStatus);

  const engineRef     = useRef<NavigationEngine | null>(null);
  const watchRef      = useRef<Location.LocationSubscription | null>(null);
  const meSmoothRef   = useRef<Coords | null>(null);

  const [navState, setNavState] = useState<EngineResult | null>(null);
  const [location, setLocation] = useState<Coords | null>(null);

  // Initialize the engine when a journey becomes active
  useEffect(() => {
    if (!activeJourney) {
      engineRef.current = null;
      setNavState(null);
      return;
    }

    let allCoords: [number, number][] = [];
    const engineSteps: any[] = [];

    activeJourney.route.segments.forEach((seg: any) => {
        const decoded = polyline.decode(seg.polyline).map(c => [c[1], c[0]] as [number, number]);
        allCoords.push(...decoded);
        
        // Push the segment as a logical step
        engineSteps.push({
           instruction: seg.mode === 'WALK' ? `Walk to ${seg.to.name}` : `Board Line ${seg.route_name}`,
           distance: seg.distance,
           duration: seg.duration,
           location: [seg.to.lng, seg.to.lat] as [number, number],
           type: seg.mode,
           subSteps: seg.walk_steps // <--- THIS IS THE MAGIC LINE
        });
      });

    engineRef.current = new NavigationEngine(allCoords, engineSteps);
  }, [activeJourney]);

  // Global GPS Watcher
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
          
          const lat = ema(p.latitude, next.latitude, EMA_LOC);
          const lng = ema(p.longitude, next.longitude, EMA_LOC);
          const h0  = p.heading ?? 0;
          const h1  = next.heading ?? h0;
          const dh  = ((h1 - h0 + 540) % 360) - 180;
          const heading = (h0 + EMA_HEAD * dh + 360) % 360;
          const speed = ema(p.speed ?? 0, next.speed ?? 0, EMA_SPD);
          
          const smoothed = { latitude: lat, longitude: lng, heading, speed };
          meSmoothRef.current = smoothed;
          setLocation(smoothed);

          // If navigating, feed the engine!
          const currentTripStatus = useJourneyStore.getState().tripStatus;
          if (currentTripStatus === "IN_TRANSIT" && engineRef.current) {
             const result = engineRef.current.update(
               smoothed.longitude,
               smoothed.latitude,
               smoothed.speed ?? 0,
               navState?.stepIndex ?? 0
             );

             // Bus Mode Override: Ignore off-route warnings if they are on a Matatu
             const currentStepType = engineRef.current.steps[result.stepIndex]?.type;
             if (result.status === 'off_route' && (currentStepType === 'BUS' || currentStepType === 'TRAM')) {
                 result.status = 'active'; 
             }

             setNavState(result);
             if (result.status === 'arrived') setTripStatus('ARRIVED');
          }
        }
      );
    })();
    return () => { mounted = false; watchRef.current?.remove(); };
  }, []);

  const startNavigation = useCallback(() => {
    if (activeJourney) {
      setTripStatus("IN_TRANSIT");
      
      if (engineRef.current) {
        engineRef.current.resetProgress();
        
        // THE LATENCY FIX
        // Don't wait for the next GPS tick (which could take 1-2 seconds).
        // Instantly force an engine update using the last known smoothed location!
        if (meSmoothRef.current) {
          const instantResult = engineRef.current.update(
            meSmoothRef.current.longitude,
            meSmoothRef.current.latitude,
            meSmoothRef.current.speed ?? 0,
            0 // Start at step 0
          );
          setNavState(instantResult);
        }
      }
    }
  }, [activeJourney, setTripStatus]);

  const stopNavigation = useCallback(() => {
    setTripStatus("IDLE");
    setNavState(null);
  }, [setTripStatus]);

  return { location, navState, startNavigation, stopNavigation };
}