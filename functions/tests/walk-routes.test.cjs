const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, functions, auth, Timestamp } = require('./emulator.cjs');
const call = (uid, data) => functions.manageWalkRoute.run({ auth: auth(uid), data });
const start = async (id, overrides = {}) => {
  await db.doc('pets/route-pet').set({ ownerUid: 'route-owner', familyId: 'route-family', name: 'Mango' });
  await db.doc('families/route-family').set({ memberUids: ['route-owner', 'route-peer'] });
  const data = { op: 'start', sessionId: id, petId: 'route-pet', familyId: 'route-family', startedAtMs: Date.now() - 60000, shareLive: true, ...overrides };
  await call('route-owner', data);
  return data;
};
const point = (t, segment = 0) => ({ lat: 25, lng: 121, t, segment });
after(() => db.terminate());

test('session start is immutable and retries do not reset six-hour expiry', async () => {
  const input = await start('route-immutable');
  await call('route-owner', input);
  const s = (await db.doc('walkRouteSessions/route-immutable').get()).data();
  assert.equal(s.expiresAt.toMillis(), input.startedAtMs + 21600000);
  await assert.rejects(call('route-owner', { ...input, startedAtMs: input.startedAtMs + 1 }), { code: 'already-exists' });
  await assert.rejects(call('route-peer', { ...input }), { code: 'permission-denied' });
});

test('offline end permits ordered idempotent backfill and finalize creates only one Walk', async () => {
  const input = await start('route-offline');
  const endedAtMs = input.startedAtMs + 40000;
  await call('route-owner', { op: 'end', sessionId: input.sessionId, endedAtMs });
  const upload = { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points: [point(input.startedAtMs), point(endedAtMs, 1)] };
  await call('route-owner', upload);
  await call('route-owner', upload);
  await assert.rejects(call('route-owner', { ...upload, points: [point(input.startedAtMs)] }), { code: 'already-exists' });
  await assert.rejects(call('route-owner', { op: 'publish', sessionId: input.sessionId, point: point(endedAtMs) }), { code: 'failed-precondition' });
  const finish = { op: 'finalize', sessionId: input.sessionId, chunkCount: 1, pointCount: 2, distanceKm: 0, durationMin: 0.5, score: 0.3 };
  await assert.rejects(call('route-owner', { ...finish, chunkCount: 2 }), { code: 'failed-precondition' });
  await call('route-owner', finish);
  await call('route-owner', finish);
  assert.equal((await db.doc(`walks/${input.sessionId}`).get()).data().routeVersion, 1);
  assert.equal((await db.doc(`walkRouteSessions/${input.sessionId}`).get()).data().pointCount, 2);
  await assert.rejects(call('route-owner', { ...upload, chunkIndex: 1 }), { code: 'failed-precondition' });
});

test('rejects future/out-of-range/unordered points and expired live packets', async () => {
  const input = await start('route-validation');
  for (const points of [[point(input.startedAtMs - 1)], [{ ...point(Date.now()), lat: 91 }], [point(input.startedAtMs + 1), point(input.startedAtMs)]]) {
    await assert.rejects(call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points }), { code: 'invalid-argument' });
  }
  await assert.rejects(call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 1, points: [point(input.startedAtMs)] }), { code: 'failed-precondition' });
  await call('route-owner', { op: 'publish', sessionId: input.sessionId, point: point(Date.now() - 1000) });
  const old = (await db.doc(`walkLiveLocations/${input.sessionId}`).get()).data();
  await assert.rejects(call('route-owner', { op: 'publish', sessionId: input.sessionId, point: point(old.locatedAt.toMillis()) }), { code: 'failed-precondition' });
  const expired = await start('route-expired', { startedAtMs: Date.now() - 21600001 });
  await assert.rejects(call('route-owner', { op: 'publish', sessionId: expired.sessionId, point: point(Date.now()) }), { code: 'failed-precondition' });
});

