const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { db, functions, auth, Timestamp } = require('./emulator.cjs');
const { joinSelectedFamily } = require('../lib/family-join.js');
const { createMutualFriendship } = require('../lib/friendship-helpers.js');
const { withActiveAccounts } = require('../lib/account-mutation.js');
const prefix = 'mutation-' + randomUUID();
const uid = name => prefix + '-' + name;
const user = name => db.doc('users/' + uid(name));
const marker = name => db.doc('deletedAccounts/' + uid(name));
const family = name => db.doc('families/' + uid(name));
const call = (name, account, data = {}) => functions[name].run({ auth: auth(uid(account)), data });
const denied = operation => assert.rejects(operation, { code: 'failed-precondition' });
const profile = name => user(name).set({ uid: uid(name), displayName: name, familyIds: [] });
const seedFamily = (name, members) => family(name).set({ ownerUid: uid(members[0]), memberUids: members.map(uid), inviteCode: '819600' });
after(() => db.terminate());

test('every deletion checkpoint state blocks createFamily without recreating a missing profile', async () => {
  for (const state of ['deleting', 'finalizing', 'complete']) {
    const name = 'missing-' + state;
    await marker(name).set({ state });
    await denied(call('createFamily', name));
    assert.equal((await user(name).get()).exists, false);
    assert.equal((await db.collection('families').where('ownerUid', '==', uid(name)).get()).size, 0);
  }
});

test('native first login can still createFamily when its profile is missing but no checkpoint exists', async () => {
  const result = await call('createFamily', 'native-first', { name: 'New family' });
  assert.deepEqual((await user('native-first').get()).data().familyIds, [result.familyId]);
  assert.deepEqual((await db.doc('families/' + result.familyId).get()).data().memberUids, [uid('native-first')]);
});

test('join checks the checkpoint again after selecting a family; frozen callers cannot consume new quota', async () => {
  await seedFamily('selected', ['owner']);
  const selected = await family('selected').get();
  await marker('join-late').set({ state: 'complete' });
  await denied(joinSelectedFamily(db, selected.ref, uid('join-late'), '819600'));
  await denied(call('joinFamilyByCode', 'join-late', { inviteCode: '819600' }));
  assert.equal((await user('join-late').get()).exists, false);
  assert.equal((await db.doc('familyJoinAttempts/' + uid('join-late')).get()).exists, false);
  assert.deepEqual((await selected.ref.get()).data().memberUids, [uid('owner')]);
});

test('acceptFriendRequest guards both users and keeps the request intact on rejection', async () => {
  for (const blocked of ['receiver', 'sender']) {
    const a = blocked + '-a', b = blocked + '-b';
    await profile(a); await profile(b);
    const request = user(a).collection('friendRequests').doc(uid(b));
    await request.set({ fromUid: uid(b) });
    await marker(blocked === 'receiver' ? a : b).set({ state: 'deleting' });
    await denied(call('acceptFriendRequest', a, { fromUid: uid(b) }));
    assert.equal((await request.get()).exists, true);
    assert.equal((await user(a).collection('friends').doc(uid(b)).get()).exists, false);
    assert.equal((await user(b).collection('friends').doc(uid(a)).get()).exists, false);
  }
});

test('active friend accept/remove still write both directions atomically', async () => {
  await profile('friend-a'); await profile('friend-b');
  const request = user('friend-a').collection('friendRequests').doc(uid('friend-b'));
  await request.set({ fromUid: uid('friend-b') });
  await call('acceptFriendRequest', 'friend-a', { fromUid: uid('friend-b') });
  assert.equal((await request.get()).exists, false);
  assert.equal((await user('friend-b').collection('friends').doc(uid('friend-a')).get()).exists, true);
  await marker('friend-b').set({ state: 'deleting' });
  await denied(call('removeFriend', 'friend-a', { friendUid: uid('friend-b') }));
  assert.equal((await user('friend-a').collection('friends').doc(uid('friend-b')).get()).exists, true);
  await marker('friend-b').delete();
  await call('removeFriend', 'friend-a', { friendUid: uid('friend-b') });
  assert.equal((await user('friend-a').collection('friends').doc(uid('friend-b')).get()).exists, false);
  assert.equal((await user('friend-b').collection('friends').doc(uid('friend-a')).get()).exists, false);
});

