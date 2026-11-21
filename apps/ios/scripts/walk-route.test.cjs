const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
function load(file) {
 const m={exports:{}}; const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',source)(name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),m,m.exports);return m.exports;
}
const file=path.resolve(__dirname,'../../../packages/shared-business/src/walk-route.ts');
const route=fs.existsSync(file)?load(file):{};
test('complete accumulator preserves more than 500 points and start',()=>{
 assert.equal(typeof route.addRouteSample,'function');let s=route.emptyRouteAccumulator();
 for(let i=0;i<700;i++)s=route.addRouteSample(s,{lat:25+i*.00006,lng:121,t:1000+i*1000,accuracy:10},0);
 assert.equal(s.path.length,700);assert.equal(s.path[0].t,1000);
});
test('gap starts another segment without counting bridge; deadline rejects late points',()=>{
 assert.equal(typeof route.addRouteSample,'function');let s=route.emptyRouteAccumulator();
 s=route.addRouteSample(s,{lat:25,lng:121,t:1000,accuracy:10},0);
 s=route.addRouteSample(s,{lat:26,lng:121,t:100000,accuracy:10},0);
 assert.equal(s.path[1].segment,1);assert.equal(s.totalDistanceKm,0);
 assert.equal(route.addRouteSample(s,{lat:27,lng:121,t:21600001,accuracy:10},0),s);
});
test('stationary valid samples trigger return reminder once after five continuous minutes',()=>{
 assert.equal(typeof route.addRouteSample,'function');let s=route.emptyRouteAccumulator();
 const add=(lat,t)=>s=route.addRouteSample(s,{lat,lng:121,t,accuracy:10},0);
 add(25,1000);add(25.003,2000);add(25,3000);
 for(let t=13000;t<=303000;t+=10000)add(25,t);
 assert.equal(s.reminderShown,true);assert.equal(s.path.length,3);
});
test('interrupted dwell resets, invalid or unordered samples cannot complete it',()=>{
 assert.equal(typeof route.addRouteSample,'function');let s=route.emptyRouteAccumulator();
 for(const [lat,t] of [[25,1000],[25.003,2000],[25,3000],[25,400000]])s=route.addRouteSample(s,{lat,lng:121,t,accuracy:10},0);
 assert.equal(s.reminderShown,false);assert.equal(s.dwellSince,400000);
 assert.equal(route.addRouteSample(s,{lat:25,lng:121,t:900000,accuracy:90},0).dwellSince,null);
});
const outboxFile=path.resolve(__dirname,'../src/lib/walk-route-outbox-core.ts');
test('offline completion sends end before immutable backfill, retries lost append ack',async()=>{
 const api=fs.existsSync(outboxFile)?load(outboxFile):{};
 assert.equal(typeof api.drainRouteOutbox,'function');
 const record={start:{op:'start',sessionId:'a'},chunks:[[{lat:25,lng:121,t:1000,segment:0}]],endedAtMs:2000,manifest:{op:'finalize',sessionId:'a'},nextChunk:0,started:false,ended:false,finalized:false};
 let fail=true;const operations=[];
 const send=async op=>{operations.push(structuredClone(op));if(op.op==='append'&&fail){fail=false;throw Error('lost ack');}return {};};
 await assert.rejects(api.drainRouteOutbox(()=>record,send,async()=>{}));
 assert.deepEqual(operations.map(x=>x.op),['start','end','append']);
 await api.drainRouteOutbox(()=>record,send,async()=>{});
 assert.deepEqual(operations.filter(x=>x.op==='append')[0],operations.filter(x=>x.op==='append')[1]);
 assert.equal(record.finalized,true);
});
test('stop arriving during start is sent before append',async()=>{
 const api=fs.existsSync(outboxFile)?load(outboxFile):{};assert.equal(typeof api.drainRouteOutbox,'function');
 const record={start:{op:'start',sessionId:'a'},chunks:[[]],endedAtMs:null,manifest:null,nextChunk:0,started:false,ended:false,finalized:false};const ops=[];
 await api.drainRouteOutbox(()=>record,async op=>{ops.push(op.op);if(op.op==='start')record.endedAtMs=2000;return {};},async()=>{});
 assert.deepEqual(ops,['start','end','append']);
});
test('local discard during append prevents finalize without deleting committed server data',async()=>{
 const {drainRouteOutbox}=load(outboxFile);const record={start:{op:'start',sessionId:'a'},chunks:[[]],endedAtMs:2000,manifest:{op:'finalize',sessionId:'a'},nextChunk:0,started:true,ended:true,finalized:false};const ops=[];
 await drainRouteOutbox(()=>record,async op=>{ops.push(op.op);if(op.op==='append')record.discarded=true;return {};},async()=>{});
 assert.deepEqual(ops,['append']);assert.equal(record.finalized,false);
});
test('fractional iOS timestamps are accepted as whole milliseconds',()=>{
 assert.equal(typeof route.addRouteSample,'function');let s=route.emptyRouteAccumulator();
 s=route.addRouteSample(s,{lat:25,lng:121,t:1000.189,accuracy:5},0);
 s=route.addRouteSample(s,{lat:25.0001,lng:121,t:2000.7,accuracy:5},0);
 assert.deepEqual(s.path.map(p=>p.t),[1000,2000]);
 assert.ok(s.totalDistanceKm>0.01);
});
