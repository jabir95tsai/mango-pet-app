const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {db,Timestamp}=require('./emulator.cjs');
const {initializeApp,deleteApp}=require('firebase/app');
const f=require('firebase/firestore');
const prefix='freeze-'+randomUUID(),apps=[],clients=[];
f.setLogLevel('silent');
function client(uid){
 const app=initializeApp({projectId:'demo-mango-security',apiKey:'demo'},uid);
 const sdk=f.getFirestore(app);f.connectFirestoreEmulator(sdk,'127.0.0.1',Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),{
  mockUserToken:{sub:uid,user_id:uid,firebase:{sign_in_provider:'password'}},
 });apps.push(app);clients.push(sdk);return sdk;
}
after(async()=>{for(const sdk of clients)await f.terminate(sdk);for(const app of apps)await deleteApp(app);await db.terminate();});

// Each operation succeeds with the very same account before a server-only
// checkpoint is added. This catches OR-precedence escapes and blanket denials.
const cases=[
 ['public profile',(u)=>`users/${u}`,(u)=>({uid:u,displayName:'Name'}),{displayName:'Changed'},false],
 ['private contact',(u)=>`users/${u}/private/contact`,()=>({email:null,fcmTokens:['device']}),{fcmTokens:[]}],
 ['friends',(u)=>`users/${u}/friends/peer`,()=>({displayName:'Peer'}),{displayName:'Updated'}],
 ['favorite restaurants',(u)=>`users/${u}/favoriteRestaurants/r`,()=>({saved:true}),{saved:false}],
 ['knowledge bookmarks',(u)=>`users/${u}/knowledgeBookmarks/a`,()=>({saved:true}),{saved:false}],
 ['photo download state',(u)=>`users/${u}/photoDownloadState/asset`,()=>({assetId:'asset',source:'post',sourceId:'p',urlHash:'h',downloadedAt:f.serverTimestamp(),mode:'download'}),{downloadedAt:f.serverTimestamp(),mode:'share'},false],
 ['pet',(u)=>`pets/${u}`,(u)=>({ownerUid:u,familyId:null,name:'Pet'}),{name:'Renamed'}],
 ['walk',(u)=>`walks/${u}`,(u)=>({walkerUid:u,ownerUid:u,petId:u,familyId:null,notes:'Walk'}),{notes:'Changed'}],
 ['reminder',(u)=>`reminders/${u}`,(u)=>({createdByUid:u,familyId:null,title:'Reminder'}),{title:'Changed'}],
 ['expense',(u)=>`expenses/${u}`,(u)=>({payerUid:u,familyId:null,amount:1}),{amount:2}],
 ['post',(u)=>`posts/${u}`,(u)=>({authorUid:u,visibility:'public',text:'Post',reactionCounts:{'❤️':0,'😂':0,'🐶':0,'👍':0,'🎉':0}}),{text:'Changed'}],
 ['review',(u)=>`restaurants/${u}/reviews/review`,(u)=>({authorUid:u,rating:4}),{rating:5}],
];
for(const [label,location,data,patch,canDelete=true] of cases)test(`deletion checkpoint freezes ${label} create/update/delete without changing reads`,async()=>{
 const uid=prefix+'-'+label.replaceAll(' ','-'),sdk=client(uid),ref=f.doc(sdk,location(uid));
 const marker=db.doc('deletedAccounts/'+uid);
 if(label==='walk')await db.doc('pets/'+uid).set({ownerUid:uid,familyId:null});
 await f.setDoc(ref,data(uid));await f.updateDoc(ref,patch);await f.getDocFromServer(ref);
 if(canDelete){await f.deleteDoc(ref);await f.setDoc(ref,data(uid));}
 await marker.set({state:'deleting'});
 await f.getDocFromServer(ref);
 await assert.rejects(f.updateDoc(ref,patch),{code:'permission-denied'});
 if(canDelete)await assert.rejects(f.deleteDoc(ref),{code:'permission-denied'});
 await db.doc(ref.path).delete();
 await assert.rejects(f.setDoc(ref,data(uid)),{code:'permission-denied'});
 await marker.set({state:'complete'});
 await assert.rejects(f.setDoc(ref,data(uid)),{code:'permission-denied'});
});

test('checkpoint freezes family member health writes and parent-owned deletes',async()=>{
 const uid=prefix+'-family',sdk=client(uid),family=uid+'-home',pet=uid+'-pet';
 await db.doc('families/'+family).set({memberUids:[uid]});
 await db.doc('pets/'+pet).set({familyId:family,ownerUid:'another-member'});
 const ref=f.doc(sdk,`pets/${pet}/healthRecords/weight`);
 const data={petId:pet,recordedByUid:uid,type:'weight',data:{kg:4},recordedAt:f.Timestamp.now(),createdAt:f.serverTimestamp()};
 await f.setDoc(ref,data);await f.updateDoc(ref,{data:{kg:5}});await f.deleteDoc(ref);await f.setDoc(ref,data);
 await db.doc('deletedAccounts/'+uid).set({state:'deleting'});
 await f.getDocFromServer(ref);
 await assert.rejects(f.updateDoc(ref,{data:{kg:6}}),{code:'permission-denied'});
 await assert.rejects(f.deleteDoc(ref),{code:'permission-denied'});
 await assert.rejects(f.deleteDoc(f.doc(sdk,'pets/'+pet)),{code:'permission-denied'});
 await assert.rejects(f.setDoc(f.doc(sdk,`pets/${pet}/healthRecords/new`),data),{code:'permission-denied'});
});

