// services/navigationEngine.ts
//
// Projection-based navigation engine.
// Instead of checking "am I close to step N's endpoint?" we project the user
// onto the full route polyline, compute how far along the route they are, and
// derive every navigation metric from that single number (distanceAlongRoute).
//
// This makes step advancement, ETA, and off-route detection robust against
// the 5–15 m GPS noise that breaks endpoint-proximity approaches.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavStep {
  instruction: string;
  distance: number;
  duration: number;
  location: [number, number]; // [lng, lat]  – GeoJSON convention
  type?: string;
  /** Populated internally by the engine. Do not set manually. */
  routeOffset?: number;
}

export type EngineStatus = "active" | "off_route" | "arrived";

export interface EngineResult {
  status: EngineStatus;
  /** Index into the steps array the user is currently heading toward. */
  stepIndex: number;
  remainingDistanceM: number;
  remainingDurationS: number;
  eta: Date;
  /** Distance to the *next* step's trigger point along the route. */
  distanceToNextStepM: number;
  /** Route bearing at the user's current projected position (degrees, 0 = north). */
  routeBearing: number;
  /** Perpendicular distance from user to the nearest route segment (m). */
  distanceFromRouteM: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_R_M          = 6_371_000;
/** How far off the line (m) counts as a strike. */
const OFF_ROUTE_THRESH_M = 45;
/** How many consecutive strikes before we declare off-route. */
const OFF_ROUTE_STRIKES  = 3;
/** Within this many metres of the final coordinate = arrived. */
const ARRIVE_M           = 20;
/** Fallback walking speed when GPS speed is unreliable (m/s). */
const WALK_SPEED_MPS     = 1.4;
/** Seconds of GPS speed below which we use the fallback. */
const MIN_RELIABLE_SPEED = 0.5;
/** How many metres behind our current offset we still search for projections.
 *  Prevents the engine from "snapping backward" on GPS bounces. */
const LOOKBACK_M         = 80;
/** Early-advance buffer: treat a step as reached when within this many m. */
const STEP_REACH_M       = 18;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in metres between two [lng, lat] points. */
function haversineM(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Project point P onto segment AB.
 * Returns the parameterised position `t` ∈ [0,1] along AB,
 * the exact snapped point, and the perpendicular distance from P to the segment.
 *
 * We work in degrees (flat-earth approximation) because the segments are
 * short enough (< 200 m typically) that the error is well under 1 m.
 */
function projectOntoSegment(
  P:  [number, number],
  A:  [number, number],
  B:  [number, number],
): { t: number; point: [number, number]; distM: number } {
  const [ax, ay] = A;
  const [bx, by] = B;
  const [px, py] = P;

  const abx = bx - ax, aby = by - ay;
  const ab2 = abx * abx + aby * aby;

  let t = 0;
  if (ab2 > 0) {
    t = ((px - ax) * abx + (py - ay) * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
  }

  const point: [number, number] = [ax + t * abx, ay + t * aby];
  const distM = haversineM(P, point);
  return { t, point, distM };
}

/** Initial bearing from A → B in degrees [0, 360). */
function bearingDeg(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const dLng = toRad(lng2 - lng1);
  const la1 = toRad(lat1);
  const la2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class NavigationEngine {
  /** Full route polyline as [lng, lat] pairs. */
  private readonly coords: [number, number][];
  /** Length of each polyline segment (coords[i] → coords[i+1]), in metres. */
  private readonly segLen: number[];
  /** Cumulative distance from route start to the *start* of segment i (m). */
  private readonly cumDist: number[];
  /** Total route length (m). */
  readonly totalDistM: number;
  /** Steps with `routeOffset` pre-computed. */
  readonly steps: NavStep[];

  private offRouteStrikes = 0;
  /** The furthest distanceAlongRoute we've ever confirmed. Prevents backward snap. */
  private highWaterMark = 0;

  constructor(coords: [number, number][], steps: NavStep[]) {
    if (coords.length < 2) {
      throw new Error("NavigationEngine: need at least 2 coordinates.");
    }
    this.coords = coords;

    // Pre-compute segment metrics
    this.segLen  = [];
    this.cumDist = [0];
    for (let i = 0; i < coords.length - 1; i++) {
      const d = haversineM(coords[i], coords[i + 1]);
      this.segLen.push(d);
      this.cumDist.push(this.cumDist[i] + d);
    }
    this.totalDistM = this.cumDist[this.cumDist.length - 1];

    // Pre-compute each step's position along the route
    this.steps = steps.map((step) => ({
      ...step,
      routeOffset: this.computeOffsetForPoint(step.location),
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Find where on the polyline a point is, returning metres from route start. */
  private computeOffsetForPoint(pt: [number, number]): number {
    let bestDistM  = Infinity;
    let bestOffset = 0;

    for (let i = 0; i < this.coords.length - 1; i++) {
      const { t, distM } = projectOntoSegment(pt, this.coords[i], this.coords[i + 1]);
      if (distM < bestDistM) {
        bestDistM  = distM;
        bestOffset = this.cumDist[i] + t * this.segLen[i];
      }
    }
    return bestOffset;
  }

/**
   * Project the user onto the polyline using a "Local Search Window".
   * This prevents frying the JS thread by only scanning the segments
   * immediately around the user's last known location.
   */
  private projectUser(
    pt: [number, number],
    lastConfirmedOffset: number,
  ): { offset: number; distFromRouteM: number; segIdx: number } {
    
    // Look up to 150m behind (in case of GPS bounce) and 500m ahead
    const SEARCH_BACK_M = 150;
    const SEARCH_AHEAD_M = 500;
    const searchStart = Math.max(0, lastConfirmedOffset - SEARCH_BACK_M);
    const searchEnd = lastConfirmedOffset + SEARCH_AHEAD_M;

    let bestDistM  = Infinity;
    let bestOffset = lastConfirmedOffset;
    let bestSeg    = 0;

    for (let i = 0; i < this.coords.length - 1; i++) {
      // ── O(1) WINDOW OPTIMIZATION ──
      if (this.cumDist[i + 1] < searchStart) continue; // Not there yet
      if (this.cumDist[i] > searchEnd) break; // Passed the window, break the loop completely!

      const { t, distM } = projectOntoSegment(pt, this.coords[i], this.coords[i + 1]);
      if (distM < bestDistM) {
        bestDistM  = distM;
        bestOffset = this.cumDist[i] + t * this.segLen[i];
        bestSeg    = i;
      }
    }

    // ── GLOBAL FALLBACK (Teleportation check) ──
    // If we are massively off route, maybe the user drove out of a tunnel or jumped?
    // We do a one-time global scan just in case.
    if (bestDistM > 100) {
        bestDistM = Infinity;
        for (let i = 0; i < this.coords.length - 1; i++) {
            const { t, distM } = projectOntoSegment(pt, this.coords[i], this.coords[i + 1]);
            if (distM < bestDistM) {
                bestDistM = distM;
                bestOffset = this.cumDist[i] + t * this.segLen[i];
                bestSeg = i;
            }
        }
    }

    return { offset: bestOffset, distFromRouteM: bestDistM, segIdx: bestSeg };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Feed the engine a smoothed location update.
   *
   * @param lng          Smoothed longitude
   * @param lat          Smoothed latitude
   * @param speedMps     Smoothed GPS speed (m/s)
   * @param stepIndex    The step index the caller thinks is current
   * @returns            Full navigation result
   */
  update(
    lng: number,
    lat: number,
    speedMps: number,
    stepIndex: number,
  ): EngineResult {
    const pt: [number, number] = [lng, lat];

    // ── 1. Project user onto polyline ──────────────────────────────────────
    const currentStepOffset = this.steps[stepIndex]?.routeOffset ?? 0;
    const { offset, distFromRouteM, segIdx } = this.projectUser(pt, this.highWaterMark);

    // Monotonically advance the high water mark to prevent backward snap
    const confirmedOffset = Math.max(offset, this.highWaterMark);
    // Only update high water mark if we're clearly moving forward
    if (offset > this.highWaterMark + 2) {
      this.highWaterMark = offset;
    }

    // ── 2. Off-route detection ─────────────────────────────────────────────
    if (distFromRouteM > OFF_ROUTE_THRESH_M) {
      this.offRouteStrikes = Math.min(this.offRouteStrikes + 1, OFF_ROUTE_STRIKES + 2);
    } else {
      this.offRouteStrikes = Math.max(0, this.offRouteStrikes - 1);
    }
    const offRoute = this.offRouteStrikes >= OFF_ROUTE_STRIKES;

    // ── 3. Advance step index based on route offset ────────────────────────
    //    Walk forward through steps: advance as long as we've passed
    //    within STEP_REACH_M of the step's trigger offset.
    let newStepIndex = stepIndex;
    for (let i = stepIndex; i < this.steps.length - 1; i++) {
      const nextOffset = this.steps[i + 1].routeOffset ?? this.totalDistM;
      if (confirmedOffset >= nextOffset - STEP_REACH_M) {
        newStepIndex = i + 1;
      } else {
        break;
      }
    }

    // ── 4. Remaining distance & ETA ────────────────────────────────────────
    const remainingDistanceM = Math.max(0, this.totalDistM - confirmedOffset);
    const speed = speedMps >= MIN_RELIABLE_SPEED ? speedMps : WALK_SPEED_MPS;
    const remainingDurationS = remainingDistanceM / speed;
    const eta = new Date(Date.now() + remainingDurationS * 1_000);

    // ── 5. Distance to next step ───────────────────────────────────────────
    const upcomingStep       = this.steps[newStepIndex];
    const upcomingStepOffset = upcomingStep?.routeOffset ?? this.totalDistM;
    const distanceToNextStepM = Math.max(0, upcomingStepOffset - confirmedOffset);

    // ── 6. Route bearing at current position ──────────────────────────────
    const safeSegIdx = Math.min(segIdx, this.coords.length - 2);
    const routeBearing = bearingDeg(this.coords[safeSegIdx], this.coords[safeSegIdx + 1]);

    // ── 7. Arrival check ──────────────────────────────────────────────────
    const distToEnd = haversineM(pt, this.coords[this.coords.length - 1]);
    const arrived   = distToEnd <= ARRIVE_M || remainingDistanceM <= ARRIVE_M;

    return {
      status:             arrived ? "arrived" : offRoute ? "off_route" : "active",
      stepIndex:          newStepIndex,
      remainingDistanceM,
      remainingDurationS,
      eta,
      distanceToNextStepM,
      routeBearing,
      distanceFromRouteM: distFromRouteM,
    };
  }

  /** Reset the monotonic high-water mark (call when rerouting). */
  resetProgress() {
    this.highWaterMark = 0;
    this.offRouteStrikes = 0;
  }
}