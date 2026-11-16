const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { db, functions, Timestamp } = require('./emulator.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const s = require('firebase/firestore');
s.setLogLevel('silent');

const prefix = 'notif-' + randomUUID();
const id = (suffix) => prefix + '-' + suffix;
const author = id('author'), alice = id('alice'), bob = id('bob'), carol = id('carol'), blocked = id('blocked');
const apps = [];
function client(uid) {
  const app = initializeApp({ projectId: 'demo-mango-security' }, `notif-${apps.length}`);
  const c = s.getFirestore(app);
  s.connectFirestoreEmulator(c, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),
    { mockUserToken: { sub: uid, firebase: { sign_in_provider: 'password' } } });
  apps.push(app);
  return c;
}
after(async () => { await Promise.all(apps.map((a) => deleteApp(a))); await db.terminate(); });

const inbox = (uid, docId) => db.doc(`users/${uid}/notifications/${docId}`);
const read = async (uid, docId) => (await inbox(uid, docId).get()).data();
const user = (uid, extra = {}) => db.doc(`users/${uid}`).set({ uid, displayName: uid, ...extra });
async function post(suffix) {
  await user(author, { blockedUids: [blocked] });
  const ref = db.doc(`posts/${id(suffix)}`);
  await ref.set({ authorUid: author, visibility: 'public' });
  return ref.id;
}
async function comment(postId, commentId, authorUid, text = 'nice walk') {
  const data = { authorUid, text, createdAt: Timestamp.now() };
  await db.doc(`posts/${postId}/comments/${commentId}`).set(data);
  await functions.notifyOnCommentCreated.run({ params: { postId, commentId }, data: { data: () => data } });
}
async function react(postId, uid, ms) {
  await db.doc(`posts/${postId}/reactions/${uid}`).set({ uid, emoji: '❤️', reactedAt: Timestamp.fromMillis(ms) });
  await functions.notifyOnReactionCreated.run({ params: { postId, uid } });
}
async function unreact(postId, uid) {
  await db.doc(`posts/${postId}/reactions/${uid}`).delete();
  await functions.notifyOnReactionDeleted.run({ params: { postId, uid } });
}
async function friendRequest(toUid, fromUid) {
  const data = { fromUid, createdAt: Timestamp.now() };
  await db.doc(`users/${toUid}/friendRequests/${fromUid}`).set(data);
  await functions.notifyOnFriendRequestCreated.run({ params: { uid: toUid, requestId: fromUid }, data: { data: () => data } });
}

test('comment notifies the post author with an 80-char preview; deleting the comment keeps it', async () => {
  const postId = await post('comment');
  const commentId = id('c1');
  await comment(postId, commentId, alice, '  ' + 'x'.repeat(100));
  const n = await read(author, `comment_${commentId}`);
  assert.equal(n.type, 'comment');
  assert.deepEqual(n.actorUids, [alice]);
  assert.equal(n.actorCount, 1);
  assert.equal(n.postId, postId);
  assert.equal(n.commentId, commentId);
  assert.equal(n.commentPreview, 'x'.repeat(80));
  assert.ok(n.createdAt);
  await db.doc(`posts/${postId}/comments/${commentId}`).delete();
  await functions.onCommentDeleted.run({ params: { postId, commentId } });
  assert.ok(await read(author, `comment_${commentId}`));
});

test('comment skips own comment, blocked commenter, objectionable text and deleted recipient', async () => {
  const postId = await post('comment-skip');
  await comment(postId, id('own'), author);
  await comment(postId, id('blk'), blocked);
  await comment(postId, id('bad'), alice, 'fuck this');
  for (const c of ['own', 'blk', 'bad']) assert.equal(await read(author, `comment_${id(c)}`), undefined);
  await db.doc(`deletedAccounts/${author}`).set({ startedAt: Timestamp.now() });
  await comment(postId, id('fenced'), alice);
  assert.equal(await read(author, `comment_${id('fenced')}`), undefined);
  await db.doc(`deletedAccounts/${author}`).delete();
});

test('reactions merge per post newest first, skip self/blocked, and delete at zero', async () => {
  const postId = await post('react');
  const docId = `reaction_${postId}`;
  await react(postId, author, 1000);
  await react(postId, blocked, 1500);
  assert.equal(await read(author, docId), undefined);
  await react(postId, alice, 2000);
  const first = await read(author, docId);
  assert.deepEqual(first.actorUids, [alice]);
  assert.equal(first.actorCount, 1);
  assert.equal(first.postId, postId);
  await react(postId, bob, 3000);
  await react(postId, carol, 4000);
  await react(postId, id('dave'), 5000);
  const merged = await read(author, docId);
  assert.deepEqual(merged.actorUids, [id('dave'), carol, bob]);
  assert.equal(merged.actorCount, 4);
  assert.ok(merged.createdAt.toMillis() >= first.createdAt.toMillis());
  // Replayed create event converges instead of double counting.
  await functions.notifyOnReactionCreated.run({ params: { postId, uid: bob } });
  assert.equal((await read(author, docId)).actorCount, 4);
  await unreact(postId, id('dave'));
  const after = await read(author, docId);
  assert.deepEqual(after.actorUids, [carol, bob, alice]);
  assert.equal(after.actorCount, 3);
  for (const uid of [carol, bob]) await unreact(postId, uid);
  assert.equal((await read(author, docId)).actorCount, 1);
  await unreact(postId, alice);
  assert.equal(await read(author, docId), undefined);
  // Self/blocked reactions remaining never resurrect the row.
  await unreact(postId, author);
  assert.equal(await read(author, docId), undefined);
});

test('friend request notifies the recipient; blocked sender is skipped', async () => {
  await user(author, { blockedUids: [blocked] });
  await friendRequest(author, alice);
  const n = await read(author, `friendRequest_${alice}`);
  assert.equal(n.type, 'friendRequest');
  assert.deepEqual(n.actorUids, [alice]);
  assert.equal(n.actorCount, 1);
  assert.equal(n.friendRequestId, alice);
  await friendRequest(author, blocked);
  assert.equal(await read(author, `friendRequest_${blocked}`), undefined);
});

test('rules: owner can read own inbox, others cannot, clients cannot write', async () => {
  const owner = id('rules-owner');
  await user(owner);
  await inbox(owner, 'friendRequest_x').set({ type: 'friendRequest', actorUids: ['x'], actorCount: 1, createdAt: Timestamp.now() });
  const mine = client(owner), other = client(id('rules-other'));
  const deny = (p) => assert.rejects(p, { code: 'permission-denied' });
  assert.equal((await s.getDoc(s.doc(mine, `users/${owner}/notifications/friendRequest_x`))).data().type, 'friendRequest');
  assert.equal((await s.getDocs(s.query(s.collection(mine, `users/${owner}/notifications`), s.orderBy('createdAt', 'desc'), s.limit(50)))).size, 1);
  await deny(s.getDoc(s.doc(other, `users/${owner}/notifications/friendRequest_x`)));
  await deny(s.getDocs(s.collection(other, `users/${owner}/notifications`)));
  await deny(s.setDoc(s.doc(mine, `users/${owner}/notifications/fake`), { type: 'comment' }));
  await deny(s.updateDoc(s.doc(mine, `users/${owner}/notifications/friendRequest_x`), { actorCount: 9 }));
  await deny(s.deleteDoc(s.doc(mine, `users/${owner}/notifications/friendRequest_x`)));
  await deny(s.setDoc(s.doc(other, `users/${owner}/notifications/fake`), { type: 'comment' }));
});
