// Executes production TS modules; native provider/APNs boundaries are mocked.
const test = require('node:test');
const assert = require('node:assert/strict');
const {harness,deferred,tick,load} = require('./auth-push-harness.cjs');
const publicPath='users/alice', privatePath='users/alice/private/contact';
async function ready(extra={}) {const h=harness(); h.authState.currentUser=h.user('alice',extra); await h.profile.ensureUserProfile(h.authState.currentUser);return h;}

test('Google first login bootstraps public identity and private email without resetting tokens',async()=>{
 const h=harness();h.state.nextUser=h.user('alice');h.docs.set(privatePath,{fcmTokens:['other-device']});
 assert.equal(await h.authApi.signInWithGoogle(),'alice');await h.profile.ensureUserProfile(h.authState.currentUser);
 assert.equal(h.docs.get(publicPath).uid,'alice');assert.equal(h.docs.get(publicPath).displayNameLower,'person');
 assert.equal('email' in h.docs.get(publicPath),false);assert.equal('fcmTokens' in h.docs.get(publicPath),false);
 assert.deepEqual(h.docs.get(privatePath),{email:'alice@example.test',fcmTokens:['other-device']});
});
test('Apple one-time name survives profile write failure and is applied on retry',async()=>{
 const h=harness();h.state.appleCredential={identityToken:'test',user:'apple-user',fullName:{givenName:'Ada',familyName:'Lovelace'}};
 h.state.nextUser=h.user('alice',{displayName:null,providerData:[{providerId:'apple.com',uid:'apple-user'}]});
 await h.authApi.signInWithApple();h.state.failWrite=true;await assert.rejects(h.profile.ensureUserProfile(h.authState.currentUser));
 assert.equal(h.storage.get('apple-name:apple-user'),'Ada Lovelace');h.state.failWrite=false;await h.profile.ensureUserProfile(h.authState.currentUser);
 assert.equal(h.docs.get(publicPath).displayName,'Ada Lovelace');assert.equal(h.authState.currentUser.displayName,'Ada Lovelace');assert.equal(h.storage.has('apple-name:apple-user'),false);
});
test('guest login then link preserves UID, createdAt and personal profile data; adds search identity',async()=>{
 const h=harness();const guest=h.user('alice',{isAnonymous:true,email:null,displayName:null,providerData:[]});h.state.nextUser=guest;
 await h.authApi.signInAsGuest();await h.profile.ensureUserProfile(guest);const before=h.docs.get(publicPath).createdAt;
 assert.equal('displayNameLower' in h.docs.get(publicPath),false);
 h.docs.get(publicPath).currentFamilyId='preserve';guest.linkWithCredential=async()=>{Object.assign(guest,{isAnonymous:false,email:'alice@example.test',displayName:'Ada',providerData:[{providerId:'google.com',uid:'alice'}]});return{user:guest};};
 assert.deepEqual(await h.authApi.upgradeGuestWithGoogle(),{status:'linked',uid:'alice'});await h.profile.ensureUserProfile(guest);
 const profile=h.docs.get(publicPath);assert.deepEqual(profile.createdAt,before);assert.equal(profile.currentFamilyId,'preserve');assert.equal(profile.isGuest,false);assert.equal(profile.displayNameLower,'ada');
});
test('profile transaction migrates legacy private fields atomically and preserves a custom name',async()=>{
 const h=harness();h.authState.currentUser=h.user('alice');h.docs.set(publicPath,{uid:'alice',displayName:'Custom',createdAt:5,email:'legacy@test',fcmTokens:['old','other-device']});h.docs.set(privatePath,{fcmTokens:['other-device','new']});
 h.state.failWrite=true;await assert.rejects(h.profile.ensureUserProfile(h.authState.currentUser));assert.ok(h.docs.get(publicPath).fcmTokens);
 h.state.failWrite=false;await h.profile.ensureUserProfile(h.authState.currentUser);
 assert.deepEqual(new Set(h.docs.get(privatePath).fcmTokens),new Set(['old','other-device','new']));assert.equal(h.docs.get(publicPath).displayName,'Custom');assert.equal(h.docs.get(publicPath).createdAt,5);assert.equal('fcmTokens' in h.docs.get(publicPath),false);
});
test('bootstrap rejects stale identity after an awaited transaction read',async()=>{
 const h=harness();const a=h.user('alice');h.authState.currentUser=a;h.state.txGate=deferred();const pending=h.profile.ensureUserProfile(a);await tick();h.authState.currentUser=h.user('bob');h.state.txGate.resolve();await assert.rejects(pending,/session changed/);assert.equal(h.docs.size,0);
});
test('NOT_DETERMINED is actionable and enable waits for successful private registration',async()=>{
 const h=await ready();assert.equal(await h.push.probePushStatus('alice'),'notDetermined');assert.equal(h.events.includes('requestPermission'),false);
 assert.equal(await h.push.enablePush('alice'),'enabled');assert.ok(h.events.includes('requestPermission'));assert.deepEqual(h.docs.get(privatePath).fcmTokens,['device-token']);assert.equal('fcmTokens' in h.docs.get(publicPath),false);
});
test('DENIED never mints tokens and PROVISIONAL registers without another prompt',async()=>{
 const h=await ready();h.state.permission=0;assert.equal(await h.push.probePushStatus('alice'),'denied');assert.equal(h.events.includes('getToken'),false);
 h.state.permission=2;assert.equal(await h.push.probePushStatus('alice'),'enabled');assert.equal(h.events.includes('requestPermission'),false);
});
test('token or persistence failures publish error instead of enabled and retry recovers',async()=>{
 const h=await ready();h.state.permission=1;h.state.failToken=true;const statuses=[];const stop=h.push.startPushSession('alice',s=>statuses.push(s));await tick();await tick();assert.equal(statuses.at(-1),'error');assert.equal(h.docs.get(privatePath).fcmTokens,undefined);
 h.state.failToken=false;h.state.failWrite=true;await assert.rejects(h.push.probePushStatus('alice'));assert.equal(statuses.at(-1),'error');
 h.state.failWrite=false;assert.equal(await h.push.probePushStatus('alice'),'enabled');stop();
});
test('refresh replaces only this installation token and keeps other device tokens',async()=>{
 const h=await ready();h.state.permission=1;h.docs.get(privatePath).fcmTokens=['other-device'];await h.push.enablePush('alice');const statuses=[];const stop=h.push.startPushSession('alice',s=>statuses.push(s));await tick();await tick();
 h.state.token='rotated';h.state.refresh('rotated');await tick();await tick();assert.deepEqual(new Set(h.docs.get(privatePath).fcmTokens),new Set(['other-device','rotated']));assert.equal(statuses.at(-1),'enabled');stop();assert.equal(h.state.refresh,null);
});
test('logout removes this device, preserves other devices and detaches before auth signOut',async()=>{
 const h=await ready();h.state.permission=1;h.docs.get(privatePath).fcmTokens=['other-device'];await h.push.enablePush('alice');await h.authApi.signOut();assert.deepEqual(h.docs.get(privatePath).fcmTokens,['other-device']);assert.equal(h.authState.currentUser,null);assert.ok(h.events.indexOf('deleteToken')<h.events.indexOf('signOut'));
});
test('logout registration failure keeps auth alive for explicit retry',async()=>{
 const h=await ready();h.state.permission=1;await h.push.enablePush('alice');h.state.failWrite=true;await assert.rejects(h.authApi.signOut());assert.equal(h.authState.currentUser.uid,'alice');h.state.failWrite=false;await h.authApi.signOut();assert.equal(h.authState.currentUser,null);
});
test('inflight enable cannot register after logout begins',async()=>{
 const h=await ready();h.state.permission=1;h.state.tokenGate=deferred();const registration=h.push.enablePush('alice');const rejected=assert.rejects(registration,/session changed/);await tick();const logout=h.authApi.signOut();h.state.tokenGate.resolve();await rejected;await logout;assert.deepEqual(h.docs.get(privatePath).fcmTokens??[],[]);assert.equal(h.authState.currentUser,null);
});
test('account switch revokes an orphan installation token before registering the new UID',async()=>{
 const h=await ready();h.state.permission=1;await h.push.enablePush('alice');const aTokens=h.docs.get(privatePath).fcmTokens;
 h.authState.currentUser=h.user('bob');await h.profile.ensureUserProfile(h.authState.currentUser);h.state.token='bob-device';await h.push.probePushStatus('bob');
 assert.ok(h.events.includes('deleteToken'));assert.deepEqual(h.docs.get(privatePath).fcmTokens,aTokens);assert.deepEqual(h.docs.get('users/bob/private/contact').fcmTokens,['bob-device']);
});
test('global disabled preference is respected by login, foreground and refresh',async()=>{
 const h=await ready();h.state.permission=1;await h.push.enablePush('alice');await h.push.disablePush('alice');const count=h.events.filter(x=>x==='getToken').length;const stop=h.push.startPushSession('alice',()=>{});await tick();h.state.foreground('active');h.state.refresh('new-token');await tick();await tick();
 assert.equal(h.events.filter(x=>x==='getToken').length,count);assert.deepEqual(h.docs.get(privatePath).fcmTokens,[]);stop();
});
test('deleted-account logout does not recreate profile/private docs',async()=>{
 const h=await ready();h.state.permission=1;await h.push.enablePush('alice');h.docs.clear();h.state.failWrite=true;await h.authApi.signOut({accountDeleted:true});assert.equal(h.docs.size,0);assert.equal(h.authState.currentUser,null);
});
test('guest conflict detaches old token before switch and leaves guest data intact',async()=>{
 const h=await ready({isAnonymous:true});h.state.permission=1;await h.push.enablePush('alice');h.authState.currentUser.linkWithCredential=async()=>{throw{code:'auth/credential-already-in-use'};};h.state.nextUser=h.user('bob');
 assert.deepEqual(await h.authApi.upgradeGuestWithGoogle(),{status:'switched',uid:'bob'});assert.deepEqual(h.docs.get(privatePath).fcmTokens,[]);assert.equal(h.docs.get(publicPath).uid,'alice');assert.ok(h.events.indexOf('deleteToken')<h.events.indexOf('signIn:google'));
});

