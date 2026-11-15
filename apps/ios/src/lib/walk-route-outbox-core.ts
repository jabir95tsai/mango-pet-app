import type { WalkRouteOperation, WalkRoutePoint, WalkRouteResult } from '@mango/shared-types';
export type RouteOutbox = {
 uid: string;
 start: Extract<WalkRouteOperation,{op:'start'}>;
 chunks: WalkRoutePoint[][];
 endedAtMs: number | null;
 manifest: Extract<WalkRouteOperation,{op:'finalize'}> | null;
 discarded?: boolean;
 nextChunk: number; started: boolean; ended: boolean; finalized: boolean;
};
/** Read latest state after EVERY await: stop always wins over historical work. */
export async function drainRouteOutbox(read:()=>RouteOutbox, send:(op:WalkRouteOperation)=>Promise<WalkRouteResult>, persist:()=>Promise<void>):Promise<void> {
 for (;;) {
  const r=read(); if(r.finalized)return;
  // Local discard never deletes an already-committed Walk after a lost ack.
  if(r.discarded && (!r.started || r.ended || r.endedAtMs===null))return;
  let op:WalkRouteOperation;
  if(!r.started)op=r.start;
  else if(r.endedAtMs!==null && !r.ended)op={op:'end',sessionId:r.start.sessionId,endedAtMs:r.endedAtMs};
  else if(r.nextChunk<r.chunks.length)op={op:'append',sessionId:r.start.sessionId,chunkIndex:r.nextChunk,points:r.chunks[r.nextChunk]};
  else if(r.ended && r.manifest)op=r.manifest;
  else return;
  await send(op);
  if(op.op==='start')r.started=true;
  if(op.op==='end')r.ended=true;
  if(op.op==='append')r.nextChunk=op.chunkIndex+1;
  if(op.op==='finalize')r.finalized=true;
  await persist();
 }
}
