const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./emulator.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator, doc, collection, setDoc, getDoc,
  getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp,
  serverTimestamp, terminate, setLogLevel,
} = require('firebase/firestore');

// Expected permission denials are asserted below; avoid flooding successful runs.
setLogLevel('silent');

const apps = [];
const clients = [];
function client(uid, provider = 'password') {
  const app = initializeApp({ projectId: 'demo-mango-security', apiKey: 'emulator-only' }, `rules-${apps.length}`);
  const firestore = getFirestore(app);
  const port = Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]);
  connectFirestoreEmulator(firestore, '127.0.0.1', port, uid ? {
    mockUserToken: { sub: uid, firebase: { sign_in_provider: provider } },
  } : undefined);
  apps.push(app); clients.push(firestore);
  return firestore;
}
const owner = client('health-owner');
const member = client('health-member');
const outsider = client('health-outsider');
const guest = client('health-guest', 'anonymous');
const unauth = client();
let serial = 0;
const ref = (clientDb, pet, id = `new-${++serial}`) => doc(clientDb, `pets/${pet}/healthRecords/${id}`);
const record = (pet, uid, type = 'weight', data = { kg: 5 }) => ({
  petId: pet, recordedByUid: uid, type, data,
  recordedAt: Timestamp.fromMillis(1700000000000), createdAt: serverTimestamp(), notes: null,
});
const denied = (operation) => assert.rejects(operation, { code: 'permission-denied' });

before(async () => {
  const batch = db.batch();
  batch.set(db.doc('families/health-family'), { ownerUid: 'health-owner', memberUids: ['health-owner', 'health-member'] });
  batch.set(db.doc('users/health-outsider'), { uid: 'health-outsider', familyIds: ['health-family'] });
  for (const [pet, ownerUid, familyId] of [
    ['health-personal', 'health-owner', null], ['health-shared', 'health-owner', 'health-family'],
    ['health-guest-pet', 'health-guest', null], ['health-missing-family', 'health-owner', 'nonexistent'],
  ]) batch.set(db.doc(`pets/${pet}`), { ownerUid, familyId });
  for (const pet of ['health-personal', 'health-shared', 'health-orphan', 'health-missing-family']) {
    batch.set(db.doc(`pets/${pet}/healthRecords/legacy`), {
      petId: pet, familyId: 'old-family', type: 'feeding', data: {}, recordedAt: new Date(1700000000000),
    });
  }
  await batch.commit();
});
after(async () => {
  await Promise.all(clients.map(terminate));
  await Promise.all(apps.map(deleteApp));
  await db.terminate();
});

test('unauthenticated / outsider / fake family cache / missing parent cannot perform health CRUD', async () => {
  for (const [c, uid, pet] of [
    [unauth, 'health-owner', 'health-personal'], [unauth, 'x', 'health-orphan'],
    [outsider, 'health-outsider', 'health-personal'], [outsider, 'health-outsider', 'health-shared'],
    [guest, 'health-guest', 'health-personal'], [owner, 'health-owner', 'health-orphan'],
    [owner, 'health-owner', 'health-missing-family'],
  ]) {
    await denied(setDoc(ref(c, pet), record(pet, uid)));
    await denied(getDoc(ref(c, pet, 'legacy')));
    await denied(getDoc(ref(c, pet, 'does-not-exist')));
    await denied(getDocs(collection(c, `pets/${pet}/healthRecords`)));
    await denied(updateDoc(ref(c, pet, 'legacy'), { notes: 'attack' }));
    await denied(deleteDoc(ref(c, pet, 'legacy')));
  }
});

test('personal owner, anonymous owner and family member retain CRUD and ordered query access', async () => {
  for (const [c, uid, pet] of [
    [owner, 'health-owner', 'health-personal'], [guest, 'health-guest', 'health-guest-pet'],
    [member, 'health-member', 'health-shared'],
  ]) {
    const target = ref(c, pet);
    await setDoc(target, record(pet, uid));
    assert.equal((await getDoc(target)).data().recordedByUid, uid);
    await updateDoc(target, { notes: 'edited', data: { kg: 6 } });
    const list = collection(c, `pets/${pet}/healthRecords`);
    assert.ok((await getDocs(query(list, orderBy('recordedAt', 'desc')))).size >= 1);
    assert.ok((await getDocs(query(list, where('type', '==', 'weight'), orderBy('recordedAt', 'asc')))).size >= 1);
    await deleteDoc(target);
    assert.equal((await getDoc(target)).exists(), false);
  }
});

