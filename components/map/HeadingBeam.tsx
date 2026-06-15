// components/map/HeadingBeam.tsx
//
// User-position indicator: an orange dot + compass beam, rendered as plain
// React Native Views above the MapView so Android can never drop them during
// camera animations (unlike Marker/Circle/Polygon overlays on PROVIDER_GOOGLE).
//
// Two modes:
//   Explore    — map is north-up; dot positioned via pointForCoordinate() at
//                20 Hz; beam rotates to the live compass bearing.
//   Navigation — camera already faces the direction of travel; the dot is
//                pinned to screen centre (where the camera always keeps the
//                user) with no async work, and the beam is hidden because the
//                rotating map already communicates direction.

import { useHeadingStore } from "@/store/headingStore";
import { useEffect, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import Svg, { Defs, Path, RadialGradient, Stop as SvgStop } from "react-native-svg";

// ── Dot geometry ──────────────────────────────────────────────────────────────
const DOT_R = 8;
const DOT_D = DOT_R * 2;

// ── Beam geometry ─────────────────────────────────────────────────────────────
const SZ  = 130;
const CX  = SZ / 2;
const CY  = SZ / 2;
const R   = 56;
const ANG = 28;
const aR  = (ANG * Math.PI) / 180;

const lx   = +(CX + R * Math.sin(-aR)).toFixed(2);
const ly   = +(CY - R * Math.cos(-aR)).toFixed(2);
const rx   = +(CX + R * Math.sin( aR)).toFixed(2);
const ry   = +(CY - R * Math.cos( aR)).toFixed(2);
const CONE = `M ${CX} ${CY} L ${lx} ${ly} A ${R} ${R} 0 0 1 ${rx} ${ry} Z`;

const { width: SW, height: SH } = Dimensions.get("window");
// During navigation the camera is centred on the user, so screen centre is
// exactly where the dot belongs. Using a constant avoids any async work.
const NAV_POS = { x: SW / 2, y: SH / 2 };

interface Props {
  latitude:   number;
  longitude:  number;
  mapRef:     React.RefObject<MapView | null>;
  navigating: boolean;
}

export function HeadingBeam({ latitude, longitude, mapRef, navigating }: Props) {
  // When navigating the selector always returns 0 → heading changes never
  // cause a re-render, removing 12 Hz update cost during navigation.
  const angle = useHeadingStore((s) => (navigating ? 0 : s.heading));

  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    navigating ? NAV_POS : null,
  );

  useEffect(() => {
    if (navigating) {
      // Camera follows the user; dot lives at screen centre.
      // Re-sync in case the component mounts mid-navigation.
      setPos(NAV_POS);
      return; // no interval while navigating
    }

    // Explore mode: convert GPS coords → screen pixels at 20 Hz so the dot
    // tracks perfectly through any zoom, tilt, rotation, or projection change.
    let cancelled = false;

    const update = async () => {
      if (cancelled || !mapRef.current) return;
      try {
        const point = await mapRef.current.pointForCoordinate({ latitude, longitude });
        if (!cancelled) setPos(point);
      } catch {
        // Map not yet ready; next tick retries.
      }
    };

    update();
    const id = setInterval(update, 50); // 20 Hz
    return () => { cancelled = true; clearInterval(id); };
  }, [latitude, longitude, navigating, mapRef]);

  if (!pos) return null;

  return (
    <View pointerEvents="none" style={[s.canvas, { left: pos.x - CX, top: pos.y - CY }]}>
      {/* Beam — only shown in explore mode; the rotating map handles direction in nav */}
      {!navigating && (
        <Svg width={SZ} height={SZ} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="rg" cx={CX} cy={CY} r={R} gradientUnits="userSpaceOnUse">
              <SvgStop offset="0"   stopColor="#FF6F00" stopOpacity="0.65" />
              <SvgStop offset="0.5" stopColor="#FF6F00" stopOpacity="0.25" />
              <SvgStop offset="1"   stopColor="#FF6F00" stopOpacity="0"    />
            </RadialGradient>
          </Defs>
          <Path d={CONE} fill="url(#rg)" transform={`rotate(${angle}, ${CX}, ${CY})`} />
        </Svg>
      )}

      {/* Dot — orange circle with white border, renders on top of the beam */}
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
