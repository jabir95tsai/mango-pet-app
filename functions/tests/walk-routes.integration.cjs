const { test, after } = require('node:test');
const assert = require('node:assert/strict');
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
const { db, functions, auth } = require('./emulator.cjs');
const { getAuth } = require('firebase-admin/auth');
after(() => db.terminate());

test('real account deletion resumes failed route cleanup and erases unfinalized coordinates', async () => {
  const uid = 'route-account-delete';
  const sessionId = 'route-account-session';
  await getAuth().createUser({ uid, displayName: 'Route deletion' });
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Route deletion' });
  await db.doc('pets/route-account-pet').set({ ownerUid: uid, familyId: null, name: 'Mango' });
  const startedAtMs = Date.now() - 1000;
  await functions.manageWalkRoute.run({ auth: auth(uid), data: { op: 'start', sessionId, petId: 'route-account-pet', familyId: null, startedAtMs, shareLive: false } });
  await functions.manageWalkRoute.run({ auth: auth(uid), data: { op: 'append', sessionId, chunkIndex: 0, points: [{ lat: 25, lng: 121, t: startedAtMs, segment: 0 }] } });
  const remove = () => functions.deleteUserAccount.run({ auth: auth(uid), data: { confirmDisplayName: 'Route deletion' } });
  const realDelete = db.recursiveDelete;
  db.recursiveDelete = function (ref, ...args) {
    if (ref.path === `walkRouteSessions/${sessionId}/chunks`) throw new Error('route cleanup temporarily unavailable');
    return realDelete.call(this, ref, ...args);
  };
  try { await assert.rejects(remove(), /route cleanup temporarily unavailable/); }
  finally { db.recursiveDelete = realDelete; }
  assert.equal((await db.doc(`walkRouteSessions/${sessionId}`).get()).data().status, 'deleted');
  assert.equal((await db.collection(`walkRouteSessions/${sessionId}/chunks`).get()).size, 1);
  await remove();
  assert.equal((await db.collection(`walkRouteSessions/${sessionId}/chunks`).get()).size, 0);
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'complete');
  await assert.rejects(getAuth().getUser(uid), { code: 'auth/user-not-found' });
});
