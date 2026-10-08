const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./emulator.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const s = require('firebase/firestore');
s.setLogLevel('silent');
const apps = [], clients = [];
function client(uid, provider = 'password') {
  const app = initializeApp({ projectId: 'demo-mango-security' }, `r15-${apps.length}`);
  const c = s.getFirestore(app);
  s.connectFirestoreEmulator(c, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),
    uid ? { mockUserToken: { sub: uid, firebase: { sign_in_provider: provider } } } : undefined);
  apps.push(app); clients.push(c); return c;
}
const owner = client('r15-owner'), member = client('r15-member'), stranger = client('r15-stranger');
const guest = client('r15-guest', 'anonymous'), unauth = client();
const emojis = ['❤️', '😂', '🐶', '👍', '🎉'];
const zero = () => Object.fromEntries(emojis.map(e => [e, 0]));
// Execute the shipped TypeScript adapters, with only native transport bridged
// to the emulator. This does not validate a React Native device runtime.
function adapter(c, platform) {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const ts = require('typescript');
  const file = platform === 'web' ? 'apps/web/src/lib/firebase/posts.ts' : 'apps/ios/src/lib/posts.ts';
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const wrap = raw => ({ raw, collection: name => ({ doc: id => wrap(s.doc(raw, name, id)) }) });
  const native = () => ({ collection: name => ({ doc: id => wrap(s.doc(c, name, id)) }),
    runTransaction: fn => s.runTransaction(c, tx => fn({
      get: async r => { const v = await tx.get(r.raw); return { exists: v.exists(), data: () => v.data() }; },
      update: (r, d) => tx.update(r.raw, d), set: (r, d) => tx.set(r.raw, d), delete: r => tx.delete(r.raw),
    })),
  });
  native.FieldValue = { increment: s.increment, serverTimestamp: s.serverTimestamp };
  const exports = {};
  vm.runInThisContext(`(function(exports, require) { ${source}\n})`)(exports, id => {
    if (id === 'firebase/firestore') return s;
    if (id === '@react-native-firebase/firestore') return native;
    if (id === './config') return { getDb: () => c };
    if (['@/lib/types', '@mango/shared-types'].includes(id)) return { REACTION_EMOJIS: emojis };
    if (['./storage', './photos', '@mango/shared-business'].includes(id)) return {};
    throw new Error(`Unexpected module ${id}`);
  });
  return exports;
}
const deny = p => assert.rejects(p, { code: 'permission-denied' });
const postPath = 'posts/r15-public';
let serial = 0;
function walk(uid, petId = 'r15-shared', familyId = 'r15-family') {
  return { walkerUid: uid, ownerUid: uid, petId, familyId, score: 10,
    createdAt: s.serverTimestamp(), startedAt: s.Timestamp.now(), endedAt: s.Timestamp.now(),
    distanceKm: 1, durationMin: 10, isManual: false };
}
async function react(c, uid, emoji, path = postPath) {
  await s.runTransaction(c, async tx => {
    const p = s.doc(c, path), r = s.doc(c, `${path}/reactions/${uid}`);
    const ps = await tx.get(p), rs = await tx.get(r);
    const old = rs.exists() ? rs.data().emoji : null;
    if (old === emoji) return;
    tx.update(p, Object.fromEntries(emojis.map(key => [
      `reactionCounts.${key}`, s.increment((emoji === key ? 1 : 0) - (old === key ? 1 : 0)),
    ])));
    if (emoji) tx.set(r, { uid, emoji, reactedAt: s.serverTimestamp() });
    else tx.delete(r);
  });
}
before(async () => {
  await db.doc('families/r15-family').set({ memberUids: ['r15-owner', 'r15-member'] });
  for (const [id, ownerUid, familyId] of [
    ['r15-shared', 'r15-owner', 'r15-family'], ['r15-personal', 'r15-owner', null],
    ['r15-guest-pet', 'r15-guest', null], ['r15-foreign', 'r15-stranger', null],
  ]) await db.doc(`pets/${id}`).set({ ownerUid, familyId });
  for (const visibility of ['public', 'friends', 'private']) await db.doc(`posts/r15-${visibility}`).set({
    authorUid: 'r15-owner', visibility, reactionCounts: zero(), createdAt: new Date(),
  });
  await db.doc('users/r15-owner').set({ uid: 'r15-owner', blockedUids: [] });
  await db.doc('users/r15-owner/friends/r15-member').set({ uid: 'r15-member' });
});
after(async () => { await Promise.all(clients.map(s.terminate)); await Promise.all(apps.map(deleteApp)); await db.terminate(); });
test('walks accept personal owner, guest owner and actual family member', async () => {
  for (const [c, uid, pet, family] of [[owner, 'r15-owner', 'r15-personal', null],
    [guest, 'r15-guest', 'r15-guest-pet', null], [member, 'r15-member', 'r15-shared', 'r15-family']]) {
    const ref = s.doc(c, `walks/r15-ok-${++serial}`);
    await s.setDoc(ref, walk(uid, pet, family));
    await s.updateDoc(ref, { notes: 'recap', photoURLs: [] });
  }
});
test('walk create rejects foreign/missing pets, wrong scope, impersonation and unauthenticated callers', async () => {
  for (const [c, data] of [[member, walk('r15-member', 'r15-foreign')],
    [owner, walk('r15-owner', 'missing')], [owner, walk('r15-owner', 'r15-personal')],
    [member, walk('r15-member', 'r15-shared', null)], [stranger, walk('r15-stranger')],
    [member, walk('r15-owner')], [unauth, walk('r15-owner')],
    [owner, { ...walk('r15-owner'), ownerUid: 'other' }]]) {
    await deny(s.setDoc(s.doc(c, `walks/r15-denied-${++serial}`), data));
  }
});
test('walk update cannot rewrite identity, score or timestamps and rejects departed members', async () => {
  const ref = s.doc(member, 'walks/r15-immutable'); await s.setDoc(ref, walk('r15-member'));
  for (const change of [{ petId: 'r15-foreign' }, { familyId: null }, { walkerUid: 'r15-owner' },
    { ownerUid: 'r15-owner' }, { score: 999 }, { startedAt: s.Timestamp.now() }]) await deny(s.updateDoc(ref, change));
  await db.doc('families/r15-family').update({ memberUids: ['r15-owner'] });
  await deny(s.updateDoc(ref, { notes: 'stale family' }));
  await db.doc('families/r15-family').update({ memberUids: ['r15-owner', 'r15-member'] });
});
test('reaction add/switch/remove and idempotent retries keep exact counts', async () => {
  await react(member, 'r15-member', '❤️'); await react(member, 'r15-member', '❤️');
  assert.equal((await db.doc(postPath).get()).data().reactionCounts['❤️'], 1);
  await react(member, 'r15-member', '🐶');
  assert.deepEqual((await db.doc(postPath).get()).data().reactionCounts, { ...zero(), '🐶': 1 });
  await react(member, 'r15-member', null);
  assert.deepEqual((await db.doc(postPath).get()).data().reactionCounts, zero());
});
test('simultaneous reactors do not lose counts', async () => {
  await Promise.all([react(member, 'r15-member', '👍'), react(stranger, 'r15-stranger', '👍')]);
  assert.equal((await db.doc(postPath).get()).data().reactionCounts['👍'], 2);
  await react(member, 'r15-member', null); await react(stranger, 'r15-stranger', null);
});
test('actual Web and iOS adapters add, switch and remove atomically, including concurrent callers', async () => {
  const web = adapter(member, 'web'), ios = adapter(stranger, 'ios');
  await Promise.all([web.setReaction('r15-public', 'r15-member', '😂'), ios.setReaction('r15-public', 'r15-stranger', '😂')]);
  assert.equal((await db.doc(postPath).get()).data().reactionCounts['😂'], 2);
  await web.setReaction('r15-public', 'r15-member', '🐶');
  await ios.setReaction('r15-public', 'r15-stranger', '🎉');
  await web.setReaction('r15-public', 'r15-member', null);
  await ios.setReaction('r15-public', 'r15-stranger', null);
  assert.deepEqual((await db.doc(postPath).get()).data().reactionCounts, zero());
});
test('standalone count writes and standalone reactions are denied, including by the author', async () => {
  for (const c of [owner, member]) await deny(s.updateDoc(s.doc(c, postPath), { reactionCounts: { ...zero(), '❤️': 50 } }));
  await deny(s.setDoc(s.doc(member, `${postPath}/reactions/r15-member`), { uid: 'r15-member', emoji: '❤️', reactedAt: s.serverTimestamp() }));
  await react(member, 'r15-member', '❤️');
  await deny(s.deleteDoc(s.doc(member, `${postPath}/reactions/r15-member`)));
  await react(member, 'r15-member', null);
});
test('a real reaction cannot authorize extra votes, a negative counter or unrelated post edits', async () => {
  for (const patch of [{ reactionCounts: { ...zero(), '❤️': 2 } },
    { reactionCounts: { ...zero(), '❤️': 1, '🐶': -1 } },
    { reactionCounts: { ...zero(), '❤️': 1 }, text: 'overwrite' }]) {
    const b = s.writeBatch(member);
    b.update(s.doc(member, postPath), patch);
    b.set(s.doc(member, `${postPath}/reactions/r15-member`), { uid: 'r15-member', emoji: '❤️', reactedAt: s.serverTimestamp() });
    await deny(b.commit());
  }
});
test('private/friends/orphan reaction reads and writes obey parent visibility; guests cannot react', async () => {
  for (const path of ['posts/r15-private', 'posts/r15-friends', 'posts/r15-missing']) {
    await deny(s.getDoc(s.doc(stranger, `${path}/reactions/r15-stranger`)));
    await deny(react(stranger, 'r15-stranger', '❤️', path));
  }
  await react(member, 'r15-member', '🎉', 'posts/r15-friends');
  await react(owner, 'r15-owner', '🎉', 'posts/r15-private');
  await deny(react(guest, 'r15-guest', '❤️'));
  await deny(react(unauth, 'x', '❤️'));
});
test('blocked caller and malformed or impersonated atomic reactions are denied', async () => {
  await db.doc('users/r15-owner').update({ blockedUids: ['r15-member'] });
  await deny(react(member, 'r15-member', '❤️'));
  await db.doc('users/r15-owner').update({ blockedUids: [] });
  for (const extra of [{ uid: 'r15-owner' }, { emoji: 'bad' }, { extra: true }, { reactedAt: s.Timestamp.fromMillis(0) }]) {
    const b = s.writeBatch(member);
    b.update(s.doc(member, postPath), { reactionCounts: { ...zero(), '❤️': 1 } });
    b.set(s.doc(member, `${postPath}/reactions/r15-member`), { uid: 'r15-member', emoji: '❤️', reactedAt: s.serverTimestamp(), ...extra });
    await deny(b.commit());
  }
});
test('post creation cannot seed counters or moderation state; author cannot reassign ownership', async () => {
  const data = { authorUid: 'r15-owner', visibility: 'public', createdAt: s.serverTimestamp(), reactionCounts: zero() };
  await s.setDoc(s.doc(owner, 'posts/r15-create-ok'), data);
  for (const extra of [{ reactionCounts: { ...zero(), '❤️': 99 } }, { hidden: false }, { commentCount: 9 }, { reportCount: 9 }])
    await deny(s.setDoc(s.doc(owner, `posts/r15-create-bad-${++serial}`), { ...data, ...extra }));
  await deny(s.updateDoc(s.doc(owner, 'posts/r15-create-ok'), { authorUid: 'r15-member' }));
});