test('checkpoint freezes comments, reactions, reports, restaurant submission and outgoing friend requests',async()=>{
 const uid=prefix+'-community',sdk=client(uid),post=uid+'-post',peer=uid+'-peer';
 await db.doc('posts/'+post).set({authorUid:peer,visibility:'public'});
 const comment=f.doc(sdk,`posts/${post}/comments/mine`),reaction=f.doc(sdk,`posts/${post}/reactions/${uid}`),request=f.doc(sdk,`users/${peer}/friendRequests/${uid}`);
 const commentData={authorUid:uid,text:'Comment',createdAt:f.serverTimestamp()};
 const report={reporterUid:uid,targetType:'post',targetId:post,targetAuthorUid:peer,reason:'spam',status:'open',createdAt:f.serverTimestamp()};
 const atomicReaction=async(emoji)=>{
  await f.runTransaction(sdk,async tx=>{
   const previous=await tx.get(reaction),old=previous.exists()?previous.data().emoji:null;
   const b=f.doc(sdk,'posts/'+post);await tx.get(b);
   tx.update(b,Object.fromEntries(['❤️','😂','🐶','👍','🎉'].map(key=>[
    'reactionCounts.'+key,f.increment((emoji===key?1:0)-(old===key?1:0))])));
   if(emoji)tx.set(reaction,{uid,emoji,reactedAt:f.serverTimestamp()});else tx.delete(reaction);
  });
 };
 await f.setDoc(comment,commentData);await f.deleteDoc(comment);await f.setDoc(comment,commentData);
 await atomicReaction('❤️');await atomicReaction('🐶');await atomicReaction(null);await atomicReaction('❤️');
 await f.setDoc(request,{fromUid:uid});await f.deleteDoc(request);await f.setDoc(request,{fromUid:uid});
 await f.setDoc(f.doc(sdk,'reports/'+uid),report);
 await f.setDoc(f.doc(sdk,'restaurants/'+uid),{submittedByUid:uid});
 await db.doc('deletedAccounts/'+uid).set({state:'finalizing'});
 await assert.rejects(atomicReaction('🐶'),{code:'permission-denied'});
 await assert.rejects(atomicReaction(null),{code:'permission-denied'});
 for(const action of [()=>f.deleteDoc(comment),()=>f.setDoc(f.doc(sdk,`posts/${post}/comments/new`),commentData),()=>f.updateDoc(reaction,{type:'heart'}),()=>f.deleteDoc(reaction),()=>f.setDoc(reaction,{type:'heart'}),()=>f.deleteDoc(request),()=>f.updateDoc(f.doc(sdk,'posts/'+post),{reactionCounts:{like:2}}),()=>f.setDoc(f.doc(sdk,'reports/'+uid+'-new'),report),()=>f.setDoc(f.doc(sdk,'restaurants/'+uid+'-new'),{submittedByUid:uid})])await assert.rejects(action(),{code:'permission-denied'});
 await db.doc(request.path).delete();await assert.rejects(f.setDoc(request,{fromUid:uid}),{code:'permission-denied'});
});

test('checkpoint cannot be read/removed by clients and blocks requests to a deleted recipient',async()=>{
 const uid=prefix+'-marker',other=uid+'-other',sdk=client(uid),ref=f.doc(sdk,'deletedAccounts/'+uid);
 await assert.rejects(f.setDoc(ref,{state:'complete'}),{code:'permission-denied'});
 await db.doc(ref.path).set({state:'complete'});
 await assert.rejects(f.getDocFromServer(ref),{code:'permission-denied'});
 await assert.rejects(f.deleteDoc(ref),{code:'permission-denied'});
 const peer=client(other),request=f.doc(peer,`users/${uid}/friendRequests/${other}`);
 await assert.rejects(f.setDoc(request,{fromUid:other}),{code:'permission-denied'});
 await assert.rejects(f.setDoc(f.doc(peer,`users/${uid}/private/contact`),{fcmTokens:['attacker']}),{code:'permission-denied'});
 await f.setDoc(f.doc(peer,'users/'+other),{uid:other,displayName:'Still active'});
});

test('active family members cannot refill or transfer a deleting owner pet during cascade',async()=>{
 const uid=prefix+'-surviving-member',owner=prefix+'-departing-owner',sdk=client(uid),family=uid+'-family',pet=uid+'-pet';
 await db.doc('families/'+family).set({memberUids:[uid,owner]});
 await db.doc('pets/'+pet).set({ownerUid:owner,familyId:family,name:'Family pet'});
 const ref=f.doc(sdk,`pets/${pet}/healthRecords/weight`);
 const data={petId:pet,recordedByUid:uid,type:'weight',data:{kg:4},recordedAt:f.Timestamp.now(),createdAt:f.serverTimestamp()};
 await f.setDoc(ref,data);await f.updateDoc(ref,{data:{kg:5}});
 await f.updateDoc(f.doc(sdk,'pets/'+pet),{name:'Renamed by family'});
 await db.doc('deletedAccounts/'+owner).set({state:'deleting'});
 await f.getDocFromServer(ref);
 await assert.rejects(f.updateDoc(ref,{data:{kg:6}}),{code:'permission-denied'});
 await assert.rejects(f.deleteDoc(ref),{code:'permission-denied'});
 await assert.rejects(f.updateDoc(f.doc(sdk,'pets/'+pet),{ownerUid:uid}),{code:'permission-denied'});
 await assert.rejects(f.deleteDoc(f.doc(sdk,'pets/'+pet)),{code:'permission-denied'});
 await db.doc(ref.path).delete();
 await assert.rejects(f.setDoc(ref,data),{code:'permission-denied'});
});
