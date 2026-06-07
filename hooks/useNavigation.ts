// hooks/useNavigation.ts
import { NavigationEngine, EngineResult } from "@/services/navigationEngine";
import { RouteService } from "@/services/route";
import { VoiceGuide } from "@/services/voiceGuide";
import { useJourneyStore } from "@/store/journeyStore";
import { usePrefsStore } from "@/store/prefsStore";
import { Coords } from "@/utils/mapHelpers";
import { requestBackgroundPermission, startBackgroundTracking, stopBackgroundTracking } from "@/services/backgroundLocation";
import { navSession } from "@/store/navSessionStore";
import {
  scheduleAlightWarning,
  scheduleArrivalNotification,
  scheduleWrongDirectionAlert,
  cancelNotification,
} from "@/services/notifications";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, DeviceEventEmitter } from "react-native";

// EMA alpha for location smoothing, lower = more smoothing (better for bus speed)
const EMA_LOC_WALK    = 0.25;
const EMA_LOC_TRANSIT = 0.12;
const EMA_SPD         = 0.35;
const EMA_HEAD        = 0.3;

function ema(prev: number, next: number, a: number) {
  return prev + a * (next - prev);
}

// Flat-earth distance in metres, accurate to < 0.1% for distances under 1 km.
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dy = (lat2 - lat1) * 111320;
  const dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

