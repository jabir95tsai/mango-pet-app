const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, functions, auth } = require('./emulator.cjs');
const { consumeFamilyJoinAttempt, joinSelectedFamily } = require('../lib/family-join.js');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc, updateDoc,
  setLogLevel, terminate,
} = require('firebase/firestore');
setLogLevel('silent');
const app = initializeApp({ projectId: 'demo-mango-security', apiKey: 'emulator-only' }, 'join-rules');
const client = getFirestore(app);
connectFirestoreEmulator(client, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]), {
  mockUserToken: { sub: 'join-rules-user', firebase: { sign_in_provider: 'password' } },
});
const call = (uid, inviteCode) => functions.joinFamilyByCode.run({ auth: auth(uid), data: { inviteCode } });
const bucket = (uid) => db.doc(`familyJoinAttempts/${uid}`);
const reset = (uid) => bucket(uid).delete();
after(async () => { await terminate(client); await deleteApp(app); await db.terminate(); });

test('join auth and malformed input reject before querying or charging quota', async () => {
  const uid = 'join-invalid';
  await reset(uid);
  await assert.rejects(functions.joinFamilyByCode.run({ data: { inviteCode: '654321' } }), { code: 'unauthenticated' });
  await assert.rejects(functions.joinFamilyByCode.run({ auth: auth(uid, 'anonymous'), data: { inviteCode: '654321' } }), { code: 'permission-denied' });
  for (const code of [null, undefined, 123456, {}, [], true, '', '12345', 'abcdef', '1234567']) {
    await assert.rejects(call(uid, code), { code: 'invalid-argument' });
  }
  assert.equal((await bucket(uid).get()).exists, false);
});

test('wrong codes consume quota; correct code cannot bypass exhaustion or write membership', async () => {
  const uid = 'join-wrong';
  await reset(uid);
  await db.doc(`users/${uid}`).set({ uid, familyIds: [] });
  await db.doc('families/join-protected').set({ ownerUid: 'peer', memberUids: ['peer'], inviteCode: '654321' });
  for (let i = 0; i < 5; i++) await assert.rejects(call(uid, '000000'), { code: 'not-found' });
  await assert.rejects(call(uid, '654321'), (e) => e.code === 'resource-exhausted' && e.details.retryAfterSeconds > 0);
  assert.equal((await bucket(uid).get()).data().attemptsMs.length, 5);
  assert.deepEqual((await db.doc('families/join-protected').get()).data().memberUids, ['peer']);
  assert.deepEqual((await db.doc(`users/${uid}`).get()).data().familyIds, []);
});

test('successful and already-member calls also consume quota without duplicate membership', async () => {
  const uid = 'join-success';
  await reset(uid);
  await db.doc(`users/${uid}`).set({ uid, familyIds: [], authProvider: 'password' });
  await db.doc('families/join-success-family').set({ ownerUid: 'peer', memberUids: ['peer'], inviteCode: '654322' });
  assert.deepEqual(await call(uid, ' 654322 '), { familyId: 'join-success-family', alreadyMember: false });
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(await call(uid, '654322'), { familyId: 'join-success-family', alreadyMember: true });
  }
  await assert.rejects(call(uid, '654322'), { code: 'resource-exhausted' });
  assert.deepEqual((await db.doc('families/join-success-family').get()).data().memberUids, ['peer', uid]);
  assert.deepEqual((await db.doc(`users/${uid}`).get()).data().familyIds, ['join-success-family']);
  assert.equal((await db.doc(`users/${uid}`).get()).data().currentFamilyId, 'join-success-family');
});

test('concurrent guesses cannot exceed the five-attempt budget', async () => {
  const uid = 'join-concurrent';
  await reset(uid);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => call(uid, '000000')));
  const codes = results.map((r) => r.status === 'rejected' ? r.reason.code : 'unexpected-success');
  assert.equal(codes.filter((code) => code === 'not-found').length, 5);
  assert.equal(codes.filter((code) => code === 'resource-exhausted').length, 3);
  assert.equal((await bucket(uid).get()).data().attemptsMs.length, 5);
});

