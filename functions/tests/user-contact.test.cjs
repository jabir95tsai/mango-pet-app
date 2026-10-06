const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {db}=require('./emulator.cjs');
const {contactTokens,readContactTokens,removeContactTokens,migrateUserContact}=require('../lib/user-contact.js');
const {initializeApp,deleteApp}=require('firebase/app');
const f=require('firebase/firestore');
const ts=require('typescript');
const prefix='contact-'+randomUUID();
const clients=[],apps=[];
f.setLogLevel('silent');
const profile=(uid,extra={})=>db.doc('users/'+uid).set({uid,displayName:'Contact test',...extra});
const contact=uid=>db.doc(`users/${uid}/private/contact`);
function client(uid){
  const app=initializeApp({projectId:'demo-mango-security',apiKey:'demo-key'},uid+'-'+apps.length);
  const sdk=f.getFirestore(app);f.connectFirestoreEmulator(sdk,'127.0.0.1',Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),{
    mockUserToken:{sub:uid,user_id:uid,firebase:{sign_in_provider:'password'}},
  });apps.push(app);clients.push(sdk);return sdk;
}
function upsert(sdk){
  const filename=path.resolve(__dirname,'../../apps/web/src/lib/firebase/users.ts');
  const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  const mocks={'firebase/firestore':f,'firebase/functions':{},'./config':{getDb:()=>sdk},'./auth':{
    resolveUserDisplayName:user=>user.displayName,resolveUserPhotoURL:user=>user.photoURL??null,
  }};
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename})(name=>{
    if(name in mocks)return mocks[name];throw new Error('Unexpected import '+name);
  },module,module.exports);return module.exports.upsertUser;
}
const user=uid=>({uid,isAnonymous:false,displayName:'Contact User',photoURL:null,email:'private@example.test',providerData:[{providerId:'google.com'}]});
after(async()=>{for(const sdk of clients)await f.terminate(sdk);for(const app of apps)await deleteApp(app);await db.terminate();});

test('push reads both devices during migration, deduplicates and ignores malformed tokens',async()=>{
  const uid=prefix+'-read';await profile(uid,{fcmTokens:['ios','duplicate',null,0,'']});
  await contact(uid).set({fcmTokens:['web','duplicate',{},'  ']});
  assert.deepEqual(await readContactTokens(db,uid),['web','duplicate','ios']);
  assert.deepEqual(contactTokens('bad',{token:'bad'},['valid','valid',false]),['valid']);
});

test('copy then atomic strip preserves private email, every device and unrelated fields',async()=>{
  const uid=prefix+'-migrate';await profile(uid,{email:'legacy@example.test',fcmTokens:['ios','shared'],familyIds:['kept']});
  await contact(uid).set({email:'new@example.test',fcmTokens:['web','shared'],other:'kept'});
  await migrateUserContact(db,uid,false);
  assert.deepEqual((await contact(uid).get()).data(),{email:'new@example.test',fcmTokens:['web','shared','ios'],other:'kept'});
  assert.ok('email' in (await db.doc('users/'+uid).get()).data());
  await migrateUserContact(db,uid,true);
  assert.deepEqual((await db.doc('users/'+uid).get()).data(),{uid,displayName:'Contact test',familyIds:['kept']});
  const before=(await contact(uid).get()).updateTime;
  assert.equal((await migrateUserContact(db,uid,true)).changed,false);
  assert.ok((await contact(uid).get()).updateTime.isEqual(before));
});

test('concurrent registration and strip never drop newly registered private tokens',async()=>{
  const uid=prefix+'-race';await profile(uid,{fcmTokens:['ios']});await contact(uid).set({fcmTokens:['web']});
  await Promise.all([migrateUserContact(db,uid,true),...['a','b','c'].map(token=>contact(uid).update({fcmTokens:require('firebase-admin/firestore').FieldValue.arrayUnion(token)}))]);
  assert.deepEqual(new Set((await contact(uid).get()).data().fcmTokens),new Set(['ios','web','a','b','c']));
  assert.equal('fcmTokens' in (await db.doc('users/'+uid).get()).data(),false);
});

test('invalid cleanup drains legacy tokens without recreating public PII',async()=>{
  const uid=prefix+'-cleanup';await profile(uid,{fcmTokens:['bad','ios']});await contact(uid).set({email:null,fcmTokens:['web','bad']});
  await removeContactTokens(db,uid,['bad']);
  assert.deepEqual((await contact(uid).get()).data(),{email:null,fcmTokens:['web','ios']});
  assert.equal('fcmTokens' in (await db.doc('users/'+uid).get()).data(),false);
  await removeContactTokens(db,uid,['ios']);
  assert.equal('fcmTokens' in (await db.doc('users/'+uid).get()).data(),false);
});