test('legacy REST whole-double counters support both adapters and optional normalization preserves data', async () => {
  const { normalizePost, restTransport } = await import('../scripts/normalize-reaction-counts.mjs');
  const request = restTransport(`http://${process.env.FIRESTORE_EMULATOR_HOST}`, async () => 'owner');
  const root = 'projects/demo-mango-security/databases/(default)/documents';
  for (const platform of ['web', 'ios']) {
    const id = `r15-double-${platform}`, name = `${root}/posts/${id}`;
    // Admin/Web JS number 4 serializes as integer; REST doubleValue is necessary
    // to reproduce the actual on-disk type (4.0 and 4 are otherwise both JS 4).
    await request('PATCH', name, { fields: {
      authorUid: { stringValue: 'r15-owner' }, visibility: { stringValue: 'public' },
      text: { stringValue: 'preserve me' },
      reactionCounts: { mapValue: { fields: Object.fromEntries(emojis.map(e =>
        [e, e === '❤️' ? { doubleValue: 4 } : { integerValue: '0' }])) } },
    } });
    for (const uid of ['r15-member', 'legacy-a', 'legacy-b', 'legacy-c']) {
      await db.doc(`posts/${id}/reactions/${uid}`).set({ uid, emoji: '❤️', reactedAt: new Date() });
    }
    const old = adapter(member, platform), fresh = adapter(stranger, platform);
    await fresh.setReaction(id, 'r15-stranger', '❤️');
    await old.setReaction(id, 'r15-member', '🐶');
    await old.setReaction(id, 'r15-member', null);
    await old.setReaction(id, 'r15-member', '❤️');
    await fresh.setReaction(id, 'r15-stranger', null);
    const dry = await normalizePost(request, 'demo-mango-security', id);
    assert.deepEqual(dry, { changedFields: 1, applied: false });
    assert.equal((await request('GET', name)).fields.reactionCounts.mapValue.fields['❤️'].doubleValue, 4);
    assert.deepEqual(await normalizePost(request, 'demo-mango-security', id, true), { changedFields: 1, applied: true });
    const saved = await request('GET', name);
    assert.equal(saved.fields.reactionCounts.mapValue.fields['❤️'].integerValue, '4');
    assert.equal(saved.fields.text.stringValue, 'preserve me');
    assert.deepEqual(await normalizePost(request, 'demo-mango-security', id, true), { changedFields: 0, applied: false });
    await fresh.setReaction(id, 'r15-stranger', '❤️');
    await old.setReaction(id, 'r15-member', '🐶');
    await old.setReaction(id, 'r15-member', null);
    await fresh.setReaction(id, 'r15-stranger', null);
    assert.deepEqual((await db.doc(`posts/${id}`).get()).data().reactionCounts, { ...zero(), '❤️': 3 });
  }
});