export function useNavigation() {
  const activeJourney = useJourneyStore((state) => state.activeJourney);
  const setTripStatus = useJourneyStore((state) => state.setTripStatus);
  const tripStatus    = useJourneyStore((state) => state.tripStatus);
  const navHints      = usePrefsStore((s) => s.prefs.navHints);

  // True for WAITING_FOR_BUS and IN_TRANSIT, use higher-accuracy GPS tier.
  const isNavigating = tripStatus !== "IDLE";

  const engineRef   = useRef<NavigationEngine | null>(null);
  const watchRef    = useRef<Location.LocationSubscription | null>(null);
  const meSmoothRef = useRef<Coords | null>(null);

  // Refs so GPS watcher closures always read the latest values without re-mounting.
  const stepIndexRef         = useRef<number>(0);
  const lastAnnouncedRef     = useRef<string>("");
  const prevStepIndexRef     = useRef<number>(0);
  const lastAlightAlertRef   = useRef<number>(-1);
  const lastAnnouncedStopRef = useRef<string | null>(null);
  const reroutingRef         = useRef<boolean>(false);
  const lastGpsTimeRef       = useRef<number>(Date.now());
  const lastSpeedRef         = useRef<number>(0);
  const lastDeadReckonTimeRef = useRef<number>(Date.now());

  // Items 25 + 28 + 30
  const wrongDirStrikesRef   = useRef<number>(0);
  const wrongDirAnnouncedRef = useRef<boolean>(false);
  const mountedRef           = useRef<boolean>(true);
  const lastSaveTimeRef      = useRef<number>(0);
  const prevSavedStepRef     = useRef<number>(-1);
  const restoredRef          = useRef<boolean>(false);

  // Local notification refs (background nav alerts)
  const appStateRef            = useRef<AppStateStatus>(AppState.currentState);
  const alightNotifIdRef       = useRef<string | null>(null);
  const wrongDirNotifIdRef     = useRef<string | null>(null);
  const alightWarningFiredRef  = useRef<boolean>(false);

  const [navState, setNavState]                 = useState<EngineResult | null>(null);
  const [location, setLocation]                 = useState<Coords | null>(null);
  const [locationPermissionDenied, setPermDenied] = useState(false);
  const [gpsLost, setGpsLost]                   = useState(false);
  const [wrongDirection, setWrongDirection]     = useState(false);
  const [backgroundPermissionGranted, setBgPermGranted] = useState(false);

  // Track component mount state for safe async callbacks.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep appStateRef current so background callbacks can check foreground vs background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  // Keep stepIndexRef in sync with the latest navState.
  useEffect(() => {
    stepIndexRef.current = navState?.stepIndex ?? 0;
  }, [navState?.stepIndex]);

  // Session restore, runs once on mount, before engine init, to rehydrate an
  // interrupted navigation session.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    navSession.restore().then((session) => {
      if (!session || session.tripStatus !== "IN_TRANSIT") return;
      const store = useJourneyStore.getState();
      store.setJourney(session.activeJourney.fromLoc, session.activeJourney.toLoc, session.activeJourney.route);
      store.setTripStatus("IN_TRANSIT");
      stepIndexRef.current     = session.stepIndex;
      prevSavedStepRef.current = session.stepIndex;
      if (session.lastLat != null) {
        meSmoothRef.current = { latitude: session.lastLat, longitude: session.lastLng!, speed: session.lastSpeed };
      }
    });
  }, []);

  // Initialize the engine when a journey becomes active.
  useEffect(() => {
    if (!activeJourney) {
      engineRef.current = null;
      setNavState(null);
      return;
    }

    const allCoords: [number, number][] = [];
    const engineSteps: any[]            = [];

    activeJourney.route.segments.forEach((seg: any) => {
      // API returns [[lat, lng], ...], engine needs [lng, lat].
      (seg.coordinates as [number, number][]).forEach(([lat, lng]) =>
        allCoords.push([lng, lat]),
      );

      engineSteps.push({
        instruction: seg.mode === "WALK"
          ? `Walk to ${seg.to.name}`
          : `Board Line ${seg.route_name} at ${seg.from.name}`,
        distance: seg.distance,
        duration: seg.duration,
        location: [seg.to.lng, seg.to.lat] as [number, number],
        type:     seg.mode,
        subSteps: seg.walk_steps,
        stops:    seg.stops ?? [],
      });
    });

    engineRef.current = new NavigationEngine(allCoords, engineSteps);

    // Re-apply persisted engine state when the engine is rebuilt from a saved session.
    navSession.restore().then((session) => {
      if (session && engineRef.current) {
        engineRef.current.restore(session.highWaterMark, session.engineStrikes);
      }
    });
  }, [activeJourney]);

  // Shared handler for foreground GPS watcher and background DeviceEventEmitter.
  // useCallback([navHints]), all other values accessed via refs to avoid stale closures.
  const handleLocationUpdate = useCallback((loc: Location.LocationObject) => {
    if (!mountedRef.current) return;

    const currentStepType = engineRef.current?.steps[stepIndexRef.current]?.type ?? "WALK";
    const EMA_LOC = currentStepType !== "WALK" ? EMA_LOC_TRANSIT : EMA_LOC_WALK;

    const next: Coords = {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      heading:   loc.coords.heading ?? meSmoothRef.current?.heading ?? 0,
      speed:     loc.coords.speed   ?? 0,
    };

    const p = meSmoothRef.current;
    if (!p) {
      meSmoothRef.current = next;
      setLocation(next);
      return;
    }

    const lat     = ema(p.latitude,  next.latitude,  EMA_LOC);
    const lng     = ema(p.longitude, next.longitude, EMA_LOC);
    const h0      = p.heading ?? 0;
    const h1      = next.heading ?? h0;
    const dh      = ((h1 - h0 + 540) % 360) - 180;
    const heading = (h0 + EMA_HEAD * dh + 360) % 360;
    const speed   = ema(p.speed ?? 0, next.speed ?? 0, EMA_SPD);

    const smoothed = { latitude: lat, longitude: lng, heading, speed };
    meSmoothRef.current = smoothed;
    setLocation(smoothed);
    lastGpsTimeRef.current = Date.now();
    lastSpeedRef.current   = smoothed.speed ?? 0;

    if (useJourneyStore.getState().tripStatus === "IN_TRANSIT" && engineRef.current) {
      const result = engineRef.current.update(
        smoothed.longitude,
        smoothed.latitude,
        smoothed.speed ?? 0,
        stepIndexRef.current,
      );

      // Suppress off-route on transit legs, driver controls the path.
      const stepType = engineRef.current.steps[result.stepIndex]?.type;
      if (result.status === "off_route" && stepType && stepType !== "WALK") {
        result.status = "active";
      }

      // ── Auto re-routing on walk off-route ────────────────────────────────
      if (result.status === "off_route") {
        if (!reroutingRef.current) {
          reroutingRef.current = true;
          const journey = useJourneyStore.getState().activeJourney;
          if (journey && meSmoothRef.current) {
            const fromLoc = {
              ...journey.fromLoc,
              id: "current_location", name: "Current Location",
              lat: meSmoothRef.current.latitude,
              lng: meSmoothRef.current.longitude,
            };
            const maxWalk = usePrefsStore.getState().prefs.maxWalkMeters;
            RouteService.calculateJourney(fromLoc, journey.toLoc, maxWalk)
              .then((routes) => {
                if (routes.length > 0 && mountedRef.current) {
                  useJourneyStore.getState().updateRoute(routes[0]);
                  const hints = usePrefsStore.getState().prefs.navHints;
                  if (hints !== "off") VoiceGuide.announce("Route recalculated.");
                  stepIndexRef.current     = 0;
                  prevStepIndexRef.current = 0;
                  lastAnnouncedRef.current = "";
                }
              })
              .catch(() => {})
              .finally(() => { reroutingRef.current = false; });
          } else {
            reroutingRef.current = false;
          }
        }
        result.status = "rerouting";
      }

      // ── Haptics + voice on step advance ─────────────────────────────────
      if (result.stepIndex !== prevStepIndexRef.current) {
        prevStepIndexRef.current = result.stepIndex;
        lastAnnouncedRef.current = "";
        lastAnnouncedStopRef.current = null;
        wrongDirStrikesRef.current   = 0;
        wrongDirAnnouncedRef.current = false;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      if (result.status === "arrived") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (navHints !== "off") VoiceGuide.announce("You have arrived at your destination.");
        if (appStateRef.current !== "active") {
          const toLoc = useJourneyStore.getState().activeJourney?.toLoc.name ?? "your destination";
          scheduleArrivalNotification(toLoc).catch(() => {});
        }
      }

      // ── Voice guidance on approach phase change ──────────────────────────
      const phaseKey = VoiceGuide.phaseKey(result.stepIndex, result.approachPhase);
      if (phaseKey !== lastAnnouncedRef.current) {
        const upcomingStep = engineRef.current.steps[result.stepIndex];
        const text = VoiceGuide.buildAnnouncement(
          result.approachPhase,
          upcomingStep,
          result.distanceToNextStepM,
          navHints,
        );
        if (text) {
          lastAnnouncedRef.current = phaseKey;
          VoiceGuide.announce(text);
        }
      }

      stepIndexRef.current = result.stepIndex;
      setNavState(result);
      if (result.status === "arrived") useJourneyStore.getState().setTripStatus("ARRIVED");

      // ── Stop name callout (transit legs, detailed hints only) ───────────
      if (navHints === "detailed" && result.currentStopName &&
          result.currentStopName !== lastAnnouncedStopRef.current) {
        lastAnnouncedStopRef.current = result.currentStopName;
        VoiceGuide.announce(`Now passing ${result.currentStopName}.`);
      }

      // ── Alight alerts (transit legs only) ───────────────────────────────
      const stopsRem = result.stopsRemaining;
      if (stopsRem != null) {
        const last = lastAlightAlertRef.current;
        if (stopsRem > 2 && last !== -1) {
          lastAlightAlertRef.current = -1;
        } else if (stopsRem === 2 && last !== 2) {
          lastAlightAlertRef.current = 2;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          if (navHints !== "off") VoiceGuide.announce("Prepare to alight in 2 stops.");
          if (appStateRef.current !== "active" && !alightWarningFiredRef.current) {
            alightWarningFiredRef.current = true;
            const step = engineRef.current?.steps[result.stepIndex];
            scheduleAlightWarning(
              Math.ceil((result.remainingDurationS ?? 120) / 60),
              step?.stops?.at(-1)?.name ?? "your stop",
            ).then((id) => { alightNotifIdRef.current = id; })
              .catch(() => {});
          }
        } else if (stopsRem === 1 && last !== 1) {
          lastAlightAlertRef.current = 1;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          if (navHints !== "off") VoiceGuide.announce("Prepare to alight at the next stop.");
        } else if (stopsRem === 0 && last !== 0) {
          lastAlightAlertRef.current = 0;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          if (navHints !== "off") VoiceGuide.announce("Alight now.");
        }
      }

      // ── Wrong direction detection (walk legs only) ──────────────────────
      const smoothedHeading = smoothed.heading ?? -1;
      const isWalkLeg  = result.currentSegmentMode === "WALK" || result.currentSegmentMode == null;
      const moving     = (smoothed.speed ?? 0) > 1.0;

      if (isWalkLeg && moving && smoothedHeading >= 0) {
        const delta = Math.abs(((smoothedHeading - result.routeBearing + 180) % 360) - 180);
        if (delta > 120) {
          wrongDirStrikesRef.current++;
          if (wrongDirStrikesRef.current >= 4 && !wrongDirAnnouncedRef.current) {
            wrongDirAnnouncedRef.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            if (navHints !== "off") VoiceGuide.announce("You're heading the wrong way. Turn around.");
            if (appStateRef.current !== "active" && !wrongDirNotifIdRef.current) {
              scheduleWrongDirectionAlert()
                .then((id) => { wrongDirNotifIdRef.current = id; })
                .catch(() => {});
            }
          }
        } else {
          wrongDirStrikesRef.current = Math.max(0, wrongDirStrikesRef.current - 1);
          if (delta < 60) {
            wrongDirAnnouncedRef.current = false;
            if (wrongDirNotifIdRef.current) {
              cancelNotification(wrongDirNotifIdRef.current).catch(() => {});
              wrongDirNotifIdRef.current = null;
            }
          }
        }
      } else {
        wrongDirStrikesRef.current = 0;
      }
      setWrongDirection(wrongDirStrikesRef.current >= 4);

      // ── Throttled session persistence (IN_TRANSIT only) ─────────────────
      const nowMs = Date.now();
      const stepChanged = result.stepIndex !== prevSavedStepRef.current;
      if (stepChanged || nowMs - lastSaveTimeRef.current > 10_000) {
        lastSaveTimeRef.current  = nowMs;
        prevSavedStepRef.current = result.stepIndex;
        const journey = useJourneyStore.getState().activeJourney;
        if (journey && engineRef.current) {
          navSession.save({
            version: 1, savedAt: nowMs, tripStatus: "IN_TRANSIT",
            stepIndex: result.stepIndex,
            highWaterMark: engineRef.current.getHighWaterMark(),
            engineStrikes: engineRef.current.getStrikes(),
            lastLat:   meSmoothRef.current?.latitude  ?? null,
            lastLng:   meSmoothRef.current?.longitude ?? null,
            lastSpeed: meSmoothRef.current?.speed     ?? 0,
            activeJourney: journey,
          }).catch(() => {});
        }
      }
    }

    // ── WAITING_FOR_BUS: auto-detect bus departure and start navigation ───
    if (useJourneyStore.getState().tripStatus === "WAITING_FOR_BUS") {
      const journey = useJourneyStore.getState().activeJourney;
      if (journey && engineRef.current) {
        const firstTransit = journey.route.segments.find((s: any) => s.mode !== "WALK");
        if (firstTransit) {
          const d     = distM(smoothed.latitude, smoothed.longitude, firstTransit.from.lat, firstTransit.from.lng);
          const spd   = smoothed.speed ?? 0;

          if (spd > 2.2 && d > 40) {
            useJourneyStore.getState().setTripStatus("IN_TRANSIT");
            engineRef.current.resetProgress();
            stepIndexRef.current     = 0;
            prevStepIndexRef.current = 0;
            lastAnnouncedRef.current = "";
            lastAlightAlertRef.current = -1;

            const hints = usePrefsStore.getState().prefs.navHints;
            if (hints !== "off") {
              const routeName = firstTransit.route_name ?? "bus";
              VoiceGuide.announce(`Journey started. Riding Line ${routeName}.`);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
        }
      }
    }
  }, [navHints]);

  // GPS watcher, restarts when navigation mode or handleLocationUpdate changes.
  useEffect(() => {
    const gpsOptions = isNavigating
      ? { accuracy: Location.Accuracy.Balanced, timeInterval: 3000,  distanceInterval: 5  }
      : { accuracy: Location.Accuracy.Low,      timeInterval: 20000, distanceInterval: 50 };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermDenied(true);
        return;
      }
      setPermDenied(false);

      requestBackgroundPermission().then((granted) => {
        if (mountedRef.current) setBgPermGranted(granted);
      });

      watchRef.current = await Location.watchPositionAsync(gpsOptions, handleLocationUpdate);
    })();

    return () => {
      watchRef.current?.remove();
      VoiceGuide.stop();
      setWrongDirection(false);
      wrongDirStrikesRef.current   = 0;
      wrongDirAnnouncedRef.current = false;
    };
  }, [isNavigating, handleLocationUpdate]);

  // Dead-reckoning interval: advances the engine position when GPS goes dark
  // during IN_TRANSIT. Also drives the GPS-lost indicator shown in the UI.
  useEffect(() => {
    if (!isNavigating) { setGpsLost(false); return; }

    const id = setInterval(() => {
      const now      = Date.now();
      const sinceGps = (now - lastGpsTimeRef.current) / 1000;
      const lost     = sinceGps > 8;
      setGpsLost(lost);

      if (lost && useJourneyStore.getState().tripStatus === "IN_TRANSIT" && engineRef.current) {
        const dt = (now - lastDeadReckonTimeRef.current) / 1000;
        engineRef.current.deadReckon(lastSpeedRef.current, dt);
      }
      lastDeadReckonTimeRef.current = now;
    }, 2000);

    return () => { clearInterval(id); setGpsLost(false); };
  }, [isNavigating]);

  // Start/stop background location tracking based on navigation state and permission.
  useEffect(() => {
    if (isNavigating && backgroundPermissionGranted) startBackgroundTracking();
    else stopBackgroundTracking();
    return () => { stopBackgroundTracking(); };
  }, [isNavigating, backgroundPermissionGranted]);

  // Forward background location events to the shared handler.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("bgLocation", (loc: Location.LocationObject) => {
      handleLocationUpdate(loc);
    });
    return () => sub.remove();
  }, [handleLocationUpdate]);

  const startNavigation = useCallback(() => {
    if (activeJourney) {
      setTripStatus("IN_TRANSIT");

      wrongDirStrikesRef.current   = 0;
      wrongDirAnnouncedRef.current = false;
      lastSaveTimeRef.current      = 0;
      prevSavedStepRef.current     = -1;
      alightWarningFiredRef.current = false;
      alightNotifIdRef.current      = null;
      wrongDirNotifIdRef.current    = null;

      if (engineRef.current) {
        engineRef.current.resetProgress();
        stepIndexRef.current     = 0;
        prevStepIndexRef.current = 0;
        lastAnnouncedRef.current = "";

        const hints = usePrefsStore.getState().prefs.navHints;

        if (meSmoothRef.current) {
          const instantResult = engineRef.current.update(
            meSmoothRef.current.longitude,
            meSmoothRef.current.latitude,
            meSmoothRef.current.speed ?? 0,
            0,
          );
          stepIndexRef.current = instantResult.stepIndex;
          setNavState(instantResult);

          if (hints !== "off") {
            const firstStep = engineRef.current.steps[instantResult.stepIndex];
            const instruction = firstStep?.instruction ?? "";
            VoiceGuide.announce(
              instruction
                ? `Navigation started. ${instruction}.`
                : `Navigation started to ${activeJourney.toLoc.name}.`
            );
            lastAnnouncedRef.current = VoiceGuide.phaseKey(
              instantResult.stepIndex,
              instantResult.approachPhase,
            );
          }
        } else if (hints !== "off") {
          VoiceGuide.announce(`Navigation started to ${activeJourney.toLoc.name}.`);
        }
      }
    }
  }, [activeJourney, setTripStatus]);

  const stopNavigation = useCallback(() => {
    navSession.clear();
    setWrongDirection(false);
    setTripStatus("IDLE");
    setNavState(null);
    VoiceGuide.stop();
  }, [setTripStatus]);

  const openLocationSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return {
    location,
    navState,
    locationPermissionDenied,
    openLocationSettings,
    gpsLost,
    wrongDirection,
    startNavigation,
    stopNavigation,
  };
}