function providerHarness() {
 const h=harness(), slots=[], effects=[];let cursor=0,dirty=true,tree;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>{},
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(slots[i],next)){slots[i]=next;dirty=true;}}];},
 useMemo(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
 useCallback(fn,deps){return this.useMemo(()=>fn,deps);},
 useEffect(fn,deps){const i=cursor++;if(same(slots[i]?.deps,deps))return;const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});},
 };
 // Methods are called as named imports by the transpiler.
 react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);
 const requests=[];const pushes=[];
 const component=load('src/state/auth-context.tsx',{...h.modules,react,'react/jsx-runtime':{jsx:(type,props)=>({type,props})},'@/lib/auth-profile':{ensureUserProfile:user=>{const d=deferred();requests.push({user,...d});return d.promise;}},'@/lib/push':{startPushSession:(uid)=>{pushes.push(uid);return()=>{};}}}).AuthProvider;
 async function flush(){for(let i=0;i<10;i++){if(dirty){dirty=false;cursor=0;tree=component({children:null});while(effects.length)effects.shift()();}await tick();if(!dirty)return;}throw Error('Hooks did not settle');}
 return {h,requests,pushes,flush,get value(){return tree.props.value;}};
}
test('auth provider gates user/push until profile commits; failure remains retryable',async()=>{
 const p=providerHarness();p.h.authState.currentUser=p.h.user('alice');await p.flush();assert.equal(p.value.user,null);assert.equal(p.value.initializing,true);assert.equal(p.pushes.length,0);
 p.requests[0].reject(Error('permission-denied'));await p.flush();assert.equal(p.value.profileError,true);assert.equal(p.value.user,null);
 p.value.retryProfile();await p.flush();p.requests[1].resolve();await p.flush();assert.equal(p.value.user.uid,'alice');assert.deepEqual(p.pushes,['alice']);
});
test('late profile result from former account cannot replace the current user',async()=>{
 const p=providerHarness();p.h.authState.currentUser=p.h.user('alice');await p.flush();p.h.authState.currentUser=p.h.user('bob');p.h.state.authListener(p.h.authState.currentUser);await p.flush();
 p.requests[1].resolve();await p.flush();p.requests[0].resolve();await p.flush();assert.equal(p.value.user.uid,'bob');assert.deepEqual(p.pushes,['bob']);
});
test('unchanged token refresh does not reset auth readiness or unmount an active session',async()=>{
 const p=providerHarness();p.h.authState.currentUser=p.h.user('alice');await p.flush();p.requests[0].resolve();await p.flush();p.h.state.authListener(p.h.authState.currentUser);await p.flush();assert.equal(p.requests.length,1);assert.equal(p.value.initializing,false);assert.equal(p.value.user.uid,'alice');
});
test('guest bootstrap in flight cannot reflag an already upgraded UID',async()=>{
 const h=harness();const guest=h.user('alice',{isAnonymous:true});h.authState.currentUser=guest;h.state.txGate=deferred();const boot=h.profile.ensureUserProfile(guest);await tick();guest.isAnonymous=false;h.state.txGate.resolve();await assert.rejects(boot,/session changed/);assert.equal(h.docs.size,0);
});
test('background refresh rechecks global preference inside its transaction',async()=>{
 const h=await ready();h.state.permission=1;h.state.txGate=deferred();const probe=h.push.probePushStatus('alice');await tick();h.docs.get(publicPath).pushPrefs={globalDisabled:true};h.state.txGate.resolve();assert.equal(await probe,'disabled');assert.equal(h.docs.get(privatePath).fcmTokens,undefined);
});
test('deleted account can sign out when native revocation is offline, retaining retry metadata',async()=>{
 const h=await ready();h.state.permission=1;await h.push.enablePush('alice');h.docs.clear();h.state.failDeleteToken=true;await h.authApi.signOut({accountDeleted:true});assert.equal(h.authState.currentUser,null);assert.ok(h.storage.has('mango.push.registration.v1'));assert.equal(h.docs.size,0);
});
test('nameless provider gets a non-empty public fallback without publishing email identity',async()=>{
 const h=await ready({displayName:null,providerData:[{providerId:'apple.com',uid:'apple-no-name'}]});assert.equal(h.docs.get(publicPath).displayName,'Friend');assert.equal(h.docs.get(publicPath).displayNameLower,'friend');assert.equal('email' in h.docs.get(publicPath),false);
});
test('legacy email migration retains existing private contact when auth has no email',async()=>{
 const h=harness();h.authState.currentUser=h.user('alice',{email:null});h.docs.set(publicPath,{uid:'alice',email:'stale@example.test'});h.docs.set(privatePath,{email:'current@example.test',fcmTokens:['other-device']});await h.profile.ensureUserProfile(h.authState.currentUser);assert.equal(h.docs.get(privatePath).email,'current@example.test');assert.equal('email' in h.docs.get(publicPath),false);
});
test('malformed legacy token field does not prevent registration of a valid device',async()=>{
 const h=await ready();h.state.permission=1;h.docs.get(privatePath).fcmTokens='not-an-array';assert.equal(await h.push.enablePush('alice'),'enabled');assert.deepEqual(h.docs.get(privatePath).fcmTokens,['device-token']);
});