test('native double increment wire format supports add/switch/remove but cannot grant fractional or excess votes', async () => {
  const { restTransport } = await import('../scripts/normalize-reaction-counts.mjs');
  const { createMockUserToken } = require('@firebase/util');
  const project = 'demo-mango-security', root = `projects/${project}/databases/(default)/documents`;
  const request = restTransport(`http://${process.env.FIRESTORE_EMULATOR_HOST}`,
    async () => createMockUserToken({ sub: 'r15-member', firebase: { sign_in_provider: 'password' } }, project));
  const name = `${root}/posts/r15-native-wire`, reaction = `${name}/reactions/r15-member`;
  await request('POST', `${root}:commit`, { writes: [{ update: { name, fields: {
    authorUid: { stringValue: 'r15-member' }, visibility: { stringValue: 'public' },
    reactionCounts: { mapValue: { fields: Object.fromEntries(emojis.map(key => [key, { doubleValue: 0 }])) } },
  } } }] });
  async function change(old, next, bonus = 0) {
    return request('POST', `${root}:commit`, { writes: [
      next ? { update: { name: reaction, fields: { uid: { stringValue: 'r15-member' }, emoji: { stringValue: next } } },
        updateTransforms: [{ fieldPath: 'reactedAt', setToServerValue: 'REQUEST_TIME' }] } : { delete: reaction },
      { transform: { document: name, fieldTransforms: emojis.map(key => ({
        fieldPath: `reactionCounts.\`${key}\``,
        increment: { doubleValue: (next === key ? 1 : 0) - (old === key ? 1 : 0) + (key === '❤️' ? bonus : 0) },
      })) } },
    ] });
  }
  await change(null, '❤️');
  await change('❤️', '🐶');
  await change('🐶', null);
  assert.deepEqual((await db.doc('posts/r15-native-wire').get()).data().reactionCounts, zero());
  for (const extra of [0.5, 1, -2]) await assert.rejects(change(null, '❤️', extra), { code: 'PERMISSION_DENIED' });
  // Wire-typed legacy corruption must still fail even for otherwise exact deltas.
  const admin = restTransport(`http://${process.env.FIRESTORE_EMULATOR_HOST}`, async () => 'owner');
  for (const value of [-2, 0.25, 'NaN', 'Infinity', 9007199254740992]) {
    await admin('PATCH', `${name}?updateMask.fieldPaths=reactionCounts`, { fields: {
      reactionCounts: { mapValue: { fields: Object.fromEntries(emojis.map(key =>
        [key, { doubleValue: key === '❤️' ? value : 0 }])) } },
    } });
    await assert.rejects(change(null, '❤️'), { code: 'PERMISSION_DENIED' });
  }
});

