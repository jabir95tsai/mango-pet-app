import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { WalkRoutePoint } from '@mango/shared-types';
import { routeSegments } from '@/lib/walk-route-read-policy';
import { colors } from '@/theme/theme';
import { t } from '@/lib/i18n';
export type RouteMapProps = { points:WalkRoutePoint[]; live?:boolean };
export function RouteMap({points, live = false}:RouteMapProps) {
  const ref = useRef<MapView>(null);
  if (!points.length) return null;
  const coordinate = (p:WalkRoutePoint) => ({latitude:p.lat, longitude:p.lng});
  const first = points[0], last = points[points.length - 1];
  return <MapView ref={ref} style={styles.map} accessibilityLabel={t(live ? 'WalkRoutes.latest' : 'WalkRoutes.history')}
    initialRegion={{...coordinate(first), latitudeDelta:0.01, longitudeDelta:0.01}}
    onMapReady={() => ref.current?.fitToCoordinates(points.map(coordinate), {edgePadding:{top:40,bottom:40,left:40,right:40}, animated:false})}>
    {!live && routeSegments(points).filter(s => s.length > 1).map((s,i) => <Polyline key={i} coordinates={s.map(coordinate)} strokeColor={colors.brandDeep} strokeWidth={4} />)}
    {!live && routeSegments(points).filter(s => s.length === 1 && s[0] !== first && s[0] !== last).map((s,i) => <Marker key={`gap-${i}`} coordinate={coordinate(s[0])} title={t('WalkRoutes.isolatedPoint')} pinColor={colors.brandDeep} />)}
    <Marker coordinate={coordinate(first)} title={t(live ? 'WalkRoutes.latest' : 'WalkRoutes.start')} />
    {!live && points.length > 1 && <Marker coordinate={coordinate(last)} title={t('WalkRoutes.end')} pinColor={colors.brandDeep} />}
  </MapView>;
}
const styles = StyleSheet.create({map:{width:'100%',height:280}});
