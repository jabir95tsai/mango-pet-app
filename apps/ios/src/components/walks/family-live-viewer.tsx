import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Dialog } from '@/components/ui/Dialog';
import { RouteMap } from './route-map';
import { useFamilyScope } from '@/lib/use-family-scope';
import { useRouteServerData } from '@/lib/use-route-server-data';
import { readFamilyLive, readLiveNames } from '@/lib/walk-route-reads';
import { liveFreshness } from '@/lib/walk-route-read-policy';
import { t, getActiveLocale } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme/theme';
export function FamilyLiveViewer() {
  const [open,setOpen] = useState(false);
  const [cursor,setCursor] = useState<string | null>(null);
  const [now,setNow] = useState(Date.now());
  const scope = useFamilyScope();
  useEffect(() => setCursor(null), [scope.scopeKey]);
  const key = open && scope.scopeReady && scope.familyId ? `${scope.scopeKey}|${cursor ?? "first"}` : null;
  const {data,error} = useRouteServerData(key, async () => {
    const result = await readFamilyLive(scope.familyId!, cursor);
    const names = await Promise.all(result.locations.map(p => readLiveNames(p.walkerUid,p.petId)));
    return {...result, locations:result.locations.map((p,i) => ({...p, ...names[i]}))};
  });
  useEffect(() => {
    if (!open) return;
    const current = Date.now();
    const boundaries = data?.locations.flatMap(p => [p.locatedAtMs + 60001, Math.min(p.expiresAtMs, p.locatedAtMs + 300000)]).filter(time => time > current) ?? [];
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(1000, ...boundaries.map(time => time - current))));
    return () => clearTimeout(timer);
  },[open, data, now]);
  const visible = data?.locations.filter(p => liveFreshness(p,Math.max(now, Date.now())) !== 'hidden') ?? [];
  if (!scope.familyId) return null;
  return <>
    <Pressable accessibilityRole="button" onPress={() => {setCursor(null);setNow(Date.now());setOpen(true);}} style={styles.button}>
      <Text style={styles.label}>{t('WalkRoutes.familyLive')}</Text>
    </Pressable>
    {open && <Dialog open onClose={() => setOpen(false)} title={t('WalkRoutes.familyLive')}>
      <Text style={styles.text}>{t('WalkRoutes.phoneLocation')}</Text>
      {!data && <Text style={styles.text}>{t(error || !key ? 'WalkRoutes.unavailable' : 'WalkRoutes.verifying')}</Text>}
      {data && visible.length === 0 && <Text style={styles.text}>{t('WalkRoutes.noneSharing')}</Text>}
      {data?.partial && <>
        <Text style={styles.text}>{t('WalkRoutes.partial')}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setCursor(data.nextCursor)}><Text style={styles.label}>{t('WalkRoutes.nextPositions')}</Text></Pressable>
      </>}
      {cursor && <Pressable accessibilityRole="button" style={styles.button} onPress={() => setCursor(null)}><Text style={styles.label}>{t('WalkRoutes.firstPositions')}</Text></Pressable>}
      {visible.map(p => <View key={p.sessionId} style={styles.card}>
        <Text style={styles.label}>{`${p.walker || t('WalkRoutes.member')} · ${p.pet || t('WalkRoutes.pet')}`}</Text>
        <Text style={styles.text}>{t('WalkRoutes.locatedAt', {time:new Date(p.locatedAtMs).toLocaleString(getActiveLocale())})}</Text>
        {liveFreshness(p,now) === 'stale' && <Text style={styles.text}>{t('WalkRoutes.stale')}</Text>}
        <RouteMap key={`${p.sessionId}:${p.locatedAtMs}`} live points={[{lat:p.lat,lng:p.lng,t:p.locatedAtMs,segment:0}]} />
      </View>)}
    </Dialog>}
  </>;
}
const styles = StyleSheet.create({
  button:{padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.brandTint},
  label:{fontSize:15,fontWeight:'600',color:colors.brandDeep},
  text:{fontSize:14,color:colors.ink2,lineHeight:21},
  card:{gap:spacing.sm,paddingVertical:spacing.md},
});
