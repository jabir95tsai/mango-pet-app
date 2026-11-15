import type { ListWalkLiveLocationsResult, WalkRoutePoint } from '@mango/shared-types';
export type LivePosition = ListWalkLiveLocationsResult['locations'][number];
export function liveFreshness(p: Pick<LivePosition, 'locatedAtMs' | 'expiresAtMs'>, now: number): 'fresh' | 'stale' | 'hidden' {
  if (!Number.isFinite(p.locatedAtMs) || !Number.isFinite(p.expiresAtMs) || now >= Math.min(p.expiresAtMs, p.locatedAtMs + 300000)) return 'hidden';
  return now - p.locatedAtMs > 60000 ? 'stale' : 'fresh';
}
export async function collectLivePages(fetch: (cursor: string | null) => Promise<ListWalkLiveLocationsResult>, budget = 10, initialCursor: string | null = null) {
  const locations: LivePosition[] = [];
  let cursor: string | null = initialCursor;
  const seen = new Set<string>();
  for (let page = 0; page < budget; page++) {
    const result = await fetch(cursor);
    locations.push(...result.locations);
    cursor = result.nextCursor;
    if (!cursor) return { locations, partial: false, nextCursor: null };
    if (seen.has(cursor)) throw new Error('Repeated location cursor');
    seen.add(cursor);
  }
  return { locations, partial: true, nextCursor: cursor };
}
export function routeSegments(points: WalkRoutePoint[]): WalkRoutePoint[][] {
  const segments: WalkRoutePoint[][] = [];
  for (const point of points) {
    const last = segments[segments.length - 1];
    if (!last || last[0].segment !== point.segment) segments.push([point]);
    else last.push(point);
  }
  return segments;
}
