import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { firebase } from '@react-native-firebase/functions';
import type { WalkRouteOperation, WalkRoutePoint, WalkRouteResult } from '@mango/shared-types';
import { drainRouteOutbox, type RouteOutbox } from './walk-route-outbox-core';

export async function manageWalkRoute(operation:WalkRouteOperation):Promise<WalkRouteResult> {
 return (await firebase.app().functions('asia-east1').httpsCallable('manageWalkRoute')(operation)).data as WalkRouteResult;
}
const prefix='mango.walk.route.v1.';
const records=new Map<string,RouteOutbox>();
const jobs=new Map<string,Promise<void>>();
const stopped=new Set<string>();
const endTimes=new Map<string,number>();
const lastPublished=new Map<string,number>();
let writes:Promise<unknown>=Promise.resolve();
const key=(uid:string,id:string)=>`${prefix}${uid}.${id}`;
function persist(r:RouteOutbox):Promise<void> {
 const raw=JSON.stringify(r);
 const p=writes.catch(()=>{}).then(()=>AsyncStorage.setItem(key(r.uid,r.start.sessionId),raw));writes=p;return p;
}
async function read(uid:string,id:string):Promise<RouteOutbox|null> {
 const k=key(uid,id); const memory=records.get(k);if(memory)return memory;
 const raw=await AsyncStorage.getItem(k); if(!raw)return null;
 const r=JSON.parse(raw) as RouteOutbox;
 if(r.uid!==uid || r.start.sessionId!==id)throw Error('Invalid route owner');
 if(!records.has(k))records.set(k,r);
 return records.get(k)!;
}
export function stopRoutePublishing(uid:string,id:string,endedAtMs?:number):void {
 const k=key(uid,id);stopped.add(k);
 if(endedAtMs!==undefined){endTimes.set(k,endedAtMs);const r=records.get(k);if(r && r.endedAtMs===null)r.endedAtMs=endedAtMs;}
}
export function resumeRoutePublishing(uid:string,id:string):void {
 const k=key(uid,id);if(!endTimes.has(k) && records.get(k)?.endedAtMs==null)stopped.delete(k);
}
export async function discardRouteOutbox(uid:string,id:string):Promise<void>{
 stopRoutePublishing(uid,id);
 const r=await read(uid,id);if(!r)return;
 r.discarded=true;await persist(r);
 void syncRoute(uid,id).catch(()=>{});
}
export type RouteSnapshot={uid:string;walkId:string;petId:string;familyId:string|null;startedAt:number;shareLive?:boolean;stoppedAt:number|null;path:WalkRoutePoint[]};
/** Persist only full immutable chunks while active; seal final partial on end. */
export async function queueRouteSnapshot(s:RouteSnapshot,manifest?:{distanceKm:number;durationMin:number;score:number}):Promise<void> {
 if(s.stoppedAt!==null)stopRoutePublishing(s.uid,s.walkId,s.stoppedAt);
 let r=await read(s.uid,s.walkId);
 if(!r){r={uid:s.uid,start:{op:'start',sessionId:s.walkId,petId:s.petId,familyId:s.familyId,startedAtMs:s.startedAt,shareLive:!!s.familyId&&!!s.shareLive},chunks:[],endedAtMs:null,manifest:null,nextChunk:0,started:false,ended:false,finalized:false};records.set(key(s.uid,s.walkId),r);}
 if(r.finalized || r.discarded)return;
 const count=s.stoppedAt===null?Math.floor(s.path.length/250):Math.ceil(s.path.length/250);
 for(let i=r.chunks.length;i<count;i++)r.chunks.push(s.path.slice(i*250,(i+1)*250));
 if(s.stoppedAt!==null && r.endedAtMs===null)r.endedAtMs=s.stoppedAt;
 if(manifest && !r.manifest)r.manifest={op:'finalize',sessionId:s.walkId,chunkCount:r.chunks.length,pointCount:s.path.length,...manifest};
 await persist(r);
}
export async function syncRoute(uid:string,id:string,point?:WalkRoutePoint):Promise<void> {
 const k=key(uid,id);const existing=jobs.get(k);
 if(existing){await existing;return syncRoute(uid,id,point);}
 const job=(async()=>{
  const r=await read(uid,id);if(!r)return;
  const end=endTimes.get(k);if(end!==undefined && r.endedAtMs===null)r.endedAtMs=end;
  await persist(r);
  const check=()=>{if(auth().currentUser?.uid!==uid)throw Error('Route account changed');};
  await drainRouteOutbox(()=>r,async op=>{check();return manageWalkRoute(op);},()=>persist(r));
  check();
  if(point && !r.discarded && r.start.shareLive && point.t-(lastPublished.get(k)??0)>=15_000 && !r.ended && r.endedAtMs===null && !stopped.has(k) && Date.now()-point.t<30_000 && Date.now()<r.start.startedAtMs+21600000){
   await manageWalkRoute({op:'publish',sessionId:id,point});
   lastPublished.set(k,point.t);
  }
 })();jobs.set(k,job);
 try{await job;}finally{if(jobs.get(k)===job)jobs.delete(k);}
}
export async function finishRoute(s:RouteSnapshot,manifest:{distanceKm:number;durationMin:number;score:number}):Promise<void>{
 await queueRouteSnapshot(s,manifest);await syncRoute(s.uid,s.walkId);
 const r=await read(s.uid,s.walkId);if(!r?.finalized)throw Error('Route not yet finalized');
}
export async function retryRouteOutboxes(uid:string):Promise<void>{
 const keys=(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith(`${prefix}${uid}.`));
 for(const k of keys)await syncRoute(uid,k.slice(`${prefix}${uid}.`.length)).catch(()=>{});
}
