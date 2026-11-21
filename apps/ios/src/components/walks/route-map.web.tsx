import { Text } from 'react-native';
import type { WalkRoutePoint } from '@mango/shared-types';
import { t } from '@/lib/i18n';
import { colors } from '@/theme/theme';
export type RouteMapProps = {points:WalkRoutePoint[];live?:boolean;style?:unknown};
export function RouteMap(_:RouteMapProps) {
  return <Text style={{color:colors.ink2}}>{t('WalkRoutes.nativeMap')}</Text>;
}
