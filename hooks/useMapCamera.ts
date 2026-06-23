import Mapbox from "@rnmapbox/maps";
import { useCallback, useMemo, type RefObject } from "react";
import type { CameraOptions, EdgePadding, LatLng } from "@/providers/map/types";

/**
 * Wraps the @rnmapbox/maps camera API in a stable interface.
 * Accepts a mapRef (MapView) for non-camera operations and a cameraRef (Camera)
 * for all camera animations. Callers in map.tsx are unchanged.
 */
export function useMapCamera(
  mapRef: RefObject<Mapbox.MapView | null>,
  cameraRef: RefObject<Mapbox.Camera | null>,
) {
  const animateTo = useCallback(
    (opts: CameraOptions) => {
      if (!cameraRef.current) return;
      cameraRef.current.setCamera({
        centerCoordinate: opts.center
          ? [opts.center.longitude, opts.center.latitude]
          : undefined,
        zoomLevel:          opts.zoom,
        ...(opts.heading !== undefined ? { heading: opts.heading } : {}),
        pitch:              opts.pitch ?? 0,
        animationDuration:  opts.duration ?? 400,
        // Short-duration calls (nav loop at 80 ms) use linearTo so updates queue
        // cleanly without snap-back. Longer transitions use easeTo for smoothness.
        animationMode: (opts.duration ?? 400) <= 100 ? "linearTo" : "easeTo",
      });
    },
    [cameraRef],
  );

  const fitCoordinates = useCallback(
    (coords: LatLng[], padding: EdgePadding = {}, duration = 500) => {
      if (!cameraRef.current || coords.length === 0) return;
      const lngs = coords.map((c) => c.longitude);
      const lats  = coords.map((c) => c.latitude);
      cameraRef.current.fitBounds(
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
        [padding.top ?? 60, padding.right ?? 40, padding.bottom ?? 80, padding.left ?? 40],
        duration,
      );
    },
    [cameraRef],
  );

  return useMemo(() => ({ animateTo, fitCoordinates }), [animateTo, fitCoordinates]);
}
