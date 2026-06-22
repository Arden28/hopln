// components/map/NavIndicator.tsx
//
// Three-mode user-position indicator rendered as a plain React Native View
// ABOVE the MapView — immune to the Android PROVIDER_GOOGLE overlay lifecycle
// that drops Marker/Circle/Polygon during camera animations.
//
// Mode selection (controlled by the navigating + isVehicleMode props):
//   Explore        — north-up map; dot + rotating orange cone (compass bearing)
//   Walking nav    — dot + orange cone; rotates in north-up, points up in heading-up
//   Vehicle nav    — dot + clean blue chevron; same rotation logic
//
// Position strategy:
//   Nav mode   : fixedPos from camera tick (synchronous, zero async lag)
//   Explore    : pointForCoordinate at 20 Hz — tracks any pan/zoom/rotate

import { useHeadingStore } from "@/store/headingStore";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import Svg, {
  Defs,
  Path,
  RadialGradient,
  Stop as SvgStop,
} from "react-native-svg";

// ── Canvas geometry ───────────────────────────────────────────────────────────
// 64 dp canvas — compact, matches Google Maps blue dot scale.
const SZ = 64;
const CX = SZ / 2; // 32
const CY = SZ / 2; // 32

// ── Dot ──────────────────────────────────────────────────────────────────────
const DOT_R = 10;
const DOT_D = DOT_R * 2;

// ── Orange explore/walk cone ──────────────────────────────────────────────────
const CONE_R   = 28;
const CONE_ANG = 28; // half-angle in degrees
const aR       = (CONE_ANG * Math.PI) / 180;
const lx       = +(CX + CONE_R * Math.sin(-aR)).toFixed(2);
const ly       = +(CY - CONE_R * Math.cos(-aR)).toFixed(2);
const rx       = +(CX + CONE_R * Math.sin(aR)).toFixed(2);
const ry       = +(CY - CONE_R * Math.cos(aR)).toFixed(2);
const CONE_D   = `M ${CX} ${CY} L ${lx} ${ly} A ${CONE_R} ${CONE_R} 0 0 1 ${rx} ${ry} Z`;

// ── Blue vehicle chevron (64×64, apex at top, notched base) ───────────────────
// Scaled from 120×120 original: factor = 64/120, re-centered to (32,32).
const CHEV_D = "M 32 7 L 53 53 Q 32 43 11 53 Z";

// Polling interval for explore mode (20 Hz matches camera interval cadence)
const POLL_INTERVAL = 50;


interface Props {
  latitude:      number;
  longitude:     number;
  mapRef:        React.RefObject<MapView | null>;
  navigating:    boolean;
  isVehicleMode: boolean;
  /** Synchronous screen position from the camera tick (nav mode only). */
  fixedPos?:     { x: number; y: number };
  /** Whether the camera is in heading-up (true) or north-up (false) mode. */
  headingUp?:    boolean;
}

export function NavIndicator({
  latitude, longitude, mapRef,
  navigating, isVehicleMode,
  fixedPos, headingUp = false,
}: Props) {
  // In heading-up nav mode the map already rotates → no indicator rotation needed.
  // In north-up nav mode OR explore mode → rotate by compass bearing.
  const angle = useHeadingStore(
    (s) => (navigating && headingUp) ? 0 : s.heading
  );

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const mapRefStable = useRef(mapRef);
  mapRefStable.current = mapRef;

  // Polling only runs in explore mode; nav mode uses fixedPos from camera tick.
  useEffect(() => {
    if (fixedPos) return; // synchronous position provided — skip polling

    let cancelled = false;
    let busy      = false;

    const update = async () => {
      if (cancelled || busy) return;
      const map = mapRefStable.current?.current;
      if (!map) return;
      busy = true;
      try {
        const point = await map.pointForCoordinate({ latitude, longitude });
        if (!cancelled) setPos(point);
      } catch {
        // Map not yet ready; retries at next tick.
      } finally {
        busy = false;
      }
    };

    update();
    const id = setInterval(update, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(id); };
  }, [latitude, longitude, fixedPos]);

  // fixedPos takes priority; fall back to polled pos in explore mode.
  const displayPos = fixedPos ?? pos;
  if (!displayPos) return null;

  return (
    <View pointerEvents="none" style={[s.canvas, { left: displayPos.x - CX, top: displayPos.y - CY }]}>

      {/* ── Vehicle mode: flat blue chevron pointing in heading direction ──────── */}
      {navigating && isVehicleMode && (
        <Svg width={SZ} height={SZ} style={StyleSheet.absoluteFill}>
          {/* Soft shadow */}
          <Path d={CHEV_D} fill="rgba(0,0,0,0.18)" transform={`rotate(${angle}, ${CX}, ${CY}) translate(1, 3)`} />
          {/* Blue chevron — rotated to match heading */}
          <Path
            d={CHEV_D}
            fill="#007AFF"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinejoin="round"
            transform={`rotate(${angle}, ${CX}, ${CY})`}
          />
        </Svg>
      )}

      {/* ── Walk nav + explore mode: orange radial-gradient cone ─────────────── */}
      {(!navigating || !isVehicleMode) && (
        <Svg width={SZ} height={SZ} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="coneGrad" cx={CX} cy={CY} r={CONE_R} gradientUnits="userSpaceOnUse">
              <SvgStop offset="0"   stopColor="#FF6F00" stopOpacity="0.65" />
              <SvgStop offset="0.5" stopColor="#FF6F00" stopOpacity="0.25" />
              <SvgStop offset="1"   stopColor="#FF6F00" stopOpacity="0"    />
            </RadialGradient>
          </Defs>
          <Path
            d={CONE_D}
            fill="url(#coneGrad)"
            transform={`rotate(${angle}, ${CX}, ${CY})`}
          />
        </Svg>
      )}

      {/* ── Orange dot with white border — always on top ──────────────────────── */}
      <View style={s.dot} />
    </View>
  );
}

const s = StyleSheet.create({
  canvas: {
    position: "absolute",
    width:    SZ,
    height:   SZ,
  },
  dot: {
    position:        "absolute",
    left:            CX - DOT_R,
    top:             CY - DOT_R,
    width:           DOT_D,
    height:          DOT_D,
    borderRadius:    DOT_R,
    backgroundColor: "#FF6F00",
    borderWidth:     3,
    borderColor:     "#FFFFFF",
    elevation:       5,
    shadowColor:     "#000",
    shadowOpacity:   0.28,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
  },
});
