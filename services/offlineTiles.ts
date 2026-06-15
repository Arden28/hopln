// services/offlineTiles.ts
//
// Downloads raster map tiles for a bounding box to disk in TWO styles
// (Mapbox Streets light + Mapbox Dark) so the offline map matches the app's
// dynamic light/dark theme without needing a second download.
//
// Directory layout:
//   {documentDirectory}/offline_tiles/
//       light/{z}/{x}/{y}.png   ← mapbox/streets-v12
//       dark/{z}/{x}/{y}.png    ← mapbox/dark-v11
//
// map.tsx renders the tile directory that matches the current color scheme.
//
// NOTE: tiles are fetched from Mapbox raster endpoints using the app's public
// token. Caching for offline use is subject to Mapbox's Terms of Service.
import * as FileSystem from "expo-file-system/legacy";

export interface BBox {
  north: number;
  south: number;
  east:  number;
  west:  number;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const STYLE_LIGHT  = "mapbox/streets-v12";
const STYLE_DARK   = "mapbox/dark-v11";

const BASE_DIR          = `${FileSystem.documentDirectory}offline_tiles`;
export const TILE_DIR_LIGHT = `${BASE_DIR}/light`;
export const TILE_DIR_DARK  = `${BASE_DIR}/dark`;

// Scheme-less paths for react-native-maps <UrlTile urlTemplate="file://...">.
export const TILE_PATH_TEMPLATE_LIGHT = `${TILE_DIR_LIGHT.replace(/^file:\/\//, "")}/{z}/{x}/{y}.png`;
export const TILE_PATH_TEMPLATE_DARK  = `${TILE_DIR_DARK.replace(/^file:\/\//, "")}/{z}/{x}/{y}.png`;

export const DL_MIN_ZOOM    = 12;
export const DL_MAX_ZOOM    = 16;
const MAX_ZOOM_ALLOWED      = 16;
const MAX_TILES             = 25_000;  // per style
const AVG_TILE_BYTES        = 25_000;  // ~25 KB/tile for streets raster
const CONCURRENCY           = 6;

// ── Slippy-map tile math ──────────────────────────────────────────────────────
function lon2tileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}
function lat2tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z),
  );
}
function tileRange(bbox: BBox, z: number) {
  const xA = lon2tileX(bbox.west, z);
  const xB = lon2tileX(bbox.east, z);
  const yA = lat2tileY(bbox.north, z);
  const yB = lat2tileY(bbox.south, z);
  return { xMin: Math.min(xA, xB), xMax: Math.max(xA, xB), yMin: Math.min(yA, yB), yMax: Math.max(yA, yB) };
}

export function countTiles(bbox: BBox, minZoom: number, maxZoom: number): number {
  let n = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bbox, z);
    n += (r.xMax - r.xMin + 1) * (r.yMax - r.yMin + 1);
  }
  return n;
}

export function estimatePack(
  bbox: BBox,
  minZoom = DL_MIN_ZOOM,
  maxZoom = DL_MAX_ZOOM,
): { tileCount: number; approxBytes: number; tooLarge: boolean } {
  const tileCount = countTiles(bbox, minZoom, Math.min(maxZoom, MAX_ZOOM_ALLOWED));
  return {
    tileCount,
    approxBytes: tileCount * AVG_TILE_BYTES * 2, // light + dark combined
    tooLarge:    tileCount > MAX_TILES,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DownloadResult {
  tileCount: number; // per style
  bytes:     number; // combined (both styles)
  cancelled: boolean;
}

// ── Internal: download one style into its tile directory ──────────────────────
async function downloadStyle(
  bbox:        BBox,
  minZoom:     number,
  maxZoom:     number,
  style:       string,
  tileDir:     string,
  baseOffset:  number,    // done-count offset for combined progress
  totalTiles:  number,    // combined total for the progress callback
  onProgress:  (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<{ bytes: number; cancelled: boolean }> {
  const jobs: { z: number; x: number; y: number }[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bbox, z);
    for (let x = r.xMin; x <= r.xMax; x++) {
      for (let y = r.yMin; y <= r.yMax; y++) jobs.push({ z, x, y });
    }
  }

  let done = 0, bytes = 0, idx = 0;
  const createdDirs = new Set<string>();

  const worker = async () => {
    while (idx < jobs.length) {
      if (isCancelled()) return;
      const job  = jobs[idx++];
      const dir  = `${tileDir}/${job.z}/${job.x}`;
      const file = `${dir}/${job.y}.png`;
      try {
        const info = await FileSystem.getInfoAsync(file);
        if (info.exists) {
          if (info.size) bytes += info.size;
        } else {
          if (!createdDirs.has(dir)) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
            createdDirs.add(dir);
          }
          const url = `https://api.mapbox.com/styles/v1/${style}/tiles/256/${job.z}/${job.x}/${job.y}?access_token=${MAPBOX_TOKEN}`;
          await FileSystem.downloadAsync(url, file);
          const fi = await FileSystem.getInfoAsync(file);
          if (fi.exists && fi.size) bytes += fi.size;
        }
      } catch {
        // A single failed tile renders blank offline; keep going.
      }
      done++;
      onProgress(baseOffset + done, totalTiles);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { bytes, cancelled: isCancelled() };
}

/**
 * Downloads light + dark tile sets for `bbox`. Reports combined progress
 * (0 → perStyleCount for light, perStyleCount → 2×perStyleCount for dark).
 * Existing tiles are skipped, so re-running resumes / updates a partial pack.
 */
export async function downloadPack(
  bbox:        BBox,
  minZoom:     number,
  maxZoom:     number,
  onProgress:  (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<DownloadResult> {
  const clampedMax      = Math.min(maxZoom, MAX_ZOOM_ALLOWED);
  const perStyleCount   = countTiles(bbox, minZoom, clampedMax);
  const total           = perStyleCount * 2;

  if (perStyleCount > MAX_TILES) {
    throw new Error(
      `Region too large (${perStyleCount.toLocaleString()} tiles per style). Zoom in to select a smaller area.`,
    );
  }

  await FileSystem.makeDirectoryAsync(TILE_DIR_LIGHT, { intermediates: true }).catch(() => {});
  const light = await downloadStyle(
    bbox, minZoom, clampedMax, STYLE_LIGHT, TILE_DIR_LIGHT, 0, total, onProgress, isCancelled,
  );
  if (light.cancelled) return { tileCount: perStyleCount, bytes: light.bytes, cancelled: true };

  await FileSystem.makeDirectoryAsync(TILE_DIR_DARK, { intermediates: true }).catch(() => {});
  const dark = await downloadStyle(
    bbox, minZoom, clampedMax, STYLE_DARK, TILE_DIR_DARK, perStyleCount, total, onProgress, isCancelled,
  );

  return {
    tileCount: perStyleCount,
    bytes:     light.bytes + dark.bytes,
    cancelled: dark.cancelled,
  };
}

export async function deletePack(): Promise<void> {
  await FileSystem.deleteAsync(BASE_DIR, { idempotent: true }).catch(() => {});
}
