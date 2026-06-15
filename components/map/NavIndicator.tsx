// components/map/NavIndicator.tsx
//
// Three-mode user-position indicator rendered as a plain React Native View
// ABOVE the MapView — immune to the Android PROVIDER_GOOGLE overlay lifecycle
// that drops Marker/Circle/Polygon during camera animations.
//
// Mode selection (controlled by the navigating + isVehicleMode props):
//   Explore        — north-up map; dot + rotating orange cone (compass bearing)
//   Walking nav    — camera faces heading; dot + cone pointing up (= forward)
//   Vehicle nav    — on a transit leg or speed > 4 m/s; dot + Waze-style chevron
//
// Position strategy:
//   Explore: pointForCoordinate at 20 Hz — tracks any pan/zoom/rotate
//   Nav     : pointForCoordinate at 20 Hz — camera is offset ahead of user so
//             dot is NOT at screen centre

import { useHeadingStore } from "@/store/headingStore";
import { useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Stop as SvgStop,
} from "react-native-svg";

// ── Canvas geometry ───────────────────────────────────────────────────────────
// 120 dp canvas — proportional and Google Maps-sized. Original 130 dp was too
// wide (36% of a 360 dp screen); 120 dp is 33% with a properly sized dot.
const SZ = 120;
const CX = SZ / 2; // 60
const CY = SZ / 2; // 60

// ── Dot ──────────────────────────────────────────────────────────────────────
// 14 dp dot + 2.5 dp white border ≈ 19 dp visual — matches Google Maps scale.
const DOT_R = 7;
const DOT_D = DOT_R * 2;

// ── Orange explore/walk cone ──────────────────────────────────────────────────
const CONE_R   = 52;
const CONE_ANG = 28; // half-angle in degrees
const aR       = (CONE_ANG * Math.PI) / 180;
const lx       = +(CX + CONE_R * Math.sin(-aR)).toFixed(2);
const ly       = +(CY - CONE_R * Math.cos(-aR)).toFixed(2);
const rx       = +(CX + CONE_R * Math.sin(aR)).toFixed(2);
const ry       = +(CY - CONE_R * Math.cos(aR)).toFixed(2);
const CONE_D   = `M ${CX} ${CY} L ${lx} ${ly} A ${CONE_R} ${CONE_R} 0 0 1 ${rx} ${ry} Z`;

// ── Chevron path (Waze-style, pointing up, apex at top, notched base) ─────────
// Scaled to 120×120 canvas (center 60, 60) from original 130×130 design.
// Each point: new = (old - 65) × (120/130) + 60
const CHEV_D = "M 60 13 L 99 100 Q 60 80 21 100 Z";

// Polling interval — 20 Hz matches camera interval so dot moves with the map
const POLL_INTERVAL = 50;

const { width: SW, height: SH } = Dimensions.get("window");
const INIT_POS = { x: SW / 2, y: SH * 0.6 };

interface Props {
  latitude:      number;
  longitude:     number;
  mapRef:        React.RefObject<MapView | null>;
  navigating:    boolean;
  isVehicleMode: boolean;
}

export function NavIndicator({ latitude, longitude, mapRef, navigating, isVehicleMode }: Props) {
  // In nav mode this selector always returns 0 → compass updates never re-render
  const angle = useHeadingStore((s) => (navigating ? 0 : s.heading));

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Stabilise mapRef so the effect dependency is reliable
  const mapRefStable = useRef(mapRef);
  mapRefStable.current = mapRef;

  useEffect(() => {
    let cancelled = false;
    let busy      = false; // prevent concurrent pointForCoordinate calls

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
  }, [latitude, longitude]);

  if (!pos) return null;

  return (
    <View pointerEvents="none" style={[s.canvas, { left: pos.x - CX, top: pos.y - CY }]}>

      {/* ── Vehicle mode: Waze-style white chevron with orange border ────────── */}
      {navigating && isVehicleMode && (
        <Svg width={SZ} height={SZ} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="chevGrad" x1="0" y1="0" x2="0" y2="1">
              <SvgStop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <SvgStop offset="1" stopColor="#E8E8E8" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Drop shadow — slightly offset down-right */}
          <Path d={CHEV_D} fill="rgba(0,0,0,0.20)" transform="translate(2, 4)" />
          {/* Main chevron */}
          <Path
            d={CHEV_D}
            fill="url(#chevGrad)"
            stroke="#FF6F00"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Orange accent pivot dot */}
          <Circle cx={CX} cy={CY + 8} r={4} fill="#FF6F00" />
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
          {/* angle=0 in nav mode (camera faces heading), rotates to compass in explore */}
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
    borderWidth:     2.5,
    borderColor:     "#FFFFFF",
    elevation:       4,
    shadowColor:     "#000",
    shadowOpacity:   0.25,
    shadowRadius:    3,
    shadowOffset:    { width: 0, height: 1 },
  },
});
