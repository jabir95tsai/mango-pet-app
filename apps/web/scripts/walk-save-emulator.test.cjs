// Run only against a disposable Firestore emulator loaded with firestore.rules:
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8190 node --test apps/web/scripts/walk-save-emulator.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const sdk = require('firebase/firestore');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) throw new Error('Set an explicit loopback FIRESTORE_EMULATOR_HOST');
const projectId = process.env.GCLOUD_PROJECT ?? 'demo-mango-walk-save';
assert.ok(['demo-mango-security', 'demo-mango-walk-save'].includes(projectId));
const prefix = `walk-save-${Date.now()}`;
const documents = new Set();
const apps = [];
const clients = [];
const rest = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/firebase/walks.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'demo-key', appId: `demo-${uid}` }, uid);
  const db = sdk.getFirestore(app);
  sdk.connectFirestoreEmulator(db, '127.0.0.1', Number(host.split(':')[1]), {
    mockUserToken: { sub: uid, user_id: uid, firebase: { sign_in_provider: 'password' } },
  });
  const exports = {};
  // Use this realm: the SDK correctly rejects cross-realm plain objects.
  vm.runInThisContext(`(function(exports, require) { ${source}\n})`)(exports, id => {
    if (id === 'firebase/firestore') return sdk;
    if (id === './config') return { getDb: () => db };
    throw new Error(`Unexpected dependency ${id}`);
  });
  apps.push(app); clients.push(db);
  return { db, ...exports };
}
const aUid = `${prefix}-a`, bUid = `${prefix}-b`;
const a = client(aUid), b = client(bUid);
const familyId = `${prefix}-family`;

function input(name, extra = {}) {
  const walkId = `${prefix}-${name}`;
  documents.add(`walks/${walkId}`);
  return { walkId, familyId: null, walkerUid: aUid, petId: 'dog-A', petName: 'Fixture A',
    startedAt: new Date('2026-10-05T01:00:00Z'), endedAt: new Date('2026-10-05T01:20:00Z'),
    distanceKm: 1, durationMin: 20, score: 10, path: [], isManual: false, ...extra };
}

test.before(async () => {
  documents.add(`families/${familyId}`);
  const response = await fetch(`${rest}/families/${familyId}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { ownerUid: { stringValue: aUid }, memberUids: {
      arrayValue: { values: [aUid, bUid].map(stringValue => ({ stringValue })) },
    } } }),
  });
  assert.ok(response.ok, await response.text());
});
test.after(async () => {
  for (const name of documents) {
    const response = await fetch(`${rest}/${name}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    assert.ok(response.ok || response.status === 404);
  }
  await Promise.all(clients.map(db => sdk.terminate(db)));
  await Promise.all(apps.map(deleteApp));
});

test('real SDK transaction creates a personal walk and preserves recap on recovered retry', async () => {
  const args = input('retry');
  const first = await a.createWalk(args);
  await a.updateWalkDetails(args.walkId, { notes: 'saved recap', photoURLs: ['https://example.invalid/photo.jpg'] });
  const second = await a.createWalk(args);
  assert.equal(second.walkId, first.walkId);
  assert.equal(second.createdAt.toMillis(), first.createdAt.toMillis());
  assert.equal(second.notes, 'saved recap');
  assert.equal(second.photoURLs.length, 1);
});

test('same id cannot be acknowledged as a different pet, scope, walker or end time', async () => {
  const args = input('identity'); await a.createWalk(args);
  for (const mismatch of [{ petId: 'dog-B' }, { familyId }, { walkerUid: bUid }, { endedAt: new Date('2026-10-05T02:00:00Z') }]) {
    await assert.rejects(a.createWalk({ ...args, ...mismatch }), /another session/);
  }
  const saved = (await sdk.getDoc(sdk.doc(a.db, 'walks', args.walkId))).data();
  assert.equal(saved.petId, 'dog-A'); assert.equal(saved.familyId, null); assert.equal(saved.walkerUid, aUid);
});

test('different auth uid cannot read or overwrite a personal walk', async () => {
  const args = input('foreign'); await a.createWalk(args);
  await assert.rejects(b.createWalk({ ...args, walkerUid: bUid }), error => error.code === 'permission-denied');
  assert.equal((await sdk.getDoc(sdk.doc(a.db, 'walks', args.walkId))).data().walkerUid, aUid);
});

test('a readable family walk still cannot be mistaken for another member session', async () => {
  const args = input('family', { familyId, walkerUid: bUid }); await b.createWalk(args);
  await assert.rejects(a.createWalk({ ...args, walkerUid: aUid }), /another session/);
  assert.equal((await sdk.getDoc(sdk.doc(a.db, 'walks', args.walkId))).data().walkerUid, bUid);
});

test('concurrent retry and a second dog leave exactly their two distinct records', async () => {
  const first = input('dog-a'), second = input('dog-b', { petId: 'dog-B', petName: 'Fixture B' });
  const results = await Promise.all([a.createWalk(first), a.createWalk(first), a.createWalk(second)]);
  assert.equal(results[0].walkId, results[1].walkId); assert.notEqual(results[0].walkId, results[2].walkId);
  const snap = await sdk.getDocs(sdk.query(sdk.collection(a.db, 'walks'), sdk.where('walkerUid', '==', aUid), sdk.where('familyId', '==', null)));
  const pair = snap.docs.filter(doc => [first.walkId, second.walkId].includes(doc.id));
  assert.equal(pair.length, 2); assert.deepEqual(pair.map(doc => doc.data().petId).sort(), ['dog-A', 'dog-B']);
});
