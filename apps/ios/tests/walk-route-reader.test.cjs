const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const file = require('node:path').resolve(__dirname, '../src/lib/walk-route-read-policy.ts');
const mod = new Module(file);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { liveFreshness, collectLivePages, routeSegments } = mod.exports;
test('capture age and original deadline hide without a new packet', () => {
 const p = { locatedAtMs: 1000, expiresAtMs: 90000 };
 assert.equal(liveFreshness(p, 61001), 'stale');
 assert.equal(liveFreshness(p, 90000), 'hidden');
 assert.equal(liveFreshness({...p, expiresAtMs: 999999}, 301000), 'hidden');
});
test('empty filtered pages continue; bounded scan reports partial', async () => {
 const cursors = [];
 const result = await collectLivePages(async cursor => { cursors.push(cursor); return cursor ? {locations:[{sessionId:'b'}],nextCursor:null} : {locations:[],nextCursor:'a'}; });
 assert.deepEqual(cursors, [null,'a']); assert.equal(result.locations.length, 1);
 const partial = await collectLivePages(async c => ({locations:[], nextCursor:(c||'')+'x'}), 2);
 assert.equal(partial.partial, true);
});
test('segments across chunk boundaries never bridge gaps', () => {
 assert.deepEqual(routeSegments([{lat:1,lng:2,t:1,segment:0},{lat:2,lng:3,t:2,segment:0},{lat:4,lng:5,t:3,segment:2}]).map(s => s.length), [2,1]);
});

test('history requires server membership and paginates all chunks, rejecting gaps', async () => {
 const readFile = require('node:path').resolve(__dirname, '../src/lib/walk-route-reads.ts');
 let member = true, missing = false; const calls=[];
 const walk = {familyId:'f',walkerUid:'u',routeVersion:1,routeChunkCount:31,routePointCount:31};
 function query(path, start=0, limit=Infinity) {
  return {collection:n=>query(path+'/'+n),doc:n=>query(path+'/'+n),orderBy:()=>query(path,start,limit),startAt:n=>query(path,n,limit),limit:n=>query(path,start,n),get:async options=>{
   calls.push({path, options});
   if(path==='families/f') return {exists:()=>true,data:()=>({memberUids:member?['u']:[]})};
   if(path==='walks/w') return {exists:()=>true,data:()=>walk};
   const chunks = Array.from({length:31},(_,i)=>i).filter(i=>i>=start && (!missing || i!==5)).slice(0,limit).map(i=>({data:()=>({chunkIndex:i,points:[{lat:1,lng:2,t:i,segment:0}]})}));
   return {empty:chunks.length===0,docs:chunks};
  }};
 }
 const reads = new Module(readFile);
 reads.require = id => id==='@react-native-firebase/firestore' ? {default:()=>({collection:n=>query(n)})} : id==='@react-native-firebase/functions' ? {} : id==='./walk-route-read-policy' ? mod.exports : require(id);
 reads._compile(ts.transpileModule(fs.readFileSync(readFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,readFile);
 const result=await reads.exports.readWalkRoute('w','u','f');
 assert.equal(result.points.length,31);
 assert.equal(calls.filter(c=>c.path.endsWith('/chunks')).length,2);
 assert.ok(calls.every(c=>c.options.source==='server'));
 member=false; await assert.rejects(()=>reads.exports.readWalkRoute('w','u','f'),/Membership/);
 member=true; missing=true; await assert.rejects(()=>reads.exports.readWalkRoute('w','u','f'),/Incomplete/);
});

test('viewer discards in-flight reads after disconnect, background and identity switch', async () => {
 const hookFile = require('node:path').resolve(__dirname,'../src/lib/use-route-server-data.ts');
 const state=[]; const refs=[]; let si=0,ri=0, lastKey, cleanup, pendingEffect, network, app;
 const react={useRef:value=>{const i=ri++;return refs[i]??(refs[i]={current:value});},useState:initial=>{const i=si++; if(!(i in state))state[i]=initial; return[state[i],v=>{state[i]=v;}];},useEffect:(effect,[key])=>{if(key!==lastKey){lastKey=key;pendingEffect=effect;}}};
 const hook=new Module(hookFile);
 hook.require=id=>id==='react'?react:id==='react-native'?{AppState:{currentState:'active',addEventListener:(_,cb)=>{app=cb;return{remove(){}};}}}:{default:{addEventListener:cb=>{network=cb;return()=>{};}}};
 hook._compile(ts.transpileModule(fs.readFileSync(hookFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,hookFile);
 let resolve; const loader=()=>new Promise(r=>{resolve=r;});
 function render(key='u|f') {si=ri=0;const result=hook.exports.useRouteServerData(key,loader);if(pendingEffect){cleanup?.();cleanup=pendingEffect();pendingEffect=null;}return result;}
 const flush=()=>new Promise(r=>setImmediate(r));
 try {
  render(); network({isConnected:true,isInternetReachable:true});
  network({isConnected:false,isInternetReachable:false}); resolve({secret:1}); await flush();
  assert.equal(render().data,null);
  network({isConnected:true,isInternetReachable:true}); resolve({secret:2}); await flush();
  assert.deepEqual(render().data,{secret:2});
  assert.equal(render('other|f').data,null);
  network({isConnected:true,isInternetReachable:true}); app('background'); resolve({secret:3});await flush();
  assert.equal(render('other|f').data,null);
 } finally {cleanup?.();}
});

test('continuation reaches active position beyond ten empty filtered pages', async () => {
 const fetch = async cursor => {const page=Number(cursor ?? 0);return {locations:page===12?[{sessionId:'active'}]:[],nextCursor:page===12?null:String(page+1)};};
 const first=await collectLivePages(fetch,10);
 assert.equal(first.nextCursor,'10'); assert.equal(first.partial,true);
 const next=await collectLivePages(fetch,10,first.nextCursor);
 assert.equal(next.locations[0].sessionId,'active'); assert.equal(next.partial,false);
});

test('native map renders isolated middle segment as marker without invented lines', () => {
 const mapFile=require('node:path').resolve(__dirname,'../src/components/walks/route-map.tsx');
 const map=new Module(mapFile); const jsx=(type,props)=>({type,props});
 map.require=id=>({
  'react':{useRef:()=>({current:null})}, 'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{StyleSheet:{create:s=>s}}, 'react-native-maps':{default:'Map',Marker:'Marker',Polyline:'Polyline'},
  '@/lib/walk-route-read-policy':mod.exports,'@/theme/theme':{colors:{brandDeep:'orange'}}, '@/lib/i18n':{t:k=>k},
 })[id];
 map._compile(ts.transpileModule(fs.readFileSync(mapFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,mapFile);
 const points=[{lat:1,lng:1,t:1,segment:0},{lat:2,lng:2,t:2,segment:1},{lat:3,lng:3,t:3,segment:2}];
 const tree=map.exports.RouteMap({points});
 const children=tree.props.children.flat(Infinity).filter(Boolean);
 assert.equal(children.filter(c=>c.type==='Marker').length,3);
 assert.equal(children.filter(c=>c.type==='Polyline').length,0);
});
