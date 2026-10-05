const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const functionsRequire = createRequire(path.join(root, 'functions/package.json'));
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const ts = webRequire('typescript');
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = functionsRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = functionsRequire('firebase-admin/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const sdk = require('firebase/firestore');

// Refuse ambient production credentials/endpoints: all fixtures use this demo DB.
assert.equal(process.env.GCLOUD_PROJECT, 'demo-mango-feed');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8189');
const adminApp = initializeAdmin({ projectId: 'demo-mango-feed' }, 'feed-fixtures');
const admin = getAdminFirestore(adminApp);
const app = initializeApp({ projectId: 'demo-mango-feed', apiKey: 'emulator-only' }, 'feed-client');
const db = sdk.getFirestore(app);
sdk.connectFirestoreEmulator(db, '127.0.0.1', 8189, {
  mockUserToken: { sub: 'feed-viewer', firebase: { sign_in_provider: 'password' } },
});
const friendUids = Array.from({ length: 46 }, (_, i) => `feed-friend-${i}`);
const fixturePosts = [];
const time = (n) => sdk.Timestamp.fromMillis(1700000000000 + n * 1000);

// Execute the actual TS data-layer modules, replacing only unrelated uploads,
// platform wiring and native Firestore transport. Both query adapters reach the
// real client SDK + emulator rules. This is not a native-iOS runtime test.
function loadTs(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    throw new Error(`Unexpected import ${id} from ${relative}`);
  };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}
const business = {
  ...loadTs('packages/shared-business/src/feed-queries.ts'),
  ...loadTs('packages/shared-business/src/moderation.ts'),
};
function adapter(platform) {
  const calls = [];
  let failure;
  const execute = async (queryRef) => {
    calls.push(queryRef);
    if (failure) throw failure;
    return sdk.getDocs(queryRef);
  };
  const common = { '@mango/shared-business': business, '@/lib/types': {}, '@mango/shared-types': {} };
  if (platform === 'web') {
    return {
      calls,
      failWith: (error) => { failure = error; },
      api: loadTs('apps/web/src/lib/firebase/posts.ts', {
        ...common, 'firebase/firestore': { ...sdk, getDocs: execute },
        './config': { getDb: () => db }, './storage': {},
      }),
    };
  }
  // Match the chainable native SDK query API; execute the resulting constraints
  // with the Web SDK so native and Web adapter behavior is exercised together.
  function nativeQuery(base, constraints = []) {
    return {
      where: (...args) => nativeQuery(base, [...constraints, sdk.where(...args)]),
      orderBy: (...args) => nativeQuery(base, [...constraints, sdk.orderBy(...args)]),
      limit: (max) => nativeQuery(base, [...constraints, sdk.limit(max)]),
      get: () => execute(sdk.query(base, ...constraints)),
    };
  }
  const nativeFirestore = () => ({ collection: (name) => nativeQuery(sdk.collection(db, name)) });
  return {
    calls,
    failWith: (error) => { failure = error; },
    api: loadTs('apps/ios/src/lib/posts.ts', {
      ...common, '@react-native-firebase/firestore': nativeFirestore, './photos': {},
    }),
  };
}

before(async () => {
  const batch = admin.batch();
  for (const [i, uid] of friendUids.entries()) {
    batch.set(admin.doc(`users/${uid}/friends/feed-viewer`), {});
    for (const [j, visibility] of ['friends', 'public', 'private'].entries()) {
      fixturePosts.push({ postId: `feed-${i}-${visibility}`, authorUid: uid, visibility,
        createdAt: time(i * 10 + j), hidden: i === 45 && visibility === 'friends' });
    }
  }
  fixturePosts.push(
    { postId: 'feed-own-private', authorUid: 'feed-viewer', visibility: 'private', createdAt: time(1000) },
    { postId: 'feed-own-public', authorUid: 'feed-viewer', visibility: 'public', createdAt: time(999) },
    { postId: 'feed-stranger-public', authorUid: 'feed-stranger', visibility: 'public', createdAt: time(998) },
    { postId: 'feed-stranger-private', authorUid: 'feed-stranger', visibility: 'private', createdAt: time(997) },
    { postId: 'feed-stranger-friends', authorUid: 'feed-stranger', visibility: 'friends', createdAt: time(996) },
  );
  for (const post of fixturePosts) {
    const { postId, createdAt, ...fields } = post;
    batch.set(admin.doc(`posts/${postId}`), { ...fields, createdAt: new Date(createdAt.toMillis()) });
  }
  await batch.commit();
});
after(async () => {
  await sdk.terminate(db);
  await deleteApp(app);
  await admin.terminate();
  await deleteAdmin(adminApp);
});

