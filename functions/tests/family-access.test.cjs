const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, Timestamp, functions, auth } = require('./emulator.cjs');
const { leaveMemberFamilies } = require('../lib/family-access.js');
after(() => db.terminate());

test('export callable rejects forged public/private family caches and strips capabilities', async () => {
  const uid = 'export-attacker';
  await db.doc('families/export-victim').set({
    name: 'Victim', ownerUid: 'victim', memberUids: ['victim'], inviteCode: '918273',
  });
  await db.doc('families/export-victim/migrations/audit').set({ secret: 'audit' });
  await db.doc('families/export-real').set({
    name: 'Real', ownerUid: 'peer', memberUids: ['peer', uid], inviteCode: '817263',
    createdAt: Timestamp.now(), futureSecret: 'do-not-export',
  });
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Keep me', familyIds: ['export-victim'] });
  await db.doc(`users/${uid}/private/contact`).set({
    email: 'test@example.invalid', fcmTokens: ['test-token'],
    familyIds: ['export-victim', 'export-victim/migrations/audit'],
    uid: 'victim', displayName: 'Injected', currentFamilyId: 'export-victim',
  });
  const result = await functions.exportUserData.run({ auth: auth(uid), data: {} });
  assert.deepEqual(result.families.map((f) => f.familyId), ['export-real']);
  assert.deepEqual(Object.keys(result.families[0]).sort(),
    ['familyId', 'name', 'ownerUid', 'memberUids', 'createdAt'].sort());
  assert.equal(result.user.uid, uid);
  assert.equal(result.user.displayName, 'Keep me');
  assert.equal(result.user.currentFamilyId, undefined);
  assert.equal(result.user.email, 'test@example.invalid');
  assert.deepEqual(result.user.fcmTokens, ['test-token']);
  assert.deepEqual(result.user.familyIds, ['export-real']);
  assert.ok(!JSON.stringify(result).includes('918273'));
  assert.ok(!JSON.stringify(result).includes('817263'));
  for (const invalid of [42, { nested: 'export-victim' }, ['export-victim/migrations/audit']]) {
    await db.doc(`users/${uid}`).update({ familyIds: invalid });
    await db.doc(`users/${uid}/private/contact`).update({ familyIds: invalid });
    const again = await functions.exportUserData.run({ auth: auth(uid), data: {} });
    assert.deepEqual(again.families.map((f) => f.familyId), ['export-real']);
  }
});

test('export requires authentication and an existing profile', async () => {
  await assert.rejects(functions.exportUserData.run({ data: {} }), { code: 'unauthenticated' });
  await assert.rejects(functions.exportUserData.run({ auth: auth('export-missing'), data: {} }), { code: 'not-found' });
});

test('account cleanup uses actual membership, preserves victim and nested documents', async () => {
  const uid = 'cleanup-owner';
  await db.doc(`users/${uid}`).set({ familyIds: ['cleanup-victim', 'cleanup-victim/migrations/audit'] });
  await db.doc('families/cleanup-victim').set({ ownerUid: 'victim', memberUids: ['victim'] });
  await db.doc('families/cleanup-victim/migrations/audit').set({ marker: true });
  await db.doc('families/cleanup-alone').set({ ownerUid: uid, memberUids: [uid] });
  await db.doc('families/cleanup-shared').set({ ownerUid: uid, memberUids: [uid, 'peer'] });
  await db.doc('families/cleanup-member').set({ ownerUid: 'peer', memberUids: ['peer', uid] });
  assert.deepEqual(await leaveMemberFamilies(db, uid), { familiesDissolved: 1, familiesLeft: 2 });
  assert.ok((await db.doc('families/cleanup-victim').get()).exists);
  assert.ok((await db.doc('families/cleanup-victim/migrations/audit').get()).exists);
  assert.ok(!(await db.doc('families/cleanup-alone').get()).exists);
  for (const id of ['cleanup-shared', 'cleanup-member']) {
    assert.deepEqual((await db.doc(`families/${id}`).get()).data(), { ownerUid: 'peer', memberUids: ['peer'] });
  }
  assert.deepEqual(await leaveMemberFamilies(db, uid), { familiesDissolved: 0, familiesLeft: 0 });
});

test('cleanup rechecks membership, ownership and deletion after its initial query', async () => {
  const uid = 'cleanup-race';
  for (const id of ['revoked', 'transferred', 'deleted']) {
    await db.doc(`families/cleanup-race-${id}`).set({ ownerUid: uid, memberUids: [uid, 'peer', 'new-owner'] });
  }
  // Return the actual emulator snapshot, but apply competing writes before
  // cleanup's transactions start. The implementation must re-read each family.
  const interleavedDb = {
    collection: (path) => ({ where: (...args) => ({ get: async () => {
      const snapshot = await db.collection(path).where(...args).get();
      await db.doc('families/cleanup-race-revoked').update({ ownerUid: 'peer', memberUids: ['peer'] });
      await db.doc('families/cleanup-race-transferred').update({ ownerUid: 'new-owner' });
      await db.doc('families/cleanup-race-deleted').delete();
      return snapshot;
    } }) }),
    runTransaction: db.runTransaction.bind(db),
  };
  assert.deepEqual(await leaveMemberFamilies(interleavedDb, uid), { familiesDissolved: 0, familiesLeft: 1 });
  assert.deepEqual((await db.doc('families/cleanup-race-revoked').get()).data(), { ownerUid: 'peer', memberUids: ['peer'] });
  assert.deepEqual((await db.doc('families/cleanup-race-transferred').get()).data(), {
    ownerUid: 'new-owner', memberUids: ['peer', 'new-owner'],
  });
  assert.equal((await db.doc('families/cleanup-race-deleted').get()).exists, false);
});

test('export preserves normal pet health/walk data while filtering malformed private contact', async () => {
  const uid = 'export-normal';
  await db.doc(`users/${uid}`).set({ uid, email: 'legacy@example.invalid', displayName: 'Normal' });
  await db.doc(`users/${uid}/private/contact`).set({ email: { bad: true }, fcmTokens: ['valid', 42, null], admin: true });
  await db.doc('pets/export-pet').set({ name: 'Mango', ownerUid: uid, familyId: null });
  await db.doc('pets/export-pet/healthRecords/export-weight').set({ type: 'weight', data: { kg: 5 } });
  await db.doc('walks/export-walk').set({ walkerUid: uid, petId: 'export-pet', distanceKm: 1.25 });
  const result = await functions.exportUserData.run({ auth: auth(uid), data: {} });
  assert.equal(result.user.email, 'legacy@example.invalid');
  assert.deepEqual(result.user.fcmTokens, ['valid']);
  assert.equal(result.user.admin, undefined);
  assert.equal(result.pets[0].name, 'Mango');
  assert.equal(result.pets[0].healthRecords[0].data.kg, 5);
  assert.equal(result.pets[0].walks[0].distanceKm, 1.25);
  assert.deepEqual(result.walks, []); // pet walks must not be exported twice
});