test('late cleanup/migration cannot create private or profile data for deleted accounts',async()=>{
  const missing=prefix+'-missing',deleting=prefix+'-deleting';
  await removeContactTokens(db,missing,['bad']);await migrateUserContact(db,missing,true);
  assert.equal((await contact(missing).get()).exists,false);
  await profile(deleting,{fcmTokens:['legacy']});await db.doc('deletedAccounts/'+deleting).set({state:'deleting'});
  await removeContactTokens(db,deleting,['bad']);await migrateUserContact(db,deleting,true);
  assert.equal((await contact(deleting).get()).exists,false);
});

test('rules reject public PII on create, update, merge and arrayUnion; public lookup stays available',async()=>{
  const uid=prefix+'-rules',other=prefix+'-other';const sdk=client(uid),outsider=client(other);
  const ref=f.doc(sdk,'users/'+uid);
  for(const data of [{email:null},{email:'hidden@example.test'},{fcmTokens:[]},{fcmTokens:['token']}]){
    await assert.rejects(f.setDoc(ref,{uid,displayName:'Public',...data}),{code:'permission-denied'});
  }
  await f.setDoc(ref,{uid,displayName:'Public',displayNameLower:prefix});
  for(const patch of [{email:null},{fcmTokens:[]},{fcmTokens:f.arrayUnion('leak')}]){
    await assert.rejects(f.updateDoc(ref,patch),{code:'permission-denied'});
    await assert.rejects(f.setDoc(ref,patch,{merge:true}),{code:'permission-denied'});
  }
  const priv=f.doc(sdk,`users/${uid}/private/contact`);
  await f.setDoc(priv,{email:'owner@example.test',fcmTokens:['device']});
  assert.equal((await f.getDocFromServer(priv)).data().fcmTokens[0],'device');
  await assert.rejects(f.getDocFromServer(f.doc(outsider,priv.path)),{code:'permission-denied'});
  await assert.rejects(f.setDoc(f.doc(outsider,priv.path),{fcmTokens:['other']}),{code:'permission-denied'});
  assert.equal((await f.getDocFromServer(f.doc(outsider,ref.path))).data().email,undefined);
  assert.equal((await f.getDocs(f.query(f.collection(outsider,'users'),f.where('displayNameLower','==',prefix)))).size,1);
});

test('Web first login preserves a pre-existing private registration and is idempotent',async()=>{
  const uid=prefix+'-web-new';await contact(uid).set({fcmTokens:['early-device'],custom:'kept'});
  const save=upsert(client(uid));await Promise.all([save(user(uid),'en'),save(user(uid),'en')]);
  assert.deepEqual((await contact(uid).get()).data(),{fcmTokens:['early-device'],custom:'kept',email:'private@example.test'});
  const before=(await db.doc('users/'+uid).get()).data().createdAt;
  await save(user(uid),'en');assert.ok((await db.doc('users/'+uid).get()).data().createdAt.isEqual(before));
});

test('Web legacy bootstrap moves iOS token into a nonempty private set under real rules',async()=>{
  const uid=prefix+'-web-legacy';await profile(uid,{email:'old@example.test',fcmTokens:['ios'],familyIds:['kept']});
  await contact(uid).set({fcmTokens:['web']});
  await upsert(client(uid))(user(uid),'en');
  assert.deepEqual(new Set((await contact(uid).get()).data().fcmTokens),new Set(['web','ios']));
  const pub=(await db.doc('users/'+uid).get()).data();
  assert.equal('email' in pub,false);assert.equal('fcmTokens' in pub,false);assert.deepEqual(pub.familyIds,['kept']);
});

test('Web guest upgrade adds private email without replacing device tokens',async()=>{
  const uid=prefix+'-web-upgrade';
  await profile(uid,{isGuest:true,authProvider:'anonymous'});
  await contact(uid).set({email:null,fcmTokens:['device']});
  await upsert(client(uid))(user(uid),'en');
  assert.deepEqual((await contact(uid).get()).data(),{email:'private@example.test',fcmTokens:['device']});
  assert.equal((await db.doc('users/'+uid).get()).data().isGuest,undefined);
  const fresh=prefix+'-web-email-less';
  await contact(fresh).set({email:'retained@example.test',fcmTokens:['device']});
  await upsert(client(fresh))({...user(fresh),email:null},'en');
  assert.deepEqual((await contact(fresh).get()).data(),{email:'retained@example.test',fcmTokens:['device']});
});

test('Web concurrent bootstrap and token registration preserve both devices and profile failures surface',async()=>{
  const uid=prefix+'-web-race';await profile(uid,{fcmTokens:['ios']});await contact(uid).set({fcmTokens:['web']});
  const sdk=client(uid),save=upsert(sdk);
  await Promise.all([save(user(uid),'en'),f.updateDoc(f.doc(sdk,`users/${uid}/private/contact`),{fcmTokens:f.arrayUnion('new-device')})]);
  assert.deepEqual(new Set((await contact(uid).get()).data().fcmTokens),new Set(['web','ios','new-device']));
  await assert.rejects(save(user(prefix+'-not-me'),'en'),{code:'permission-denied'});
});
