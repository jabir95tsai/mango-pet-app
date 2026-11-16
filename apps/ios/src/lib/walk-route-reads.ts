import firestore from '@react-native-firebase/firestore';
import { firebase } from '@react-native-firebase/functions';
import type { Walk, WalkRoutePoint, ListWalkLiveLocationsResult } from '@mango/shared-types';
import { collectLivePages } from './walk-route-read-policy';

/** Server-only reads deliberately avoid the persistent Firestore cache. */
export async function verifyRouteMembership(uid: string, familyId: string) {
  const snap = await firestore().collection('families').doc(familyId).get({ source: 'server' });
  if (!snap.exists() || !snap.data()?.memberUids?.includes(uid)) throw new Error('Membership unavailable');
}
export async function readWalkRoute(walkId: string, uid: string, familyId: string | null) {
  if (familyId) await verifyRouteMembership(uid, familyId);
  const db = firestore();
  const snapshot = await db.collection('walks').doc(walkId).get({source:'server'});
  if (!snapshot.exists()) throw new Error('Walk unavailable');
  const walk = snapshot.data() as Walk;
  if ((walk.familyId ?? null) !== familyId || (!familyId && walk.walkerUid !== uid)) throw new Error('Scope changed');
  if (walk.routeVersion !== 1) return {walk, points: (walk.path ?? []).map(p => ({...p, segment:0})), legacy:true};
  const points: WalkRoutePoint[] = [];
  let index = 0;
  while (index < (walk.routeChunkCount ?? 0)) {
    const page = await db.collection('walkRouteSessions').doc(walkId).collection('chunks').orderBy('chunkIndex').startAt(index).limit(30).get({source:'server'});
    if (page.empty) throw new Error('Incomplete route');
    for (const doc of page.docs) {
      const chunk = doc.data();
      if (chunk.chunkIndex !== index || !Array.isArray(chunk.points)) throw new Error('Incomplete route');
      points.push(...chunk.points as WalkRoutePoint[]); index++;
    }
  }
  if (points.length !== walk.routePointCount) throw new Error('Incomplete route');
  if (familyId) await verifyRouteMembership(uid, familyId);
  return {walk, points, legacy:false};
}
export async function readFamilyLive(familyId: string, initialCursor: string | null = null) {
  return collectLivePages(async cursor => {
    const result = await firebase.app().functions('asia-east1').httpsCallable('listWalkLiveLocations')({familyId, cursor, pageSize:50});
    return result.data as ListWalkLiveLocationsResult;
  }, 10, initialCursor);
}
export async function readLiveNames(walkerUid: string, petId: string) {
  const results = await Promise.allSettled([
    firestore().collection('users').doc(walkerUid).get({source:'server'}),
    firestore().collection('pets').doc(petId).get({source:'server'}),
  ]);
  return { walker: results[0].status === 'fulfilled' ? results[0].value.data()?.displayName as string | undefined : undefined,
    pet: results[1].status === 'fulfilled' ? results[1].value.data()?.name as string | undefined : undefined };
}