test('all remaining normal mutation callables reject a frozen caller, including empty imports and dry-run audit writes', async () => {
  await profile('frozen'); await seedFamily('frozen-family', ['frozen', 'other']);
  await user('frozen').update({ familyIds: [uid('frozen-family')] });
  await marker('frozen').set({ state: 'deleting' });
  for (const [name, data] of [
    ['leaveFamily', { familyId: uid('frozen-family') }],
    ['regenerateInviteCode', { familyId: uid('frozen-family') }],
    ['removeFamilyMember', { familyId: uid('frozen-family'), memberUid: uid('other') }],
    ['importPersonalToFamily', { familyId: uid('frozen-family') }],
    ['mergeAndImportToFamily', { familyId: uid('frozen-family'), merges: [] }],
    ['purgeMyOrphanWalks', { dryRun: true }],
    ['sendTestPush', {}],
  ]) await denied(call(name, 'frozen', data));
  assert.deepEqual((await family('frozen-family').get()).data().memberUids, [uid('frozen'), uid('other')]);
  assert.equal((await family('frozen-family').collection('migrations').get()).size, 0);
});

test('family edits preserve normal behavior and refuse mutations targeting a deleting member', async () => {
  for (const name of ['edit-owner', 'edit-peer']) await profile(name);
  await seedFamily('edit-family', ['edit-owner', 'edit-peer']);
  for (const name of ['edit-owner', 'edit-peer']) await user(name).update({ familyIds: [uid('edit-family')], currentFamilyId: uid('edit-family') });
  await marker('edit-peer').set({ state: 'deleting' });
  await denied(call('removeFamilyMember', 'edit-owner', { familyId: uid('edit-family'), memberUid: uid('edit-peer') }));
  await denied(call('leaveFamily', 'edit-owner', { familyId: uid('edit-family') }));
  await marker('edit-peer').delete();
  const rotated = await call('regenerateInviteCode', 'edit-owner', { familyId: uid('edit-family') });
  assert.match(rotated.inviteCode, /^\d{6}$/);
  await call('leaveFamily', 'edit-owner', { familyId: uid('edit-family') });
  assert.equal((await family('edit-family').get()).data().ownerUid, uid('edit-peer'));
  assert.equal((await user('edit-owner').get()).data().currentFamilyId, undefined);
  await call('removeFamilyMember', 'edit-peer', { familyId: uid('edit-family'), memberUid: uid('edit-peer') });
  assert.deepEqual((await family('edit-family').get()).data().memberUids, []);
});

// Inject deletion AFTER an actual SDK transaction commits, not before the
// callable starts. This deterministically covers the otherwise timing-sensitive
// gap between a multi-batch operation's first and subsequent guarded writes.
async function deleteAfterFirstTransaction(name, operation) {
  const original = db.runTransaction;
  let completed = 0;
  db.runTransaction = async function (...args) {
    const result = await original.apply(this, args);
    if (++completed === 1) await marker(name).set({ state: 'deleting' });
    return result;
  };
  try { return await operation(); } finally { db.runTransaction = original; }
}

test('sendTestPush rechecks after token lookup when deletion begins after its entry check', async () => {
  await profile('push-late');
  await user('push-late').collection('private').doc('contact').set({ fcmTokens: ['local-fake-token'] });
  const messaging = require('firebase-admin/messaging').getMessaging();
  const original = messaging.sendEachForMulticast;
  let sent = 0;
  messaging.sendEachForMulticast = async () => { sent++; return { successCount: 1, failureCount: 0, responses: [] }; };
  try {
    await denied(deleteAfterFirstTransaction('push-late', () => call('sendTestPush', 'push-late')));
    assert.equal(sent, 0);
  } finally { messaging.sendEachForMulticast = original; }
});

test('import rechecks the checkpoint between 400-document chunks and does not write a late audit', async () => {
  await profile('bulk'); await seedFamily('bulk-family', ['bulk']);
  const batch = db.batch();
  for (let i = 0; i < 401; i++) batch.set(db.doc('pets/' + uid('bulk-' + i)), { ownerUid: uid('bulk'), familyId: null });
  await batch.commit();
  await denied(deleteAfterFirstTransaction('bulk', () => call('importPersonalToFamily', 'bulk', { familyId: uid('bulk-family'), types: ['pets'] })));
  const pets = await db.collection('pets').where('ownerUid', '==', uid('bulk')).get();
  assert.equal(pets.docs.filter(d => d.data().familyId === uid('bulk-family')).length, 400);
  assert.equal(pets.docs.filter(d => d.data().familyId === null).length, 1);
  assert.equal((await family('bulk-family').collection('migrations').get()).size, 0);
});

async function seedMerge(name) {
  await profile(name); await profile(name + '-owner');
  await seedFamily(name + '-family', [name + '-owner', name]);
  const source = db.doc('pets/' + uid(name + '-source')), destination = db.doc('pets/' + uid(name + '-destination'));
  await source.set({ ownerUid: uid(name), familyId: null });
  await destination.set({ ownerUid: uid(name + '-owner'), familyId: uid(name + '-family') });
  await source.collection('healthRecords').doc('health').set({ petId: source.id, recordedByUid: uid(name), notes: 'kept' });
  await db.doc('walks/' + uid(name + '-walk')).set({ walkerUid: uid(name), petId: source.id, familyId: null, startedAt: Timestamp.now() });
  const data = { familyId: uid(name + '-family'), merges: [{ personalPetId: source.id, familyPetId: destination.id }] };
  return { source, destination, data };
}

