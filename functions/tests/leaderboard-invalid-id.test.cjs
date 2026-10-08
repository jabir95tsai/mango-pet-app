const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, Timestamp, functions } = require('./emulator.cjs');
const { isFirestoreDocumentId } = require('../lib/document-id.js');
const { computeDogPeriodScore } = require('../lib/leaderboard-helpers.js');

const invalid = [undefined, null, 1, {}, '', '.', '..', 'pets/nested', '__verify_dog_lb_pet__', '__line\n__', 'a'.repeat(1501), '狗'.repeat(501), '\ud800'];

test('document ID guard covers reserved paths, invalid UTF-8 and the byte limit', () => {
  for (const id of invalid) assert.equal(isFirestoreDocumentId(id), false);
  for (const id of ['dog-123', '_dog', '__dog', 'dog__', '毛孩🐕', 'a'.repeat(1500), '狗'.repeat(500)]) assert.equal(isFirestoreDocumentId(id), true);
});

test('invalid dog IDs never reach Firestore reads or realtime delete paths', async () => {
  const noIO = new Proxy({}, { get() { throw Error('Unexpected database access'); } });
  for (const petId of invalid) {
    assert.equal(await computeDogPeriodScore(petId, 'all_time', noIO), null);
    const event = { data: { data: () => ({ petId }) }, params: { walkId: 'invalid-id-event' } };
    await functions.recomputeDogLeaderboards.run(event);
    await functions.recomputeDogLeaderboardsOnDelete.run(event);
  }
});

test('malformed owner reference is excluded while healthy dog scores survive', async () => {
  const now = Timestamp.now();
  await db.doc('pets/id-bad-owner').set({ name: 'Fixture', ownerUid: '__bad_owner__' });
  await db.doc('walks/id-bad-owner').set({ petId: 'id-bad-owner', walkerUid: 'id-good-owner', familyId: null, startedAt: now, durationMin: 10, score: 5, distanceKm: 1 });
  assert.equal(await computeDogPeriodScore('id-bad-owner', 'all_time', db), null);
  await db.doc('users/id-good-owner').set({ displayName: 'Fixture', isGuest: false, leaderboardVisibility: 'public' });
  await db.doc('pets/id-good-dog').set({ name: 'Fixture', ownerUid: 'id-good-owner' });
  await db.doc('walks/id-good-dog').set({ petId: 'id-good-dog', walkerUid: 'id-good-owner', familyId: null, startedAt: now, durationMin: 10, score: 5, distanceKm: 1 });
  assert.equal((await computeDogPeriodScore('id-good-dog', 'all_time', db)).totalScore, 5);
});

test('actual scheduled aggregation still writes healthy dogs beside malformed stored IDs', async () => {
  await db.doc('walks/id-reserved').set({ petId: '__verify_dog_lb_pet__', familyId: null, startedAt: Timestamp.now(), durationMin: 10, score: 5 });
  await db.doc('walks/id-object').set({ petId: { wrong: true }, familyId: null, startedAt: Timestamp.now(), durationMin: 10, score: 5 });
  await functions.aggregateLeaderboards.run({ scheduleTime: new Date().toISOString() });
  assert.equal((await db.doc('dogLeaderboards/all_time/entries/id-good-dog').get()).data().totalScore, 5);
  assert.equal((await db.doc('dogLeaderboards/all_time/entries/id-bad-owner').get()).exists, false);
});
