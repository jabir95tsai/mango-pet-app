const { test, after } = require('node:test');
const assert = require('node:assert/strict');
assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
const { db } = require('./emulator.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const { getStorage, connectStorageEmulator, ref, uploadBytes, deleteObject, getBytes } = require('firebase/storage');
const { getStorage: adminStorage } = require('firebase-admin/storage');
const apps = [];
function storage(uid) {
  const app = initializeApp({ projectId: 'demo-mango-security', storageBucket: 'demo-mango-security.appspot.com', apiKey: 'emulator-only' }, `storage-${apps.length}`);
  apps.push(app);
  const client = getStorage(app);
  connectStorageEmulator(client, '127.0.0.1', Number(process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')[1]), uid ? { mockUserToken: { sub: uid } } : undefined);
  return client;
}
const owner = storage('life-storage-owner'), other = storage('life-storage-other'), unauth = storage();
const denied = (promise) => assert.rejects(promise, { code: 'storage/unauthorized' });
const upload = (client, path, contentType = 'image/jpeg', bytes = new Uint8Array([1, 2, 3])) => uploadBytes(ref(client, path), bytes, { contentType });
after(async () => { await Promise.all(apps.map(deleteApp)); await db.terminate(); });

test('Storage owner can upload/update/delete canonical shared and private images; foreign and unauth cannot', async () => {
  for (const suffix of ['pets/p/avatar.jpg', 'posts/p/0.jpg', 'walks/w/photos/a.jpg', 'private/image.jpg']) {
    const path = `users/life-storage-owner/${suffix}`;
    await upload(owner, path);
    await upload(owner, path);
    await denied(upload(other, path));
    await denied(deleteObject(ref(other, path)));
    await denied(deleteObject(ref(unauth, path)));
    await deleteObject(ref(owner, path));
    assert.equal((await adminStorage().bucket().file(path).exists())[0], false);
  }
});

test('Storage preserves image/size constraints but allows owner deletion of pre-existing non-image files', async () => {
  const prefix = 'users/life-storage-owner/private/';
  await denied(upload(owner, `${prefix}bad.txt`, 'text/plain'));
  await denied(upload(owner, `${prefix}oversize.jpg`, 'image/jpeg', new Uint8Array(10 * 1024 * 1024)));
  await adminStorage().bucket().file(`${prefix}legacy.txt`).save('old', { resumable: false, contentType: 'text/plain' });
  await deleteObject(ref(owner, `${prefix}legacy.txt`));
});

test('Storage shared read remains authenticated, private read stays owner-only', async () => {
  const shared = 'users/life-storage-owner/posts/shared-read/0.jpg', privatePath = 'users/life-storage-owner/private/secret.jpg';
  await upload(owner, shared); await upload(owner, privatePath);
  assert.equal((await getBytes(ref(other, shared))).byteLength, 3);
  await denied(getBytes(ref(unauth, shared)));
  await denied(getBytes(ref(other, privatePath)));
  assert.equal((await getBytes(ref(owner, privatePath))).byteLength, 3);
});

test('Storage marker freezes owner upload/update/delete while retaining normal shared reads', async () => {
  const uid = 'life-storage-frozen', client = storage(uid), path = `users/${uid}/pets/shared/avatar.jpg`;
  await upload(client, path);
  await db.doc(`deletedAccounts/${uid}`).set({ state: 'deleting' });
  await denied(upload(client, path));
  await denied(upload(client, `users/${uid}/posts/new/0.jpg`));
  await denied(deleteObject(ref(client, path)));
  assert.equal((await getBytes(ref(other, path))).byteLength, 3);
  assert.equal((await adminStorage().bucket().file(path).exists())[0], true);
});
