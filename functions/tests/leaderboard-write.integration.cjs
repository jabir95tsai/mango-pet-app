const { test, after } = require('node:test');
const assert = require('node:assert/strict');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-mango-leaderboard');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8197');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { writeActiveLeaderboardEntries, syncExistingDogEntryVisibility } = require('../lib/leaderboard-write.js');
const { computeWalkerPeriodScore, computeDogPeriodScore } = require('../lib/leaderboard-helpers.js');
const app = initializeApp({ projectId: 'demo-mango-leaderboard' }, 'leaderboard-write-regression');
const db = getFirestore(app);
after(() => deleteApp(app));
const entry = (board, id) => db.doc(`${board}/test/entries/${id}`);
const exists = async (ref) => (await ref.get()).exists;

test('normal walker/dog writes preserve merge fields and clean stale entries', async () => {
  const walker = entry('leaderboards', 'normal'), dog = entry('dogLeaderboards', 'normal-dog');
  const obsolete = entry('leaderboards', 'obsolete');
  await walker.set({ uid: 'normal', previousRank: 4, totalScore: 1 });
  await obsolete.set({ uid: 'obsolete' });
  await writeActiveLeaderboardEntries(db, [
    { ref: walker, ownerUid: 'normal', data: { uid: 'normal', totalScore: 10 }, merge: true },
    { ref: dog, ownerUid: 'normal', data: { petId: 'normal-dog', ownerUid: 'normal', totalScore: 10 } },
  ], [obsolete]);
  assert.deepEqual((await walker.get()).data(), { uid: 'normal', previousRank: 4, totalScore: 10 });
  assert.equal((await dog.get()).data().totalScore, 10);
  assert.equal(await exists(obsolete), false);
});

test('scores computed before deleting/complete checkpoints cannot revive either board', async () => {
  for (const state of ['deleting', 'complete']) {
    const uid = `stale-${state}`, petId = `pet-${state}`;
    const profile = db.doc(`users/${uid}`), pet = db.doc(`pets/${petId}`), walk = db.doc(`walks/${uid}`);
    await profile.set({ displayName: 'Fixture', isGuest: false });
    await pet.set({ ownerUid: uid, name: 'Fixture dog' });
    await walk.set({ walkerUid: uid, petId, familyId: 'family', startedAt: Timestamp.now(), durationMin: 10, score: 5, distanceKm: 1 });
    const [walkerScore, dogScore] = await Promise.all([
      computeWalkerPeriodScore(uid, 'all_time', db), computeDogPeriodScore(petId, 'all_time', db),
    ]);
    assert.ok(walkerScore); assert.ok(dogScore);
    await db.doc(`deletedAccounts/${uid}`).set({ state });
    await Promise.all([profile.delete(), pet.delete(), walk.delete()]);
    const walker = entry('leaderboards', uid), dog = entry('dogLeaderboards', petId);
    await writeActiveLeaderboardEntries(db, [
      { ref: walker, ownerUid: walkerScore.uid, data: { uid, totalScore: walkerScore.totalScore }, merge: true },
      { ref: dog, ownerUid: dogScore.ownerUid, data: { petId, ownerUid: uid, totalScore: dogScore.totalScore } },
    ]);
    assert.equal(await exists(walker), false); assert.equal(await exists(dog), false);
  }
});

test('a checkpoint racing the transaction cannot leave a late recreated entry', async () => {
  const uid = 'transaction-race', target = entry('leaderboards', uid), marker = db.doc(`deletedAccounts/${uid}`);
  let read, resume;
  const markerRead = new Promise(resolve => { read = resolve; });
  const continueWrite = new Promise(resolve => { resume = resolve; });
  let paused = false;
  const observedDb = {
    doc: db.doc.bind(db),
    runTransaction: callback => db.runTransaction(tx => callback({
      get: async ref => {
        const snap = await tx.get(ref);
        if (!paused && ref.path === marker.path) { paused = true; read(); await continueWrite; }
        return snap;
      },
      set: tx.set.bind(tx), delete: tx.delete.bind(tx),
    })),
  };
  const writing = writeActiveLeaderboardEntries(observedDb, [{ ref: target, ownerUid: uid, data: { uid, totalScore: 99 } }]);
  await markerRead;
  const deleting = db.batch().set(marker, { state: 'deleting' }).delete(target).commit();
  // Release the writer after the competing deletion has been dispatched. The
  // real Admin transaction either commits first or retries and sees the marker.
  await new Promise(resolve => setTimeout(resolve, 25));
  resume();
  await Promise.all([writing, deleting]);
  assert.equal(await exists(target), false);
});

test('visibility sync updates existing owner entries and never revives stale query refs', async () => {
  const uid = 'visibility', live = entry('dogLeaderboards', 'live'), removed = entry('dogLeaderboards', 'removed');
  const changedOwner = entry('dogLeaderboards', 'changed-owner'), foreignCollection = db.doc('unrelated/test/entries/foreign');
  await live.set({ ownerUid: uid, totalScore: 7, ownerVisibility: 'public' });
  await removed.set({ ownerUid: uid });
  const staleRefs = [live, removed, changedOwner, foreignCollection];
  await removed.delete();
  await changedOwner.set({ ownerUid: 'new-owner', ownerVisibility: 'public' });
  await foreignCollection.set({ ownerUid: uid, ownerVisibility: 'public' });
  assert.equal(await syncExistingDogEntryVisibility(db, uid, staleRefs, 'friends', Timestamp.now()), 1);
  assert.equal((await live.get()).data().ownerVisibility, 'friends');
  assert.equal((await live.get()).data().totalScore, 7);
  assert.equal(await exists(removed), false);
  assert.equal((await changedOwner.get()).data().ownerVisibility, 'public');
  assert.equal((await foreignCollection.get()).data().ownerVisibility, 'public');
  await db.doc(`deletedAccounts/${uid}`).set({ state: 'complete' });
  assert.equal(await syncExistingDogEntryVisibility(db, uid, [live], 'off', Timestamp.now()), 0);
  assert.equal((await live.get()).data().ownerVisibility, 'friends');
});

test('full-period cleanup/write fanout commits at most 400 operations per transaction', async () => {
  const sizes = [];
  const observedDb = {
    doc: db.doc.bind(db),
    runTransaction: callback => db.runTransaction(async tx => {
      let count = 0;
      const result = await callback({ get: tx.get.bind(tx), set(...args) { count++; return tx.set(...args); }, delete(...args) { count++; return tx.delete(...args); } });
      sizes.push(count); return result;
    }),
  };
  const writes = Array.from({ length: 801 }, (_, index) => ({
    ref: entry('dogLeaderboards', `chunk-${index}`), ownerUid: 'chunk-owner', data: { ownerUid: 'chunk-owner', totalScore: index },
  }));
  await writeActiveLeaderboardEntries(observedDb, writes, [entry('dogLeaderboards', 'absent-cleanup')]);
  assert.deepEqual(sizes, [400, 400, 2]);
  assert.equal(await exists(writes[800].ref), true);
});
