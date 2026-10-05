const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { db, functions, Timestamp } = require('./emulator.cjs');
const { actOnReport } = require('../lib/moderation-helpers.js');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp, terminate, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');

const prefix = 'mod-' + randomUUID();
let sequence = 0;
const id = (suffix) => prefix + '-' + suffix;
const report = (targetId, reporterUid = id('reporter-a'), extra = {}) => ({
  reporterUid, targetType: 'post', targetId, targetAuthorUid: id('author'),
  reason: 'spam', status: 'open', ...extra,
});
const post = (suffix, extra = {}) => {
  const ref = db.doc('posts/' + id(suffix));
  return ref.set({ authorUid: id('author'), visibility: 'public', ...extra }).then(() => ref);
};
const submit = async (data, reportId = id('report-' + sequence++)) => {
  await db.doc('reports/' + reportId).set({ ...data, createdAt: Timestamp.now() });
  return actOnReport(db, reportId, data);
};
const count = async (ref) => (await ref.get()).data();
const hash = (parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
after(() => db.terminate());

test('one reporter using new auto IDs and different reasons counts once; three distinct reporters hide', async () => {
  const target = await post('same-person');
  const data = report(target.id);
  for (const reason of ['spam', 'harassment', 'other']) await submit({ ...data, reason });
  assert.equal((await count(target)).reportCount, 1);
  assert.equal((await count(target)).hidden, undefined);
  await submit(report(target.id, id('reporter-b')));
  assert.equal((await count(target)).reportCount, 2);
  const result = await submit(report(target.id, id('reporter-c')));
  assert.equal(result.action, 'hidden');
  assert.equal((await count(target)).reportCount, 3);
  assert.equal((await count(target)).hidden, true);
  const raw = await db.collection('reports').where('targetId', '==', target.id).get();
  const audits = await db.collection('moderationAudit').where('targetId', '==', target.id).get();
  assert.equal(raw.size, 5);
  assert.equal(audits.size, 5);
  assert.equal(audits.docs.filter((d) => d.data().outcome === 'duplicate').length, 2);
});

test('same report concurrent delivery and later replay mutate count and audit only once', async () => {
  const target = await post('replay');
  const data = report(target.id);
  const reportId = id('replayed');
  await db.doc('reports/' + reportId).set({ ...data, createdAt: Timestamp.now() });
  const results = await Promise.all(Array.from({ length: 5 }, () => actOnReport(db, reportId, data)));
  assert.equal(results.filter((r) => r.outcome === 'counted').length, 1);
  assert.equal((await count(target)).reportCount, 1);
  const auditRef = db.doc('moderationAudit/' + reportId);
  const before = (await auditRef.get()).data();
  await functions.onReportCreated.run({ params: { reportId }, data: { data: () => data } });
  assert.deepEqual((await auditRef.get()).data(), before);
  assert.equal((await count(target)).reportCount, 1);
});

test('concurrent new reports from the same reporter and different reporters stay unique', async () => {
  const target = await post('concurrent');
  const reporters = [id('ca'), id('ca'), id('cb'), id('cb'), id('cc'), id('cc')];
  const results = await Promise.all(reporters.map((uid) => submit(report(target.id, uid))));
  assert.equal(results.filter((r) => r.outcome === 'counted').length, 3);
  assert.equal((await count(target)).reportCount, 3);
  assert.equal((await count(target)).hidden, true);
});

test('different target type and comment parent paths do not share a dedupe key', async () => {
  const a = await post('parent-a');
  const b = await post('parent-b');
  const commentId = id('comment-shared-id');
  const refs = [a.collection('comments').doc(commentId), b.collection('comments').doc(commentId)];
  for (const ref of refs) await ref.set({ authorUid: id('commenter'), text: 'test' });
  for (const ref of refs) {
    const data = report(commentId, id('same-reporter'), {
      targetType: 'comment', postId: ref.parent.parent.id, targetAuthorUid: id('commenter'),
    });
    await submit(data); await submit(data);
    assert.equal((await count(ref)).reportCount, 1);
  }
  const otherPost = db.doc('posts/' + commentId);
  await otherPost.set({ authorUid: id('author'), visibility: 'public' });
  await submit(report(commentId, id('same-reporter')));
  assert.equal((await count(otherPost)).reportCount, 1);
});

test('a recreated target cannot evade an existing threshold when the same reporter reports again', async () => {
  const target = await post('recreated');
  const reporters = [id('recreated-a'), id('recreated-b'), id('recreated-c')];
  for (const uid of reporters) await submit(report(target.id, uid));
  assert.equal((await count(target)).hidden, true);
  await target.delete();
  await target.set({ authorUid: id('author'), visibility: 'public', text: 'recreated' });
  assert.equal((await submit(report(target.id, reporters[0]))).outcome, 'duplicate');
  assert.equal((await count(target)).reportCount, 3);
  assert.equal((await count(target)).hidden, true);
});

test('deleted targets, missing parent, forged author, unreadable content and malformed paths never count', async () => {
  const publicPost = await post('validation');
  const privatePost = await post('private', { visibility: 'private' });
  const orphan = db.doc('posts/' + id('missing-parent') + '/comments/' + id('orphan-comment'));
  await orphan.set({ authorUid: id('commenter') });
  const cases = [
    report(id('missing-post')),
    report(publicPost.id, undefined, { targetAuthorUid: id('wrong-author') }),
    report(privatePost.id),
    report(orphan.id, undefined, { targetType: 'comment', postId: orphan.parent.parent.id, targetAuthorUid: id('commenter') }),
    report(publicPost.id + '/comments/' + orphan.id),
    report(publicPost.id, undefined, { targetType: 'comment', postId: '../bad' }),
    report(publicPost.id, undefined, { reporterUid: {} }),
    report(publicPost.id, undefined, { reason: 'x'.repeat(2000) }),
    report('__reserved__'),
  ];
  for (const data of cases) assert.equal((await submit(data)).outcome, 'ignored');
  for (const ref of [publicPost, privatePost, orphan]) assert.equal((await count(ref)).reportCount, undefined);
  assert.equal((await db.collection('moderationVotes').where('targetPath', '==', publicPost.path).get()).empty, true);
});

test('friends visibility uses the author-owned relationship and accepts author reports', async () => {
  const target = await post('friends', { visibility: 'friends' });
  const uid = id('friend');
  assert.equal((await submit(report(target.id, uid))).outcome, 'ignored');
  await db.doc('users/' + id('author') + '/friends/' + uid).set({ uid });
  assert.equal((await submit(report(target.id, uid))).outcome, 'counted');
  assert.equal((await submit(report(target.id, id('author')))).outcome, 'counted');
  assert.equal((await count(target)).reportCount, 2);
});

test('legacy repeated audits are deduped on first touch; old report replay and later old reporter do not add votes', async () => {
  const target = await post('legacy', { reportCount: 2 });
  const first = id('legacy-a');
  const second = id('legacy-b');
  const legacyIds = [id('legacy-old1'), id('legacy-old2')];
  for (let i = 0; i < legacyIds.length; i++) {
    await db.doc('moderationAudit/' + legacyIds[i]).set({
      ...report(target.id, first), action: 'logged', reportCount: i + 1, createdAt: Timestamp.now(),
    });
  }
  const original = (await db.doc('moderationAudit/' + legacyIds[0]).get()).data();
  assert.equal((await submit(report(target.id, first))).outcome, 'duplicate');
  assert.equal((await count(target)).reportCount, 1);
  await submit(report(target.id, second));
  assert.equal((await count(target)).reportCount, 2);
  assert.equal((await count(target)).hidden, undefined);
  await actOnReport(db, legacyIds[0], report(target.id, first));
  assert.deepEqual((await db.doc('moderationAudit/' + legacyIds[0]).get()).data(), original);
  assert.equal((await count(target)).reportCount, 2);
  await submit(report(target.id, first));
  assert.equal((await count(target)).reportCount, 2);
  await submit(report(target.id, id('legacy-c')));
  assert.equal((await count(target)).reportCount, 3);
  assert.equal((await count(target)).hidden, true);
});

test('legacy reporter not yet in ledger remains deduped after another reporter initializes target', async () => {
  const target = await post('legacy-unseeded', { reportCount: 2 });
  for (const uid of [id('unseeded-a'), id('unseeded-b')]) {
    await db.doc('moderationAudit/' + uid).set({ ...report(target.id, uid), action: 'logged', reportCount: 1 });
  }
  await submit(report(target.id, id('new-reporter')));
  assert.equal((await count(target)).reportCount, 3);
  assert.equal((await submit(report(target.id, id('unseeded-b')))).outcome, 'duplicate');
  assert.equal((await count(target)).reportCount, 3);
});

test('legacy hidden state is preserved; unaudited inflated counters are not trusted', async () => {
  const target = await post('legacy-hidden', { reportCount: 99, hidden: true });
  await submit(report(target.id));
  assert.equal((await count(target)).reportCount, 1);
  assert.equal((await count(target)).hidden, true);
});

test('user reports stay audit-only and duplicates do not change profile', async () => {
  const user = db.doc('users/' + id('reported-user'));
  const original = { uid: user.id, displayName: 'test' };
  await user.set(original);
  const data = report(user.id, id('user-reporter'), { targetType: 'user', targetAuthorUid: user.id });
  assert.equal((await submit(data)).outcome, 'logged');
  assert.equal((await submit(data)).outcome, 'duplicate');
  assert.deepEqual((await user.get()).data(), original);
});

test('failure before audit commit rolls back vote, target and state; retry counts once', async () => {
  const target = await post('atomic');
  const data = report(target.id);
  const reportId = id('atomic-report');
  const failingDb = {
    doc: db.doc.bind(db), collection: db.collection.bind(db),
    runTransaction: (callback) => db.runTransaction((tx) => callback({
      get: tx.get.bind(tx), set: tx.set.bind(tx), update: tx.update.bind(tx),
      create: (ref, values) => {
        if (ref.path.startsWith('moderationAudit/')) throw new Error('synthetic audit failure');
        return tx.create(ref, values);
      },
    })),
  };
  await assert.rejects(actOnReport(failingDb, reportId, data), /synthetic audit failure/);
  assert.equal((await count(target)).reportCount, undefined);
  assert.equal((await db.doc('moderationAudit/' + reportId).get()).exists, false);
  assert.equal((await db.doc('moderationVotes/' + hash([data.reporterUid, data.targetType, target.path])).get()).exists, false);
  assert.equal((await db.doc('moderationTargetState/' + hash([data.targetType, target.path])).get()).exists, false);
  await actOnReport(db, reportId, data);
  await actOnReport(db, reportId, data);
  assert.equal((await count(target)).reportCount, 1);
});

test('trigger requests retries and propagates transient processing failures', async () => {
  assert.equal(functions.onReportCreated.__endpoint.eventTrigger.retry, true);
  const originalTransaction = db.runTransaction;
  db.runTransaction = async () => { throw new Error('synthetic transient transaction failure'); };
  try {
    await assert.rejects(functions.onReportCreated.run({
      params: { reportId: id('transient-trigger') }, data: { data: () => report(id('transient-target')) },
    }), /synthetic transient transaction failure/);
  } finally {
    db.runTransaction = originalTransaction;
  }
});

test('existing client report shape works; clients cannot forge reporter, guest reports, audit, votes or state', async () => {
  const app = initializeApp({ projectId: 'demo-mango-security', apiKey: 'emulator-only' }, id('client'));
  const client = getFirestore(app);
  const uid = id('client-reporter');
  connectFirestoreEmulator(client, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]), {
    mockUserToken: { sub: uid, firebase: { sign_in_provider: 'password' } },
  });
  const guestApp = initializeApp({ projectId: 'demo-mango-security', apiKey: 'emulator-only' }, id('guest-client'));
  const guest = getFirestore(guestApp);
  connectFirestoreEmulator(guest, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]), {
    mockUserToken: { sub: id('guest'), firebase: { sign_in_provider: 'anonymous' } },
  });
  try {
    const target = await post('client-target');
    const data = { ...report(target.id, uid), createdAt: serverTimestamp() };
    await setDoc(doc(client, 'reports/' + id('client-ok')), data);
    await assert.rejects(setDoc(doc(client, 'reports/' + id('client-forged')), { ...data, reporterUid: id('victim') }), { code: 'permission-denied' });
    await assert.rejects(setDoc(doc(guest, 'reports/' + id('client-guest')), { ...data, reporterUid: id('guest') }), { code: 'permission-denied' });
    for (const collection of ['moderationVotes', 'moderationTargetState', 'moderationAudit']) {
      const ref = doc(client, collection + '/' + id('locked'));
      await db.doc(ref.path).set({ marker: true });
      for (const operation of [() => getDoc(ref), () => setDoc(ref, { marker: false }), () => updateDoc(ref, { marker: false }), () => deleteDoc(ref)]) {
        await assert.rejects(operation(), { code: 'permission-denied' });
      }
    }
  } finally {
    await terminate(client); await deleteApp(app);
    await terminate(guest); await deleteApp(guestApp);
  }
});
