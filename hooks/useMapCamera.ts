import type MapView from "react-native-maps";
import { useCallback, useMemo, type RefObject } from "react";
import type { CameraOptions, EdgePadding, LatLng } from "@/providers/map/types";

/** Converts a react-native-maps latitudeDelta to an approximate zoom level (0-22). */
export function zoomFromDelta(latitudeDelta: number): number {
  return Math.log2(360 / latitudeDelta);
}

/** Converts a zoom level to the latitudeDelta used by react-native-maps regions. */
export function deltaFromZoom(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}

/**
 * Wraps the react-native-maps camera API in a stable interface.
 * Swap this implementation when changing map providers — map.tsx stays unchanged.
 */
export function useMapCamera(mapRef: RefObject<MapView | null>) {
  const animateTo = useCallback(
    (opts: CameraOptions) => {
      if (!mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center:  opts.center,
          zoom:    opts.zoom,
          heading: opts.heading ?? 0,
          pitch:   opts.pitch   ?? 0,
        },
        { duration: opts.duration ?? 400 },
      );
    },
    [mapRef],
  );

  const fitCoordinates = useCallback(
    (coords: LatLng[], padding: EdgePadding = {}, animated = true) => {
      if (!mapRef.current || coords.length === 0) return;
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: {
          top:    padding.top    ?? 60,
          right:  padding.right  ?? 40,
          bottom: padding.bottom ?? 80,
          left:   padding.left   ?? 40,
        },
        animated,
      });
    },
    [mapRef],
  );

  // Memoized so callers can safely add `camera` to useEffect dependency arrays.
  return useMemo(() => ({ animateTo, fitCoordinates }), [animateTo, fitCoordinates]);
}
