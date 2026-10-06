const { test, after } = require('node:test');
const assert = require('node:assert/strict');
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
const { db, functions, auth } = require('./emulator.cjs');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const lifecycle = require('../lib/account-lifecycle.js');
const { evaluateAchievements, applyWalkToLifetimeStats } = require('../lib/achievements.js');
const bucket = getStorage().bucket();
const url = (name) => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(name)}?alt=media&token=fixture`;
const save = (name, value = 'photo') => bucket.file(name).save(value, { resumable: false, contentType: 'image/jpeg' });
const exists = async (path) => (await db.doc(path).get()).exists;
const fileExists = async (path) => (await bucket.file(path).exists())[0];
after(() => db.terminate());

test('export includes only own comments and all current personal preference/stat collections', async () => {
  const uid = 'life-export';
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Export' });
  await db.doc('posts/life-export-peer').set({ authorUid: 'peer' });
  await db.doc('posts/life-export-peer/comments/own').set({ authorUid: uid, text: 'mine' });
  await db.doc('posts/life-export-peer/comments/peer').set({ authorUid: 'peer', text: 'private-to-peer' });
  await db.doc('unrelated/a/comments/own').set({ authorUid: uid, text: 'not-a-post-comment' });
  for (const name of ['achievements', 'stats', 'photoDownloadState']) await db.doc(`users/${uid}/${name}/fixture`).set({ value: name });
  const result = await functions.exportUserData.run({ auth: auth(uid), data: {} });
  assert.deepEqual(result.comments, [{ authorUid: uid, text: 'mine', commentId: 'own', postId: 'life-export-peer' }]);
  for (const name of ['achievements', 'stats', 'photoDownloadState']) assert.deepEqual(result[name], [{ id: 'fixture', value: name }]);
});

test('confirmation is required before marker creation; concurrent cascades are serialized and retryable', async () => {
  const uid = 'life-lock';
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Confirm' });
  await assert.rejects(functions.deleteUserAccount.run({ data: {} }), { code: 'unauthenticated' });
  await assert.rejects(lifecycle.beginAccountDeletion(db, uid, undefined), { code: 'invalid-argument' });
  await assert.rejects(lifecycle.beginAccountDeletion(db, uid, 'wrong'), { code: 'failed-precondition' });
  assert.equal(await exists(`deletedAccounts/${uid}`), false);
  const attempts = await Promise.allSettled([lifecycle.beginAccountDeletion(db, uid, 'Confirm'), lifecycle.beginAccountDeletion(db, uid, 'Confirm')]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(attempts.find((r) => r.status === 'rejected').reason.code, 'aborted');
  const lease = attempts.find((r) => r.status === 'fulfilled').value;
  await lifecycle.releaseAccountDeletionLease(db, uid, 'not-this-lease');
  await assert.rejects(lifecycle.beginAccountDeletion(db, uid, 'Confirm'), { code: 'aborted' });
  await lifecycle.releaseAccountDeletionLease(db, uid, lease.leaseId);
  await assert.rejects(lifecycle.beginAccountDeletion(db, uid, 'wrong'), { code: 'failed-precondition' });
  const retry = await lifecycle.beginAccountDeletion(db, uid, 'Confirm');
  assert.equal(retry.state, 'deleting');
  await lifecycle.releaseAccountDeletionLease(db, uid, retry.leaseId);
});

test('account callable deletes owned descendants/orphans/comments/auth but preserves shared and unknown assets', async () => {
  const uid = 'life-delete';
  await getAuth().createUser({ uid, displayName: 'Delete me' });
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Delete me', familyIds: ['not-a-member'] });
  for (const name of ['private', 'achievements', 'stats', 'photoDownloadState', 'legacy']) await db.doc(`users/${uid}/${name}/fixture/nested/child`).set({ uid });
  await db.doc(`users/${uid}/friends/peer-life`).set({ uid: 'peer-life' });
  await db.doc(`users/peer-life/friends/${uid}`).set({ uid });
  await db.doc(`familyJoinAttempts/${uid}`).set({ attempts: [1] });
  await db.doc('pets/life-shared').set({ ownerUid: 'peer-life', familyId: 'life-family', photoURL: url(`users/${uid}/pets/life-shared/avatar.jpg`) });
  await db.doc('pets/life-own').set({ ownerUid: uid, familyId: null });
  await db.doc('pets/life-own/healthRecords/record').set({ value: 'delete' });
  await db.doc('families/life-family').set({ ownerUid: 'peer-life', memberUids: ['peer-life', uid] });
  for (const [name, field] of [['walks', 'walkerUid'], ['reminders', 'createdByUid'], ['expenses', 'payerUid']]) {
    await db.doc(`${name}/life-orphan`).set({ [field]: uid, familyId: null, petId: 'already-gone' });
    await db.doc(`${name}/life-peer`).set({ [field]: 'peer-life', familyId: 'life-family', petId: 'life-shared' });
  }
  await db.doc('posts/life-peer').set({ authorUid: 'peer-life', commentCount: 2 });
  await db.doc('posts/life-peer/comments/own').set({ authorUid: uid });
  await db.doc('posts/life-peer/comments/peer').set({ authorUid: 'peer-life' });
  await db.doc('posts/life-own').set({ authorUid: uid, photoURLs: [url(`users/${uid}/posts/life-own/0.jpg`)] });
  await db.doc('posts/life-own/comments/peer').set({ authorUid: 'peer-life' });
  await db.doc('posts/life-own/reactions/peer').set({ uid: 'peer-life', emoji: '❤️' });
  await db.doc('postInteractionThrottle/life-own').set({ lastAt: 1 });
  const names = [`users/${uid}/pets/life-shared/avatar.jpg`, `users/${uid}/pets/life-own/avatar.jpg`, `users/${uid}/posts/life-own/0.jpg`, `users/${uid}/walks/old-session/photos/0-1.jpg`, `users/${uid}/unknown/future.jpg`, 'users/peer-life/pets/life-shared/avatar.jpg'];
  for (const name of names) await save(name);
  const result = await functions.deleteUserAccount.run({ auth: auth(uid), data: { confirmDisplayName: 'Delete me' } });
  assert.equal(result.summary.commentsHardDeleted, 1);
  assert.equal(result.summary.storagePhotosRetained, 2);
  for (const path of [`users/${uid}`, `familyJoinAttempts/${uid}`, 'pets/life-own', 'pets/life-own/healthRecords/record', 'posts/life-own', 'posts/life-own/comments/peer', 'posts/life-own/reactions/peer', 'postInteractionThrottle/life-own', 'posts/life-peer/comments/own', `users/peer-life/friends/${uid}`]) assert.equal(await exists(path), false, path);
  assert.equal((await db.doc(`users/${uid}`).listCollections()).length, 0);
  for (const name of ['walks', 'reminders', 'expenses']) {
    assert.equal(await exists(`${name}/life-orphan`), false);
    assert.equal(await exists(`${name}/life-peer`), true);
  }
  assert.equal(await exists('pets/life-shared'), true);
  assert.equal(await exists('posts/life-peer/comments/peer'), true);
  assert.deepEqual((await db.doc('families/life-family').get()).data().memberUids, ['peer-life']);
  for (const [i, keep] of [[0, true], [1, false], [2, false], [3, false], [4, true], [5, true]]) assert.equal(await fileExists(names[i]), keep, names[i]);
  await assert.rejects(getAuth().getUser(uid), { code: 'auth/user-not-found' });
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'complete');
  const repeated = await functions.deleteUserAccount.run({ auth: auth(uid), data: { confirmDisplayName: 'Delete me' } });
  assert.deepEqual(repeated, result);
});

test('profileless legacy user can delete with verified Auth name, including explicit empty name', async () => {
  for (const [uid, name] of [['life-no-profile', 'Legacy'], ['life-empty-name', '']]) {
    await getAuth().createUser({ uid, ...(name ? { displayName: name } : {}) });
    await db.doc(`users/${uid}/stats/lifetime`).set({ walkCount: 2 });
    await functions.deleteUserAccount.run({ auth: auth(uid), data: { confirmDisplayName: name } });
    assert.equal(await exists(`users/${uid}/stats/lifetime`), false);
    await assert.rejects(getAuth().getUser(uid), { code: 'auth/user-not-found' });
  }
});

test('auth failure leaves finalizing checkpoint and actual handler completes it after retry', async () => {
  const uid = 'life-finalize';
  await getAuth().createUser({ uid });
  await db.doc(`users/${uid}/private/contact`).set({ email: 'fixture@example.invalid' });
  await db.doc(`deletedAccounts/${uid}`).set({ state: 'finalizing', summary: {} });
  await assert.rejects(lifecycle.finalizeAccountDeletion(db, uid, async () => { throw Object.assign(new Error('temporary'), { code: 'auth/internal-error' }); }), { code: 'auth/internal-error' });
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'finalizing');
  const snap = await db.doc(`deletedAccounts/${uid}`).get();
  const event = { params: { uid }, data: { after: snap } };
  await functions.onAccountDeletionProgress.run(event);
  await functions.onAccountDeletionProgress.run(event);
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'complete');
  assert.equal(await exists(`users/${uid}/private/contact`), false);
  await assert.rejects(getAuth().getUser(uid), { code: 'auth/user-not-found' });
});

test('post delete handler cascades only canonical owned files, retains live references, and is replay safe', async () => {
  const postId = 'life-post-trigger', uid = 'life-post-author';
  const own = `users/${uid}/posts/${postId}/0.jpg`, retained = `users/${uid}/posts/${postId}/1.jpg`, other = 'users/peer/posts/foreign/0.jpg';
  for (const name of [own, retained, other]) await save(name);
  await db.doc(`posts/${postId}`).set({ authorUid: uid, photoURLs: [url(own), url(other)] });
  const snapshot = await db.doc(`posts/${postId}`).get();
  await db.doc('pets/life-reference').set({ ownerUid: 'peer', photoURL: url(retained) });
  await db.doc(`posts/${postId}/comments/a`).set({ authorUid: 'peer' });
  await db.doc(`posts/${postId}/reactions/a`).set({ uid: 'peer' });
  await db.doc(`posts/${postId}`).delete();
  const event = { params: { postId }, data: snapshot };
  await functions.onPostDeletedCleanup.run(event);
  await functions.onPostDeletedCleanup.run(event);
  assert.equal(await fileExists(own), false);
  assert.equal(await fileExists(retained), true);
  assert.equal(await fileExists(other), true);
  assert.equal(await exists(`posts/${postId}/comments/a`), false);
  await db.doc(`posts/${postId}`).set({ authorUid: uid, content: 'new incarnation' });
  await db.doc(`posts/${postId}/comments/new`).set({ authorUid: uid });
  await save(own, 'new generation');
  await functions.onPostDeletedCleanup.run(event);
  assert.equal(await exists(`posts/${postId}/comments/new`), true);
  assert.equal(await fileExists(own), true);
});

test('post cleanup queue survives a child-cleanup failure after the parent was deleted', async () => {
  const uid = 'life-queue', postId = 'life-queue-post';
  await db.doc(`posts/${postId}`).set({ authorUid: uid });
  await db.doc(`posts/${postId}/comments/old`).set({ authorUid: uid });
  await save(`users/${uid}/posts/${postId}/0.jpg`);
  let transactions = 0;
  const interruptedDb = {
    collection: db.collection.bind(db), doc: db.doc.bind(db),
    runTransaction: (...args) => ++transactions === 2 ? Promise.reject(new Error('offline')) : db.runTransaction(...args),
  };
  await assert.rejects(lifecycle.deleteAccountPosts(interruptedDb, bucket, uid), /offline/);
  assert.equal(await exists(`posts/${postId}`), false);
  assert.equal(await exists(`deletedAccounts/${uid}/posts/${postId}`), true);
  assert.equal(await lifecycle.deleteAccountPosts(db, bucket, uid), 1);
  assert.equal(await exists(`deletedAccounts/${uid}/posts/${postId}`), false);
  await lifecycle.deleteUnsharedAccountStorage(db, bucket, uid);
  assert.equal(await fileExists(`users/${uid}/posts/${postId}/0.jpg`), false);
});

test('reaction and review cleanup is concurrent/retry safe and handles orphan parents', async () => {
  const uid = 'life-counts';
  await db.doc('posts/life-counts').set({ authorUid: 'peer', reactionCounts: { '❤️': 2 } });
  await db.doc('posts/life-counts/reactions/own').set({ uid, emoji: '❤️' });
  await db.doc('posts/life-counts/reactions/peer').set({ uid: 'peer', emoji: '❤️' });
  await db.doc('posts/life-missing/reactions/own').set({ uid, emoji: '❤️' });
  const counts = await Promise.all([lifecycle.deleteOwnReactions(db, uid), lifecycle.deleteOwnReactions(db, uid)]);
  assert.equal(counts.reduce((a, b) => a + b), 2);
  assert.deepEqual((await db.doc('posts/life-counts').get()).data().reactionCounts, { '❤️': 1 });
  await db.doc('restaurants/life-rating').set({ averageRating: 3, reviewCount: 2 });
  await db.doc('restaurants/life-rating/reviews/own').set({ authorUid: uid, rating: 1 });
  await db.doc('restaurants/life-rating/reviews/peer').set({ authorUid: 'peer', rating: 5 });
  await db.doc('restaurants/life-gone/reviews/own').set({ authorUid: uid, rating: 2 });
  const reviews = await Promise.all([lifecycle.deleteOwnReviews(db, uid), lifecycle.deleteOwnReviews(db, uid)]);
  assert.equal(reviews.reduce((a, b) => a + b), 2);
  assert.deepEqual((await db.doc('restaurants/life-rating').get()).data(), { averageRating: 5, reviewCount: 1 });
  assert.equal(await lifecycle.deleteOwnReviews(db, uid), 0);
});

test('replayed delete and delayed create handlers derive comment count from surviving comments', async () => {
  const postId = 'life-comments';
  await db.doc(`posts/${postId}`).set({ authorUid: 'peer', commentCount: 10 });
  await db.doc(`posts/${postId}/comments/keep`).set({ authorUid: 'peer' });
  const event = { params: { postId, commentId: 'removed' }, data: { data: () => ({ authorUid: 'peer', text: 'removed' }) } };
  await functions.onCommentDeleted.run(event);
  await functions.onCommentDeleted.run(event);
  await functions.onCommentCreated.run(event); // author self-comment: no push service
  assert.equal((await db.doc(`posts/${postId}`).get()).data().commentCount, 1);
});

test('late achievement/stat events cannot recreate descendants after deletion marker', async () => {
  const uid = 'life-late';
  await db.doc(`deletedAccounts/${uid}`).set({ state: 'complete' });
  await applyWalkToLifetimeStats(db, uid, { distanceKm: 2, durationMin: 10, startedAtMs: Date.now() });
  assert.deepEqual(await evaluateAchievements(db, uid, { walkCount: 10, petCount: 3 }, { isGuest: false }), { newlyGranted: [] });
  assert.equal(await exists(`users/${uid}/stats/lifetime`), false);
  assert.equal((await db.collection(`users/${uid}/achievements`).get()).empty, true);
});

test('account storage retains encoded shared references, nested markdown, and unknown paths', async () => {
  const uid = 'life-retention';
  const names = [`users/${uid}/walks/old-session/photos/shared.jpg`, `users/${uid}/pets/gone/avatar.jpg`, `users/${uid}/unknown/a.jpg`, `users/${uid}/walks/gone/photos/0-1.jpg`];
  for (const name of names) await save(name);
  await db.doc('walks/life-live-different-id').set({ walkerUid: 'peer', photoURLs: [url(names[0])] });
  await db.doc('knowledgeArticles/life-reference').set({ contentMd: { en: `![shared](${url(names[1])})` } });
  assert.deepEqual(await lifecycle.deleteUnsharedAccountStorage(db, bucket, uid), { deleted: 1, retained: 3 });
  for (const name of names.slice(0, 3)) assert.equal(await fileExists(name), true);
  assert.equal(await fileExists(names[3]), false);
});

test('storage failure is not reported as completed; the callable resumes from its checkpoint', async () => {
  const uid = 'life-storage-retry';
  await getAuth().createUser({ uid, displayName: 'Retry' });
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Retry' });
  await db.doc('posts/life-retry-post').set({ authorUid: uid });
  const path = `users/${uid}/posts/life-retry-post/0.jpg`;
  await save(path);
  const proto = Object.getPrototypeOf(bucket), original = proto.getFiles;
  try {
    proto.getFiles = async () => { throw new Error('storage offline'); };
    await assert.rejects(functions.deleteUserAccount.run({ auth: auth(uid), data: { confirmDisplayName: 'Retry' } }), /storage offline/);
  } finally { proto.getFiles = original; }
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'deleting');
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().leaseId, undefined);
  assert.equal(await exists(`users/${uid}`), true);
  assert.equal(await exists('posts/life-retry-post'), false);
  await functions.deleteUserAccount.run({ auth: auth(uid), data: { confirmDisplayName: 'Retry' } });
  assert.equal(await fileExists(path), false);
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'complete');
});

test('fresh storage generation and new parent checks protect interleaved replacements', async () => {
  const uid = 'life-generations', postId = 'life-generation-post', path = `users/${uid}/posts/${postId}/0.jpg`;
  await save(path, 'old');
  const replacingBucket = { getFiles: async (options) => {
    const listing = await bucket.getFiles(options);
    await save(path, 'replacement');
    return listing;
  } };
  const result = await lifecycle.cleanupDeletedPost(db, replacingBucket, postId, uid);
  assert.equal(result.storagePhotosDeleted, 0);
  assert.equal((await bucket.file(path).download())[0].toString(), 'replacement');
  const recreatingBucket = { getFiles: async (options) => {
    const listing = await bucket.getFiles(options);
    await db.doc(`posts/${postId}`).set({ authorUid: uid });
    await db.doc(`posts/${postId}/comments/new`).set({ authorUid: uid });
    return listing;
  } };
  const recreated = await lifecycle.cleanupDeletedPost(db, recreatingBucket, postId, uid);
  assert.equal(recreated.skippedRecreated, true);
  assert.equal(await exists(`posts/${postId}/comments/new`), true);
  assert.equal(await fileExists(path), true);
});

test('lowercase/double-encoded URLs and unknown formats inside known namespaces are retained', async () => {
  const uid = 'life-encoded';
  const names = [`users/${uid}/posts/gone/0.jpg`, `users/${uid}/posts/gone/1.jpg`, `users/${uid}/posts/gone/future/new.jpg`];
  for (const name of names) await save(name);
  await db.doc('pets/life-lowercase').set({ ownerUid: 'peer', photoURL: url(names[0]).replaceAll('%2F', '%2f') });
  await db.doc('pets/life-double').set({ ownerUid: 'peer', photoURL: url(encodeURIComponent(names[1])) });
  assert.deepEqual(await lifecycle.deleteUnsharedAccountStorage(db, bucket, uid), { deleted: 0, retained: 3 });
  for (const name of names) assert.equal(await fileExists(name), true);
});

test('server checkpoint handler resumes the full cascade without client confirmation after failure', async () => {
  const uid = 'life-server-resume';
  await getAuth().createUser({ uid, displayName: 'Resume' });
  await db.doc(`users/${uid}`).set({ uid, displayName: 'Resume' });
  await db.doc('walks/life-resume-walk').set({ walkerUid: uid, familyId: null, petId: 'gone' });
  const lease = await lifecycle.beginAccountDeletion(db, uid, 'Resume');
  const event = { params: { uid } };
  await assert.rejects(functions.onAccountDeletionProgress.run(event), { code: 'aborted' });
  assert.equal(await exists('walks/life-resume-walk'), true);
  await lifecycle.releaseAccountDeletionLease(db, uid, lease.leaseId);
  await functions.onAccountDeletionProgress.run(event);
  await functions.onAccountDeletionProgress.run(event);
  assert.equal(await exists('walks/life-resume-walk'), false);
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().state, 'complete');
  await assert.rejects(getAuth().getUser(uid), { code: 'auth/user-not-found' });
});

test('lease takeover fences old worker finalization and old release cannot unlock the new worker', async () => {
  const uid = 'life-takeover';
  await db.doc(`users/${uid}`).set({ displayName: 'Takeover' });
  const old = await lifecycle.beginAccountDeletion(db, uid, 'Takeover');
  const { Timestamp } = require('firebase-admin/firestore');
  await db.doc(`deletedAccounts/${uid}`).update({ leaseUntil: Timestamp.fromMillis(1) });
  const newLease = await lifecycle.claimAccountDeletion(db, uid);
  await assert.rejects(lifecycle.checkAccountDeletionLease(db, uid, old.leaseId), { code: 'aborted' });
  await assert.rejects(lifecycle.markAccountDeletionFinalizing(db, uid, old.leaseId, { wrong: true }), { code: 'aborted' });
  await lifecycle.releaseAccountDeletionLease(db, uid, old.leaseId);
  assert.equal((await db.doc(`deletedAccounts/${uid}`).get()).data().leaseId, newLease);
  await lifecycle.markAccountDeletionFinalizing(db, uid, newLease, { correct: true });
  assert.deepEqual((await db.doc(`deletedAccounts/${uid}`).get()).data().summary, { correct: true });
});

test('a foreign recreated post leaves cleanup scope without permanently blocking account deletion', async () => {
  const uid = 'life-foreign-recreated', postId = 'life-foreign-recreated-post';
  await db.doc(`deletedAccounts/${uid}/posts/${postId}`).set({ postId, authorUid: uid });
  await db.doc(`posts/${postId}`).set({ authorUid: 'new-owner' });
  await db.doc(`posts/${postId}/comments/new`).set({ authorUid: 'new-owner' });
  const path = `users/${uid}/posts/${postId}/0.jpg`;
  await save(path, 'shared or ambiguous');
  assert.equal(await lifecycle.deleteAccountPosts(db, bucket, uid), 0);
  assert.equal(await exists(`deletedAccounts/${uid}/posts/${postId}`), false);
  assert.equal(await exists(`posts/${postId}/comments/new`), true);
  assert.deepEqual(await lifecycle.deleteUnsharedAccountStorage(db, bucket, uid), { deleted: 0, retained: 1 });
  assert.equal(await fileExists(path), true);
});

test('account storage excludes only its deleting public profile from the live-reference scan', async () => {
  const uid = 'life-own-profile', own = `users/${uid}/pets/old/avatar.jpg`;
  const shared = `users/${uid}/pets/shared/avatar.jpg`;
  await save(own); await save(shared);
  await db.doc(`users/${uid}`).set({ photoURL: url(own) });
  await db.doc('users/life-still-live').set({ photoURL: url(shared) });
  assert.deepEqual(await lifecycle.deleteUnsharedAccountStorage(db, bucket, uid), { deleted: 1, retained: 1 });
  assert.equal(await fileExists(own), false);
  assert.equal(await fileExists(shared), true);
});

test('post enqueue checks lease inside its mutation transaction after an outside-check race', async () => {
  const uid = 'life-enqueue-fence', postId = 'life-enqueue-fence-post';
  await db.doc(`users/${uid}`).set({ displayName: 'Fence' });
  const lease = await lifecycle.beginAccountDeletion(db, uid, 'Fence');
  await db.doc(`posts/${postId}`).set({ authorUid: uid });
  let interleaved = false;
  const racedDb = {
    collection: db.collection.bind(db), doc: db.doc.bind(db),
    runTransaction: async (...args) => {
      if (!interleaved) {
        interleaved = true;
        // The old worker passed its non-transaction check; a successor has
        // now completed before this delayed enqueue transaction starts.
        await db.doc(`deletedAccounts/${uid}`).update({ state: 'complete', leaseId: 'successor' });
      }
      return db.runTransaction(...args);
    },
  };
  const checkLease = (tx) => lifecycle.checkAccountDeletionLease(db, uid, lease.leaseId, tx);
  await assert.rejects(lifecycle.deleteAccountPosts(racedDb, bucket, uid, checkLease), { code: 'aborted' });
  assert.equal(interleaved, true);
  assert.equal(await exists(`posts/${postId}`), true);
  assert.equal(await exists(`deletedAccounts/${uid}/posts/${postId}`), false);
});

test('post child cleanup and queue completion reject lease takeover in their own transactions', async () => {
  for (const [suffix, raceTransaction] of [['child', 1], ['queue', 4], ['foreign', 2]]) {
    const uid = `life-queue-fence-${suffix}`, postId = `${uid}-post`;
    await db.doc(`users/${uid}`).set({ displayName: 'Fence' });
    const lease = await lifecycle.beginAccountDeletion(db, uid, 'Fence');
    await db.doc(`deletedAccounts/${uid}/posts/${postId}`).set({ authorUid: uid, postId });
    await db.doc(`posts/${postId}/comments/old`).set({ authorUid: uid });
    if (suffix === 'foreign') await db.doc(`posts/${postId}`).set({ authorUid: 'peer' });
    let transactions = 0;
    const racedDb = {
      collection: db.collection.bind(db), doc: db.doc.bind(db),
      runTransaction: async (...args) => {
        if (++transactions === raceTransaction) {
          await db.doc(`deletedAccounts/${uid}`).update({ leaseId: 'successor' });
        }
        return db.runTransaction(...args);
      },
    };
    const checkLease = (tx) => lifecycle.checkAccountDeletionLease(db, uid, lease.leaseId, tx);
    await assert.rejects(lifecycle.deleteAccountPosts(racedDb, bucket, uid, checkLease), { code: 'aborted' });
    assert.equal(transactions, raceTransaction);
    assert.equal(await exists(`deletedAccounts/${uid}/posts/${postId}`), true);
    assert.equal(await exists(`posts/${postId}/comments/old`), suffix !== 'queue');
  }
});
