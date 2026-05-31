/**
 * GPS path math — PURE, cross-platform (web watchPosition + ios
 * expo-location). Sampling rules per docs/features/ios-p1-walks.md §GPS
 * path 取樣規則 (mirrors apps/web walk-tracking.ts so distance/path match):
 *   - reject samples with accuracy ≥ 50m
 *   - reject samples < 5m from the last accepted point
 *   - Haversine distance (earth radius 6371 km)
 *   - path capped at 500 points (rolling)
 */
import type { WalkPathPoint } from "@mango/shared-types";

/** Haversine great-circle distance in km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const MIN_ACCEPTABLE_ACCURACY_M = 50;
export const MIN_DISTANCE_M_BETWEEN_SAMPLES = 5;
export const MAX_PATH_POINTS = 500;

/** Rolling path + accumulated distance. Both web WalkSession and the iOS
 *  tracking service hold one of these and feed samples through `addGpsSample`. */
export type PathAccumulator = {
  path: WalkPathPoint[];
  totalDistanceKm: number;
};

export function emptyPathAccumulator(): PathAccumulator {
  return { path: [], totalDistanceKm: 0 };
}

/**
 * Pure sample processor. Given the current accumulator and a new raw fix,
 * returns the next accumulator. Rejected samples (poor accuracy, or too
 * close to the last point) return the accumulator unchanged. The first
 * accepted point seeds the path with no distance added. Distance is rounded
 * to 3 decimals (metre precision) to match the web implementation exactly.
 */
export function addGpsSample(
  acc: PathAccumulator,
  sample: { lat: number; lng: number; t: number; accuracy: number },
): PathAccumulator {
  if (!Number.isFinite(sample.accuracy) || sample.accuracy > MIN_ACCEPTABLE_ACCURACY_M) {
    return acc;
  }
  const point: WalkPathPoint = { lat: sample.lat, lng: sample.lng, t: sample.t };
  const last = acc.path[acc.path.length - 1];
  if (!last) {
    return { path: [point], totalDistanceKm: acc.totalDistanceKm };
  }
  const distM = haversineKm(last, point) * 1000;
  if (distM < MIN_DISTANCE_M_BETWEEN_SAMPLES) return acc;
  const nextDistance = acc.totalDistanceKm + distM / 1000;
  const nextPath =
    acc.path.length >= MAX_PATH_POINTS
      ? [...acc.path.slice(-MAX_PATH_POINTS + 1), point]
      : [...acc.path, point];
  return {
    path: nextPath,
    totalDistanceKm: Math.round(nextDistance * 1000) / 1000,
  };
}
