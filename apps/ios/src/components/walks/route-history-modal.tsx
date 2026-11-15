import { Text, StyleSheet } from 'react-native';
import type { Walk } from '@mango/shared-types';
import { Dialog } from '@/components/ui/Dialog';
import { RouteMap } from './route-map';
import { useFamilyScope } from '@/lib/use-family-scope';
import { useRouteServerData } from '@/lib/use-route-server-data';
import { readWalkRoute } from '@/lib/walk-route-reads';
import { routeSegments } from '@/lib/walk-route-read-policy';
import { t } from '@/lib/i18n';
import { colors } from '@/theme/theme';
export function RouteHistoryModal({walk,onClose}:{walk:Walk;onClose:()=>void}) {
  const scope = useFamilyScope();
  const allowed = scope.scopeReady && scope.uid && (walk.familyId ?? null) === scope.familyId;
  const key = allowed ? `${scope.scopeKey}|${walk.walkId}` : null;
  const {data, error} = useRouteServerData(key, () => readWalkRoute(walk.walkId, scope.uid!, scope.familyId));
  return <Dialog open onClose={onClose} title={t('WalkRoutes.history')}>
    {!data ? <Text style={styles.text}>{t(error || !allowed ? 'WalkRoutes.unavailable' : 'WalkRoutes.verifying')}</Text> : <>
      <Text style={styles.text}>{`${data.walk.distanceKm.toFixed(2)} km · ${data.walk.durationMin.toFixed(0)} min`}</Text>
      {data.legacy && data.points.length > 0 && <Text style={styles.text}>{t('WalkRoutes.legacy')}</Text>}
      {routeSegments(data.points).length > 1 && <Text style={styles.text}>{t('WalkRoutes.gaps')}</Text>}
      {data.points.length ? <RouteMap key={walk.walkId} points={data.points} /> : <Text style={styles.text}>{t('WalkRoutes.noRoute')}</Text>}
    </>}
  </Dialog>;
}
const styles = StyleSheet.create({text:{color:colors.ink2,fontSize:15,lineHeight:22}});