const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer: getDoc, setDoc, deleteDoc, terminate, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const clients = [];
function reader(uid, provider = 'password') {
  const app = initializeApp({ projectId: 'demo-mango-security', apiKey: 'emulator-only' }, `routes-${uid}-${clients.length}`);
  const client = getFirestore(app);
  connectFirestoreEmulator(client, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]), { mockUserToken: { sub: uid, firebase: { sign_in_provider: provider } } });
  clients.push([app, client]);
  return client;
}
const peer = reader('route-peer');
const owner = reader('route-owner');
const stranger = reader('route-stranger');
const denied = (p) => assert.rejects(p, { code: 'permission-denied' });
after(async () => { for (const [app, client] of clients) { await terminate(client); await deleteApp(app); } });

test('family reads latest only during active sharing and history only after finalized', async () => {
  const input = await start('route-acl');
  const t = input.startedAtMs + 10000;
  await call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points: [point(t)] });
  const chunk = 'walkRouteSessions/route-acl/chunks/0000000000';
  await getDoc(doc(owner, chunk));
  await denied(getDoc(doc(peer, chunk)));
  await denied(getDoc(doc(stranger, chunk)));
  await denied(setDoc(doc(owner, chunk), { points: [] }));
  await call('route-owner', { op: 'publish', sessionId: input.sessionId, point: point(t) });
  assert.equal((await getDoc(doc(peer, 'walkLiveLocations/route-acl'))).data().lat, 25);
  await denied(getDoc(doc(stranger, 'walkLiveLocations/route-acl')));
  await call('route-owner', { op: 'end', sessionId: input.sessionId, endedAtMs: t });
  await denied(getDoc(doc(peer, chunk)));
  await call('route-owner', { op: 'finalize', sessionId: input.sessionId, chunkCount: 1, pointCount: 1, distanceKm: 0, durationMin: 0, score: 0 });
  assert.equal((await getDoc(doc(peer, chunk))).data().points.length, 1);
  await db.doc('families/route-family').update({ memberUids: ['route-owner', 'route-new'] });
  await denied(getDoc(doc(peer, chunk)));
  const newcomer = reader('route-new');
  assert.equal((await getDoc(doc(newcomer, chunk))).exists(), true);
});

test('latest reads expire at five minutes and original six-hour deadline without new packets', async () => {
  await start('route-time-read');
  // Use a past deadline with a margin: emulator request-time precision is not a controllable clock.
  const ref = db.doc('walkLiveLocations/route-time-read');
  await ref.set({ familyId: 'route-family', walkerUid: 'route-owner', locatedAt: Timestamp.fromMillis(Date.now() - 300001), expiresAt: Timestamp.fromMillis(Date.now() - 60000) });
  await denied(getDoc(doc(peer, ref.path)));
  await ref.update({ expiresAt: Timestamp.fromMillis(Date.now() + 300000) });
  await db.doc('walkRouteSessions/route-time-read').update({ expiresAt: Timestamp.fromMillis(Date.now() - 60000) });
  await denied(getDoc(doc(peer, ref.path)));
  await db.doc('walkRouteSessions/route-time-read').update({ expiresAt: Timestamp.fromMillis(Date.now() + 300000) });
  await db.doc('families/route-family').update({ memberUids: ['route-peer'] });
  await denied(getDoc(doc(peer, ref.path)));
});

test('personal routes stay private; sharing-off family history still becomes readable', async () => {
  await db.doc('pets/route-personal-pet').set({ ownerUid: 'route-owner', familyId: null, name: 'Mango' });
  const personal = await start('route-personal', { petId: 'route-personal-pet', familyId: null, shareLive: false });
  await denied(getDoc(doc(peer, 'walkRouteSessions/route-personal')));
  await getDoc(doc(owner, 'walkRouteSessions/route-personal'));
  await assert.rejects(call('route-owner', { op: 'publish', sessionId: personal.sessionId, point: point(Date.now()) }), { code: 'failed-precondition' });
  const off = await start('route-off', { shareLive: false });
  await call('route-owner', { op: 'end', sessionId: off.sessionId, endedAtMs: off.startedAtMs });
  await call('route-owner', { op: 'finalize', sessionId: off.sessionId, chunkCount: 0, pointCount: 0, distanceKm: 0, durationMin: 0, score: 0 });
  assert.equal((await getDoc(doc(peer, 'walkRouteSessions/route-off'))).exists(), true);
});