test('normalization refuses inconsistent, fractional, unsafe and malformed counters without changing data', async () => {
  const { normalizePost, restTransport } = await import('../scripts/normalize-reaction-counts.mjs');
  const request = restTransport(`http://${process.env.FIRESTORE_EMULATOR_HOST}`, async () => 'owner');
  const name = 'projects/demo-mango-security/databases/(default)/documents/posts/r15-double-invalid';
  for (const value of [-1, 0.5, 2, Number.MAX_SAFE_INTEGER + 1]) {
    await request('PATCH', name, { fields: {
      reactionCounts: { mapValue: { fields: Object.fromEntries(emojis.map(e =>
        [e, e === '❤️' ? { doubleValue: value } : { integerValue: '0' }])) } },
    } });
    await assert.rejects(normalizePost(request, 'demo-mango-security', 'r15-double-invalid', true), /fractional, unsafe, negative or differs/);
    assert.equal((await request('GET', name)).fields.reactionCounts.mapValue.fields['❤️'].doubleValue, value);
  }
  await db.doc('posts/r15-double-invalid').set({ reactionCounts: { ...zero(), extra: 0 } });
  await assert.rejects(normalizePost(request, 'demo-mango-security', 'r15-double-invalid', true), /Invalid counter keys/);
  await db.doc('posts/r15-double-invalid').set({ reactionCounts: zero() });
  await db.doc('posts/r15-double-invalid/reactions/wrong').set({ uid: 'other', emoji: '❤️' });
  await assert.rejects(normalizePost(request, 'demo-mango-security', 'r15-double-invalid', true), /Invalid reaction document/);
});