test('emulator enforces the original query DNF boundary: 15 succeeds; 16 and 30 reject', async () => {
  for (const count of [15, 16, 30]) {
    const pending = sdk.getDocs(sdk.query(sdk.collection(db, 'posts'),
      sdk.where('authorUid', 'in', friendUids.slice(0, count)),
      sdk.where('visibility', 'in', ['friends', 'public']),
      sdk.orderBy('createdAt', 'desc'), sdk.limit(1000)));
    if (count === 15) assert.equal((await pending).size, 30);
    else await assert.rejects(pending, (error) => error.code === 'invalid-argument' && /disjunctions/.test(error.message));
  }
});

for (const platform of ['web', 'ios']) {
  test(`${platform}: 0 / 15 / 16 / 30 / 46 friends return every accessible friend post`, async () => {
    for (const [count, queryCount] of [[0, 0], [15, 1], [16, 2], [30, 2], [46, 4]]) {
      const { api, calls } = adapter(platform);
      const posts = await api.listFriendsPosts(friendUids.slice(0, count), 1000);
      assert.equal(calls.length, queryCount);
      assert.equal(posts.length, count * 2);
      assert.equal(new Set(posts.map((p) => p.postId)).size, count * 2);
      assert.ok(posts.every((p) => p.visibility === 'friends' || p.visibility === 'public'));
    }
  });

  test(`${platform}: duplicate authors do not duplicate queries or results; per-query max is preserved`, async () => {
    const { api, calls } = adapter(platform);
    const posts = await api.listFriendsPosts([...friendUids.slice(0, 16), ...friendUids.slice(0, 16)], 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(posts.map((p) => p.postId), [
      'feed-14-public', 'feed-14-friends', 'feed-15-public', 'feed-15-friends',
    ]);
  });

  test(`${platform}: mixed feed merges, deduplicates, sorts and filters without changing the max contract`, async () => {
    const { api } = adapter(platform);
    const blocked = [friendUids[44]];
    const posts = await api.listFeedPosts('feed-viewer', friendUids, 1000, blocked);
    const expected = fixturePosts.filter((p) =>
      (p.authorUid === 'feed-viewer' || p.visibility === 'public' ||
        (friendUids.includes(p.authorUid) && p.visibility === 'friends')) &&
      !p.hidden && !blocked.includes(p.authorUid)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    assert.deepEqual(posts.map((p) => p.postId), expected.map((p) => p.postId));
    assert.ok(posts.every((p) => typeof p.createdAt.toMillis === 'function'));
    const small = await api.listFeedPosts('feed-viewer', friendUids.slice(0, 16), 2);
    assert.ok(small.length > 2, 'max is a source/query cap, not a new global feed cap');
    assert.equal(new Set(small.map((p) => p.postId)).size, small.length);
    assert.deepEqual(small.map((p) => p.createdAt.toMillis()), small.map((p) => p.createdAt.toMillis()).sort((a, b) => b - a));
  });

  test(`${platform}: query failures reject the complete result rather than becoming silent partial feeds`, async () => {
    const unauthorized = adapter(platform);
    await assert.rejects(unauthorized.api.listFriendsPosts(['feed-stranger']), { code: 'permission-denied' });
    await assert.rejects(unauthorized.api.listFeedPosts('feed-viewer', ['feed-stranger']), { code: 'permission-denied' });
    const injected = adapter(platform);
    const failure = Object.assign(new Error('offline query'), { code: 'unavailable' });
    injected.failWith(failure);
    await assert.rejects(injected.api.listFriendsPosts(friendUids), (error) => error === failure);
    await assert.rejects(injected.api.listFeedPosts('feed-viewer', friendUids), (error) => error === failure);
  });
}