test('legacy Walk deletion immediately denies route reads, then cleanup retains resurrection fence', async () => {
  const input = await start('route-delete');
  await call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points: [point(input.startedAtMs)] });
  await call('route-owner', { op: 'end', sessionId: input.sessionId, endedAtMs: input.startedAtMs });
  await call('route-owner', { op: 'finalize', sessionId: input.sessionId, chunkCount: 1, pointCount: 1, distanceKm: 0, durationMin: 0, score: 0 });
  const saved = (await getDoc(doc(owner, 'walks/route-delete'))).data();
  await deleteDoc(doc(peer, 'walks/route-delete'));
  await denied(getDoc(doc(owner, 'walkRouteSessions/route-delete/chunks/0000000000')));
  await denied(setDoc(doc(owner, 'walks/route-delete'), saved));
  await functions.cleanupDeletedWalkRoute.run({ params: { walkId: input.sessionId } });
  await functions.cleanupDeletedWalkRoute.run({ params: { walkId: input.sessionId } });
  assert.equal((await db.collection('walkRouteSessions/route-delete/chunks').get()).size, 0);
  await assert.rejects(call('route-owner', input), { code: 'failed-precondition' });
  await assert.rejects(call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points: [point(input.startedAtMs)] }), { code: 'failed-precondition' });
});

test('concurrent finalization is idempotent and account deletion freezes all mutation', async () => {
  const input = await start('route-race');
  await call('route-owner', { op: 'end', sessionId: input.sessionId, endedAtMs: input.startedAtMs });
  const finish = { op: 'finalize', sessionId: input.sessionId, chunkCount: 0, pointCount: 0, distanceKm: 0, durationMin: 0, score: 0 };
  await Promise.all([call('route-owner', finish), call('route-owner', finish)]);
  assert.equal((await db.doc('walks/route-race').get()).exists, true);
  await db.doc('deletedAccounts/route-owner').set({ status: 'deleting' });
  await assert.rejects(call('route-owner', { op: 'delete', sessionId: input.sessionId }), { code: 'failed-precondition' });
  await db.doc('deletedAccounts/route-owner').delete();
  await call('route-owner', { op: 'delete', sessionId: input.sessionId });
  await call('route-owner', { op: 'delete', sessionId: input.sessionId });
  assert.equal((await db.doc('walks/route-race').get()).exists, false);
});

test('failed route chunk erasure remains discoverable by account and pet cleanup retries', async () => {
  const { eraseWalkRoute } = require('../lib/walk-routes.js');
  const input = await start('route-cleanup-retry');
  await call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points: [point(input.startedAtMs)] });
  const erase = db.recursiveDelete;
  // Fail only the external cleanup step; transaction/fence/query execute on real emulator.
  db.recursiveDelete = async () => { throw new Error('injected transient cleanup failure'); };
  try {
    await assert.rejects(eraseWalkRoute(db, input.sessionId), /injected transient/);
  } finally { db.recursiveDelete = erase; }
  const byOwner = await db.collection('walkRouteSessions').where('walkerUid', '==', 'route-owner').get();
  const byPet = await db.collection('walkRouteSessions').where('petId', '==', 'route-pet').get();
  assert.ok(byOwner.docs.some((d) => d.id === input.sessionId));
  assert.ok(byPet.docs.some((d) => d.id === input.sessionId));
  const tombstone = (await db.doc(`walkRouteSessions/${input.sessionId}`).get()).data();
  assert.deepEqual(Object.keys(tombstone).sort(), ['petId', 'sessionId', 'status', 'walkerUid']);
  await denied(getDoc(doc(owner, `walkRouteSessions/${input.sessionId}/chunks/0000000000`)));
  await eraseWalkRoute(db, input.sessionId);
  assert.equal((await db.collection(`walkRouteSessions/${input.sessionId}/chunks`).get()).size, 0);
});

