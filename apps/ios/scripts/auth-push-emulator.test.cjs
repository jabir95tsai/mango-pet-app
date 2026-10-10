// Real TS modules + native Firestore API adapter -> Web SDK/emulator rules.
// Provider/APNs calls remain mocked; this is NOT native device validation.
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const {harness,load,root}=require('./auth-push-harness.cjs');
const projectId=process.env.GCLOUD_PROJECT;
assert.ok(['demo-mango-security','demo-mango-ios-auth'].includes(projectId));
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^127\.0\.0\.1:\d+$/);
const emulatorPort=Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]);
const sdk=require('firebase/firestore');
const {initializeApp,deleteApp}=require('firebase/app');
const adminRequire=createRequire(path.join(root,'functions/package.json'));
const {initializeApp:adminInit,deleteApp:adminDelete}=adminRequire('firebase-admin/app');
const {getFirestore}=adminRequire('firebase-admin/firestore');
const adminApp=adminInit({projectId},'ios-auth-fixtures');
const admin=getFirestore(adminApp);const apps=[];
function client(uid,guest=false) {
 const h=harness();h.authState.currentUser=h.user(uid,{isAnonymous:guest,email:guest?null:`${uid}@example.test`,providerData:guest?[]:[{providerId:'google.com',uid}]});
 const app=initializeApp({projectId,apiKey:'emulator-only'},uid);apps.push(app);
 const db=sdk.getFirestore(app);sdk.connectFirestoreEmulator(db,'127.0.0.1',emulatorPort,{mockUserToken:{sub:uid,firebase:{sign_in_provider:guest?'anonymous':'password'}}});
 function snap(value){return{exists:()=>value.exists(),data:()=>value.data()};}
 function ref(raw){return{raw,path:raw.path,collection:name=>({doc:id=>ref(sdk.doc(raw,name,id))}),get:async()=>snap(await sdk.getDoc(raw)),set:(data,options)=>sdk.setDoc(raw,data,options)};}
 const native=()=>({collection:name=>({doc:id=>ref(sdk.doc(db,name,id))}),
 runTransaction:fn=>sdk.runTransaction(db,tx=>fn({get:async r=>snap(await tx.get(r.raw)),set:(r,d,o)=>tx.set(r.raw,d,o),update:(r,d)=>tx.update(r.raw,d)})),
 batch:()=>{const b=sdk.writeBatch(db);return{set:(r,d,o)=>b.set(r.raw,d,o),update:(r,d)=>b.update(r.raw,d),commit:()=>b.commit()};},});
 native.FieldValue={serverTimestamp:sdk.serverTimestamp,delete:sdk.deleteField,arrayUnion:sdk.arrayUnion,arrayRemove:sdk.arrayRemove};
 const modules={...h.modules,'@/lib/firebase':{...h.modules['@/lib/firebase'],firestore:native},'@react-native-firebase/firestore':native};
 return {...h,db,profile:load('src/lib/auth-profile.ts',modules),push:load('src/lib/push.ts',modules)};
}
const alice=client('ios-first-user');const guest=client('ios-guest',true);const bob=client('ios-outsider');
after(async()=>{await Promise.all(apps.map(deleteApp));await adminDelete(adminApp);});
test('first native user and guest bootstrap pass actual rules; private email absent publicly',async()=>{
 await alice.profile.ensureUserProfile(alice.authState.currentUser);await guest.profile.ensureUserProfile(guest.authState.currentUser);
 const profile=(await admin.doc('users/ios-first-user').get()).data();assert.equal(profile.uid,'ios-first-user');assert.equal('email' in profile,false);assert.equal('fcmTokens' in profile,false);
 assert.equal((await admin.doc('users/ios-first-user/private/contact').get()).data().email,'ios-first-user@example.test');
 const gp=(await admin.doc('users/ios-guest').get()).data();assert.equal(gp.isGuest,true);assert.equal('displayNameLower' in gp,false);
});
test('native migration removes public PII and unions existing private device tokens in one transaction',async()=>{
 const uid='ios-first-user';await admin.doc(`users/${uid}`).set({email:'old@example.test',fcmTokens:['legacy-token','device-B'],displayName:'Custom Name'},{merge:true});await admin.doc(`users/${uid}/private/contact`).set({fcmTokens:['device-A','device-B']},{merge:true});
 await alice.profile.ensureUserProfile(alice.authState.currentUser);
 const profile=(await admin.doc(`users/${uid}`).get()).data();assert.equal(profile.displayName,'Custom Name');assert.equal('email' in profile,false);assert.equal('fcmTokens' in profile,false);
 const tokens=(await admin.doc(`users/${uid}/private/contact`).get()).data().fcmTokens;assert.deepEqual(new Set(tokens),new Set(['legacy-token','device-A','device-B']));
});
test('native enable and logout write private tokens without removing other installations',async()=>{
 alice.state.permission=1;alice.state.token='this-ios-device';assert.equal(await alice.push.enablePush('ios-first-user'),'enabled');
 const privateDoc=admin.doc('users/ios-first-user/private/contact');assert.ok((await privateDoc.get()).data().fcmTokens.includes('this-ios-device'));
 await alice.push.detachPushToken('ios-first-user');const tokens=(await privateDoc.get()).data().fcmTokens;assert.equal(tokens.includes('this-ios-device'),false);assert.ok(tokens.includes('device-B'));
});
test('other authenticated user cannot read or write native private contact',async()=>{
 await assert.rejects(sdk.getDoc(sdk.doc(bob.db,'users/ios-first-user/private/contact')),e=>e.code==='permission-denied');
 await assert.rejects(sdk.setDoc(sdk.doc(bob.db,'users/ios-first-user/private/contact'),{fcmTokens:['attacker']}),e=>e.code==='permission-denied');
 assert.equal((await sdk.getDoc(sdk.doc(bob.db,'users/ios-first-user'))).data().displayName,'Custom Name');
});
test('old public token writes are rejected by new rules for both create and update',async()=>{
 await assert.rejects(sdk.setDoc(sdk.doc(bob.db,'users/ios-outsider'),{uid:'ios-outsider',fcmTokens:['public-token']}),e=>e.code==='permission-denied');
 await assert.rejects(sdk.setDoc(sdk.doc(alice.db,'users/ios-first-user'),{fcmTokens:['public-token']},{merge:true}),e=>e.code==='permission-denied');
});
test('deletion marker prevents profile bootstrap instead of allowing private re-creation',{skip:process.env.TEST_DELETION_MARKER!=='1'},async()=>{
 await admin.doc('deletedAccounts/ios-outsider').set({status:'deleting'});
 await assert.rejects(bob.profile.ensureUserProfile(bob.authState.currentUser),e=>e.code==='permission-denied');assert.equal((await admin.doc('users/ios-outsider').get()).exists,false);
});