test('quota is a rolling 15-minute window, including exact expiration boundary', async () => {
  const uid = 'join-window';
  const now = 1800000000000;
  await reset(uid);
  for (let i = 0; i < 5; i++) await consumeFamilyJoinAttempt(db, uid, now + i * 1000);
  await assert.rejects(consumeFamilyJoinAttempt(db, uid, now + 899999), { code: 'resource-exhausted' });
  await consumeFamilyJoinAttempt(db, uid, now + 900000);
  await assert.rejects(consumeFamilyJoinAttempt(db, uid, now + 900001), { code: 'resource-exhausted' });
  await consumeFamilyJoinAttempt(db, uid, now + 901000);
});

test('twenty attempts across short windows exhaust the rolling day; old attempts expire', async () => {
  const uid = 'join-daily';
  const now = 1800000000000;
  await reset(uid);
  for (let i = 0; i < 20; i++) await consumeFamilyJoinAttempt(db, uid, now + i * 900000);
  await assert.rejects(consumeFamilyJoinAttempt(db, uid, now + 20 * 900000), { code: 'resource-exhausted' });
  await consumeFamilyJoinAttempt(db, uid, now + 86400000);
  assert.equal((await bucket(uid).get()).data().attemptsMs.length, 20);
  await assert.rejects(consumeFamilyJoinAttempt(db, uid, now + 86400001), { code: 'resource-exhausted' });
});

test('valid join succeeds after short-window expiration', async () => {
  const uid = 'join-expired';
  await bucket(uid).set({ attemptsMs: Array(5).fill(Date.now() - 901000) });
  await db.doc(`users/${uid}`).set({ uid, familyIds: [], authProvider: 'password' });
  await db.doc('families/join-expired-family').set({ ownerUid: 'peer', memberUids: ['peer'], inviteCode: '654323' });
  assert.equal((await call(uid, '654323')).alreadyMember, false);
});

test('rotated code or deleted family after selection cannot join or revive a family', async () => {
  const familyRef = db.doc('families/join-rotated');
  const uid = 'join-stale-code';
  await db.doc(`users/${uid}`).set({ uid, familyIds: [] });
  await familyRef.set({ memberUids: ['peer'], inviteCode: '654324' });
  const selected = await db.collection('families').where('inviteCode', '==', '654324').get();
  await familyRef.update({ inviteCode: '654325' });
  await assert.rejects(joinSelectedFamily(db, selected.docs[0].ref, uid, '654324'), { code: 'not-found' });
  await familyRef.delete();
  await assert.rejects(joinSelectedFamily(db, selected.docs[0].ref, uid, '654324'), { code: 'not-found' });
  assert.equal((await familyRef.get()).exists, false);
  assert.deepEqual((await db.doc(`users/${uid}`).get()).data().familyIds, []);
});

test('concurrent joins preserve every member and corresponding profile', async () => {
  const familyRef = db.doc('families/join-race');
  await familyRef.set({ memberUids: ['peer'], inviteCode: '654326' });
  const uids = ['join-race-a', 'join-race-b'];
  for (const uid of uids) { await reset(uid); await db.doc(`users/${uid}`).set({ uid, familyIds: [] }); }
  const results = await Promise.all(uids.map((uid) => call(uid, '654326')));
  assert.ok(results.every((r) => !r.alreadyMember));
  assert.deepEqual((await familyRef.get()).data().memberUids.sort(), ['peer', ...uids].sort());
  for (const uid of uids) assert.deepEqual((await db.doc(`users/${uid}`).get()).data().familyIds, ['join-race']);
});

test('client cannot read/write quota or reset it through profile/private edits', async () => {
  const uid = 'join-rules-user';
  const target = doc(client, `familyJoinAttempts/${uid}`);
  await bucket(uid).set({ attemptsMs: Array(5).fill(Date.now()) });
  const denied = (operation) => assert.rejects(operation, { code: 'permission-denied' });
  await denied(getDoc(target));
  await denied(setDoc(target, { attemptsMs: [] }));
  await denied(updateDoc(target, { attemptsMs: [] }));
  await denied(deleteDoc(target));
  await setDoc(doc(client, `users/${uid}`), { uid, familyIds: [] });
  await setDoc(doc(client, `users/${uid}/private/contact`), { attemptsMs: [], familyIds: [] });
  await assert.rejects(call(uid, '654321'), { code: 'resource-exhausted' });
});

test('malformed server quota state fails closed', async () => {
  const uid = 'join-corrupt';
  for (const attemptsMs of [null, 'bad', [NaN], [Infinity], [-1], Array(21).fill(Date.now())]) {
    await bucket(uid).set({ attemptsMs });
    await assert.rejects(call(uid, '654321'), { code: 'internal' });
  }
});