test('more than 500 samples remain intact across chunks and segments', async () => {
  const input = await start('route-long');
  for (let chunkIndex = 0; chunkIndex < 3; chunkIndex++) {
    const points = Array.from({ length: 200 }, (_, j) => point(input.startedAtMs + chunkIndex * 200 + j, chunkIndex));
    await call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex, points });
  }
  const chunks = await db.collection('walkRouteSessions/route-long/chunks').orderBy('chunkIndex').get();
  assert.equal(chunks.docs.reduce((sum, d) => sum + d.data().points.length, 0), 600);
  assert.equal(chunks.docs[0].data().points[0].t, input.startedAtMs);
  assert.equal(chunks.docs[2].data().points[199].segment, 2);
});

test('unauthenticated/foreign/guest mutation and removed-member history upload are refused', async () => {
  await assert.rejects(functions.manageWalkRoute.run({ data: { op: 'start', sessionId: 'route-noauth' } }), { code: 'unauthenticated' });
  const input = await start('route-auth');
  await assert.rejects(call('route-stranger', { op: 'end', sessionId: input.sessionId, endedAtMs: input.startedAtMs }), { code: 'permission-denied' });
  await assert.rejects(functions.manageWalkRoute.run({ auth: auth('route-owner', 'anonymous'), data: { ...input, sessionId: 'route-guest' } }), { code: 'permission-denied' });
  await db.doc('families/route-family').update({ memberUids: ['route-peer'] });
  await assert.rejects(call('route-owner', { op: 'append', sessionId: input.sessionId, chunkIndex: 0, points: [point(input.startedAtMs)] }), { code: 'permission-denied' });
  // Losing membership must not stop the walker from shutting down a session.
  await call('route-owner', { op: 'end', sessionId: input.sessionId, endedAtMs: input.startedAtMs });
  await assert.rejects(call('route-owner', { op: 'finalize', sessionId: input.sessionId, chunkCount: 0, pointCount: 0, distanceKm: 0, durationMin: 0, score: 0 }), { code: 'permission-denied' });
});

test('family discovery denies outsiders and filters stale/inactive locations with bounded pagination', async () => {
  const input = await start('route-discovery');
  await call('route-owner', { op: 'publish', sessionId: input.sessionId, point: point(Date.now() - 1000) });
  await db.doc('walkLiveLocations/aaa-stale').set({ familyId: 'route-family', walkerUid: 'route-owner', locatedAt: Timestamp.fromMillis(1), expiresAt: Timestamp.fromMillis(2) });
  const list = (uid, data = {}) => functions.listWalkLiveLocations.run({ auth: auth(uid), data: { familyId: 'route-family', pageSize: 1, ...data } });
  await assert.rejects(list('route-stranger'), { code: 'permission-denied' });
  const first = await list('route-peer');
  assert.deepEqual(first.locations, []);
  assert.equal(first.nextCursor, 'aaa-stale');
  const found = [];
  let cursor = first.nextCursor;
  for (let page = 0; cursor && page < 30; page++) {
    const result = await list('route-peer', { cursor });
    found.push(...result.locations);
    cursor = result.nextCursor;
  }
  assert.ok(found.some((p) => p.sessionId === input.sessionId && p.lat === 25 && Number.isInteger(p.locatedAtMs)));
  assert.ok(!found.some((p) => p.sessionId === 'aaa-stale'));
  await call('route-owner', { op: 'end', sessionId: input.sessionId, endedAtMs: Date.now() });
  const afterEnd = await list('route-peer', { pageSize: 50 });
  assert.ok(!afterEnd.locations.some((p) => p.sessionId === input.sessionId));
});
