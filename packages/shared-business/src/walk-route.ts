import type { WalkRoutePoint } from "@mango/shared-types";
import { haversineKm } from "./gps";
export const WALK_ROUTE_LIMIT_MS = 6 * 60 * 60 * 1000;
/** A minute without a valid fix is an unobserved interval, never a bridge. */
export const WALK_ROUTE_GAP_MS = 60_000;
export type RouteAccumulator = {
  path: WalkRoutePoint[]; totalDistanceKm: number; segment: number;
  latestPoint?: WalkRoutePoint;
  lastValidAt: number | null; gapPending: boolean;
  leftStart: boolean; dwellSince: number | null; reminderShown: boolean;
};
export function emptyRouteAccumulator(): RouteAccumulator {
  return { path: [], totalDistanceKm: 0, segment: 0, lastValidAt: null, gapPending: false,
    leftStart: false, dwellSince: null, reminderShown: false };
}
export function interruptRoute(acc: RouteAccumulator): RouteAccumulator {
  return { ...acc, gapPending: true, dwellSince: null, lastValidAt: null };
}
export function addRouteSample(acc: RouteAccumulator, sample: {lat:number;lng:number;t:number;accuracy:number}, startedAt: number): RouteAccumulator {
  if (!Number.isSafeInteger(sample.t) || sample.t < startedAt || sample.t > startedAt + WALK_ROUTE_LIMIT_MS ||
      (acc.lastValidAt !== null && sample.t <= acc.lastValidAt)) return acc;
  if (![sample.lat,sample.lng,sample.accuracy].every(Number.isFinite) || Math.abs(sample.lat)>90 || Math.abs(sample.lng)>180 || sample.accuracy<0 || sample.accuracy>50) {
    return interruptRoute(acc);
  }
  const gap = acc.gapPending || (acc.lastValidAt !== null && sample.t-acc.lastValidAt>WALK_ROUTE_GAP_MS);
  const last=acc.path.at(-1);
  if (last && sample.t<=last.t) return acc;
  const segment=acc.segment+(gap && last ? 1 : 0);
  const point={lat:sample.lat,lng:sample.lng,t:sample.t,segment};
  const start=acc.path[0] ?? point;
  const fromStart=haversineKm(start,point)*1000;
  const leftStart=acc.leftStart || fromStart>200;
  const dwellSince=leftStart && fromStart<=100 ? (gap ? sample.t : acc.dwellSince ?? sample.t) : null;
  const reminderShown=acc.reminderShown || (dwellSince!==null && sample.t-dwellSince>=300000);
  const distance=last && !gap ? haversineKm(last,point) : 0;
  const accept=!last || gap || distance>=.005;
  return {...acc,latestPoint:point,segment,lastValidAt:sample.t,gapPending:false,leftStart,dwellSince,reminderShown,
    path:accept?[...acc.path,point]:acc.path,
    totalDistanceKm:accept ? acc.totalDistanceKm+distance : acc.totalDistanceKm};
}
