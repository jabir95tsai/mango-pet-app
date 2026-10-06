const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
function load(file, modules) {
  const filename = path.join(root, 'apps/ios', file);
  const baseline = process.env.IOS_PUSH_BASELINE_REF;
  const source = baseline && file === 'src/lib/push.ts'
    ? execFileSync('git', ['show', `${baseline}:apps/ios/${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(id => {
    if (!(id in modules)) throw new Error(`Unexpected import: ${id}`);
    return modules[id];
  }, module, module.exports);
  return module.exports;
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject}; }
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const docs = new Map(), storage = new Map(), events = [];
  const state = { permission: -1, token: 'device-token', requestResult: 1, failWrite: false, failToken: false, tokenGate: null, txGate: null };
  const update = (map, ref, data) => {
    const value = structuredClone(map.get(ref.path) ?? {});
    for (const [key, item] of Object.entries(data)) {
      const keys = key.split('.'); let object = value;
      for (const part of keys.slice(0,-1)) object = object[part] ??= {};
      const last = keys.at(-1);
      if (item?.kind === 'delete') delete object[last];
      else if (item?.kind === 'union') object[last] = [...new Set([...(object[last] ?? []), ...item.values])];
      else if (item?.kind === 'remove') object[last] = (object[last] ?? []).filter(token => !item.values.includes(token));
      else object[last] = item;
    }
    map.set(ref.path, value);
  };
  const snapshot = ref => ({ exists: docs.has(ref.path), data: () => structuredClone(docs.get(ref.path)) });
  const ref = path => ({ path, collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }), get: async () => snapshot(ref(path)), set: async data => {if(state.failWrite) throw Error('permission-denied'); update(docs,ref(path),data);} });
  const commit = writes => {
    if (state.failWrite) throw Error('permission-denied');
    const next = new Map(docs); for(const [r,d] of writes) update(next,r,d);
    docs.clear(); for(const entry of next) docs.set(...entry);
    events.push('write');
  };
  const firestore = () => ({
    collection: name => ({ doc: id => ref(`${name}/${id}`) }),
    runTransaction: async fn => { if(state.txGate) await state.txGate.promise; const writes=[]; const result=await fn({get:async r=>snapshot(r),set:(r,d)=>writes.push([r,d]),update:(r,d)=>writes.push([r,d])}); commit(writes); return result; },
    batch: () => { const writes=[]; return {set:(r,d)=>writes.push([r,d]),update:(r,d)=>writes.push([r,d]),commit:async()=>commit(writes)}; },
  });
  firestore.FieldValue={serverTimestamp:()=>({seconds:100}),delete:()=>({kind:'delete'}),arrayUnion:(...values)=>({kind:'union',values}),arrayRemove:(...values)=>({kind:'remove',values})};
  const authState = {currentUser:null,onUserChanged:callback=>{state.authListener=callback; callback(authState.currentUser);return()=>{state.authListener=null;};},signOut:async()=>{events.push('signOut');authState.currentUser=null;},signInWithCredential:async credential=>{events.push(`signIn:${credential.provider}`); authState.currentUser=state.nextUser; return {user:state.nextUser};},signInAnonymously:async()=>{authState.currentUser=state.nextUser;return{user:state.nextUser};}};
  const auth=()=>authState;
  auth.GoogleAuthProvider={credential:()=>({provider:'google'})}; auth.AppleAuthProvider={credential:()=>({provider:'apple'})};
  const messaging=()=>({
    hasPermission:async()=>state.permission,requestPermission:async()=>{events.push('requestPermission');return state.permission=state.requestResult;},
    registerDeviceForRemoteMessages:async()=>events.push('register'),
    getToken:async()=>{events.push('getToken');if(state.tokenGate)await state.tokenGate.promise;if(state.failToken)throw Error('APNs unavailable');return state.token;},
    deleteToken:async()=>{if(state.failDeleteToken)throw Error('offline');events.push('deleteToken');},
    onTokenRefresh:fn=>{state.refresh=fn;return()=>{state.refresh=null;};},
  });
  messaging.AuthorizationStatus={NOT_DETERMINED:-1,DENIED:0,AUTHORIZED:1,PROVISIONAL:2};
  const asyncStorage={getItem:async key=>storage.get(key)??null,setItem:async(key,value)=>{storage.set(key,value);},removeItem:async key=>{storage.delete(key);}};
  const modules={
    '@/lib/firebase':{auth,firestore}, '@react-native-firebase/messaging':messaging,'@react-native-firebase/firestore':firestore,
    '@react-native-async-storage/async-storage':asyncStorage,
    'react-native':{Platform:{OS:'ios'},AppState:{addEventListener:(name,fn)=>{state.foreground=fn;return{remove:()=>{state.foreground=null;}};}}},
    '@/lib/i18n':{activeLocale:'en'},'@/lib/config':{},
    '@react-native-google-signin/google-signin':{GoogleSignin:{configure(){},hasPlayServices:async()=>{},signIn:async()=>{},getTokens:async()=>({idToken:'test-only'}),signOut:async()=>{}}},
    'expo-apple-authentication':{AppleAuthenticationScope:{FULL_NAME:1,EMAIL:2},signInAsync:async()=>state.appleCredential,isAvailableAsync:async()=>true},
    'expo-crypto':{randomUUID:()=> 'nonce',digestStringAsync:async()=> 'hash',CryptoDigestAlgorithm:{SHA256:'sha256'}},
  };
  const profile=load('src/lib/auth-profile.ts',modules);
  const push=load('src/lib/push.ts',modules); modules['@/lib/push']=push;
  const authApi=load('src/lib/auth.ts',modules);
  function user(uid, extra={}) { return { uid,displayName:'Person',photoURL:null,email:`${uid}@example.test`,isAnonymous:false,providerData:[{providerId:'google.com',displayName:'Person',uid}],async updateProfile(patch){Object.assign(this,patch);},...extra }; }
  return {state,docs,storage,events,authState,profile,push,authApi,user,modules,load};
}
module.exports={harness,load,deferred,tick,root};