test('merge refuses a deleting destination owner and preserves both pets and source records', async () => {
  const { source, destination, data } = await seedMerge('merge-target');
  await marker('merge-target-owner').set({ state: 'deleting' });
  await denied(call('mergeAndImportToFamily', 'merge-target', data));
  assert.equal((await source.get()).exists, true);
  assert.equal((await source.collection('healthRecords').get()).size, 1);
  assert.equal((await destination.collection('healthRecords').get()).size, 0);
});

test('merge cannot continue after a deletion fence appears between health-record move and walk reassignment', async () => {
  const { source, destination, data } = await seedMerge('merge-late');
  await denied(deleteAfterFirstTransaction('merge-late', () => call('mergeAndImportToFamily', 'merge-late', data)));
  assert.equal((await source.get()).exists, true);
  assert.equal((await destination.collection('healthRecords').get()).size, 1); // committed before the fence
  assert.equal((await db.doc('walks/' + uid('merge-late-walk')).get()).data().familyId, null);
});

test('active merge and import retain records and their API result', async () => {
  const { source, destination, data } = await seedMerge('merge-ok');
  const result = await call('mergeAndImportToFamily', 'merge-ok', data);
  assert.equal(result.mergedPets[0].movedHealthRecords, 1);
  assert.equal(result.mergedPets[0].reassignedWalks, 1);
  assert.equal((await source.get()).exists, false);
  assert.equal((await destination.collection('healthRecords').doc('health').get()).data().notes, 'kept');
  assert.equal((await db.doc('walks/' + uid('merge-ok-walk')).get()).data().petId, destination.id);
  assert.equal((await family('merge-ok-family').collection('migrations').get()).size, 1);
});

test('late auto-friend events do not recreate children for deleting/missing users or removed family members', async () => {
  await profile('auto-a'); await profile('auto-b'); await seedFamily('auto-family', ['auto-a', 'auto-b']);
  await marker('auto-b').set({ state: 'complete' });
  assert.equal((await createMutualFriendship(uid('auto-a'), uid('auto-b'), db, uid('auto-family'))).reason, 'deleting');
  await functions.autoFriendFamilyMembers.run({ params: { familyId: uid('auto-family') }, data: {
    before: { data: () => ({ memberUids: [uid('auto-a')] }) },
    after: { data: () => ({ memberUids: [uid('auto-a'), uid('auto-b')] }) },
  } });
  assert.equal((await user('auto-b').collection('friends').get()).size, 0);
  await marker('auto-b').delete(); await user('auto-b').delete();
  assert.equal((await createMutualFriendship(uid('auto-a'), uid('auto-b'), db, uid('auto-family'))).reason, 'missing-profile');
  await profile('auto-b'); await family('auto-family').update({ memberUids: [uid('auto-a')] });
  assert.equal((await createMutualFriendship(uid('auto-a'), uid('auto-b'), db, uid('auto-family'))).reason, 'membership-changed');
  assert.equal((await user('auto-b').collection('friends').get()).size, 0);
  await family('auto-family').update({ memberUids: [uid('auto-a'), uid('auto-b')] });
  const results = await Promise.all([1, 2].map(() => createMutualFriendship(uid('auto-a'), uid('auto-b'), db, uid('auto-family'))));
  assert.equal(results.filter(result => result.created).length, 1);
  assert.equal(results.filter(result => result.reason === 'exists').length, 1);
});

test('deletion and a write already in a transaction serialize at the same checkpoint fence', async () => {
  let reached;
  const ready = new Promise(resolve => { reached = resolve; });
  let continueWrite;
  const release = new Promise(resolve => { continueWrite = resolve; });
  const write = withActiveAccounts(db, [uid('serial')], async tx => {
    reached(); await release;
    tx.set(user('serial'), { uid: uid('serial') });
  });
  await ready;
  const deletion = marker('serial').set({ state: 'deleting' });
  continueWrite();
  await Promise.all([write.catch(error => { assert.equal(error.code, 'failed-precondition'); }), deletion]);
  // Either the write precedes the fence (and is visible to the cascade), or
  // transaction retry sees the fence and rejects. No later write can succeed.
  await denied(withActiveAccounts(db, [uid('serial')], async tx => { tx.set(user('serial'), { forbidden: true }); }));
  assert.notEqual((await user('serial').get()).data()?.forbidden, true);
});