test('five client payload shapes, empty feeding, optional dates and null notes work', async () => {
  for (const [type, data] of [
    ['weight', { kg: 5.5 }], ['feeding', {}], ['feeding', { brand: '', amountG: 0, foodType: 'dry' }],
    ['vaccine', { name: 'Rabies' }], ['vaccine', { name: 'Rabies', nextDueAt: Timestamp.now() }],
    ['vet', { clinic: 'Clinic', doctor: '', diagnosis: 'Routine', prescription: '' }],
    ['medication', { name: 'Rx' }],
    ['medication', { name: 'Rx', frequency: '', startsAt: Timestamp.now(), endsAt: Timestamp.now() }],
  ]) await setDoc(ref(owner, 'health-personal'), record('health-personal', 'health-owner', type, data));
});

test('create rejects spoofed metadata, unknown fields, invalid types, invalid numbers and oversized text', async () => {
  const variants = [
    { petId: 'another-pet' }, { recordedByUid: 'someone-else' }, { createdAt: Timestamp.fromMillis(0) },
    { type: 'unknown' }, { familyId: 'health-family' }, { admin: true }, { data: [] },
    { data: { kg: 5, extra: true } }, { recordedAt: '2026-10-05' }, { notes: 42 }, { notes: 'x'.repeat(10001) },
    ...[-1, 0, NaN, Infinity, 10001, '5'].map((kg) => ({ data: { kg } })),
    { type: 'feeding', data: { amountG: -1 } }, { type: 'feeding', data: { amountG: Infinity } },
    { type: 'feeding', data: { brand: 42 } }, { type: 'feeding', data: { brand: 'x'.repeat(501) } },
    { type: 'vaccine', data: { name: '' } }, { type: 'vaccine', data: { name: 'v', nextDueAt: 'tomorrow' } },
    { type: 'vet', data: { clinic: 'c' } }, { type: 'medication', data: { name: 'm', startsAt: 0 } },
  ];
  for (const change of variants) {
    await denied(setDoc(ref(owner, 'health-personal'), { ...record('health-personal', 'health-owner'), ...change }));
  }
  for (const key of ['petId', 'recordedByUid', 'type', 'data', 'recordedAt', 'createdAt']) {
    const payload = record('health-personal', 'health-owner');
    delete payload[key];
    await denied(setDoc(ref(owner, 'health-personal'), payload));
  }
});

test('updates preserve attribution / pet / creation time; legacy records remain accessible', async () => {
  const target = ref(owner, 'health-shared');
  await setDoc(target, record('health-shared', 'health-owner'));
  for (const change of [
    { recordedByUid: 'health-member' }, { petId: 'other' }, { createdAt: serverTimestamp() },
    { familyId: 'other' }, { notes: 1 }, { data: { kg: -1 } },
  ]) await denied(updateDoc(ref(member, 'health-shared', target.id), change));
  await updateDoc(ref(member, 'health-shared', target.id), { notes: 'family edit' });
  await deleteDoc(ref(member, 'health-shared', target.id));
  for (const [c, pet] of [[owner, 'health-personal'], [member, 'health-shared']]) {
    const legacy = ref(c, pet, 'legacy');
    assert.ok((await getDoc(legacy)).exists());
    await updateDoc(legacy, { notes: 'legacy edit' });
    await deleteDoc(legacy);
  }
});

test('removing family membership immediately revokes health access', async () => {
  await db.doc('families/health-revoked-family').set({ memberUids: ['health-member'] });
  await db.doc('pets/health-revoked').set({ ownerUid: 'peer', familyId: 'health-revoked-family' });
  const target = ref(member, 'health-revoked');
  await setDoc(target, record('health-revoked', 'health-member'));
  await db.doc('families/health-revoked-family').update({ memberUids: ['peer'] });
  await denied(getDoc(target));
  await denied(deleteDoc(target));
  await denied(setDoc(ref(member, 'health-revoked'), record('health-revoked', 'health-member')));
});
