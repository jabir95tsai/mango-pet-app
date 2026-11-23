// Ownership/scope fields are immutable on client updates, and restaurant
// writes are shape-checked (security review 2026-11-23).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./emulator.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const s = require('firebase/firestore');
s.setLogLevel('silent');
const apps = [], clients = [];
function client(uid, provider = 'password') {
  const app = initializeApp({ projectId: 'demo-mango-security' }, `own-${apps.length}`);
  const c = s.getFirestore(app);
  s.connectFirestoreEmulator(c, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),
    { mockUserToken: { sub: uid, firebase: { sign_in_provider: provider } } });
  apps.push(app); clients.push(c); return c;
}
const owner = client('own-owner'), member = client('own-member'), guest = client('own-guest', 'anonymous');
const deny = p => assert.rejects(p, { code: 'permission-denied' });

before(async () => {
  await db.doc('families/own-family').set({ memberUids: ['own-owner', 'own-member'] });
  await db.doc('families/own-victim').set({ memberUids: ['own-victim'] });
  await db.doc('pets/own-pet').set({ ownerUid: 'own-owner', familyId: 'own-family', name: 'A' });
  await db.doc('reminders/own-rem').set({ createdByUid: 'own-owner', familyId: null, title: 'A' });
  await db.doc('reminders/own-frem').set({ createdByUid: 'own-owner', familyId: 'own-family', title: 'A' });
  await db.doc('expenses/own-exp').set({ payerUid: 'own-owner', familyId: null, amount: 1 });
  await db.doc('restaurants/own-r').set({ name: 'R', submittedByUid: 'own-owner' });
});
after(async () => { await Promise.all(clients.map(s.terminate)); await Promise.all(apps.map(deleteApp)); await db.terminate(); });

test('family member cannot re-own a family pet, but can still edit it', async () => {
  const ref = s.doc(member, 'pets/own-pet');
  await deny(s.updateDoc(ref, { ownerUid: 'own-member', familyId: null }));
  await deny(s.updateDoc(ref, { ownerUid: 'own-member' }));
  await s.updateDoc(ref, { name: 'B' });
});

test('reminders cannot be moved into another family or re-attributed', async () => {
  await deny(s.updateDoc(s.doc(owner, 'reminders/own-rem'), { familyId: 'own-victim' }));
  await deny(s.updateDoc(s.doc(member, 'reminders/own-frem'), { familyId: 'own-victim' }));
  await deny(s.updateDoc(s.doc(member, 'reminders/own-frem'), { createdByUid: 'own-member' }));
  await s.updateDoc(s.doc(member, 'reminders/own-frem'), { title: 'B' });
});

test('expenses cannot be moved into another family or re-attributed', async () => {
  const ref = s.doc(owner, 'expenses/own-exp');
  await deny(s.updateDoc(ref, { familyId: 'own-victim' }));
  await deny(s.updateDoc(ref, { payerUid: 'own-member' }));
  await s.updateDoc(ref, { amount: 2 });
});

const restaurant = uid => ({
  name: 'Cafe', address: 'Taipei', location: { lat: 25, lng: 121 }, petFriendlyLevel: 'high',
  averageRating: 0, reviewCount: 0, submittedByUid: uid, verified: false, createdAt: s.serverTimestamp(),
});
test('restaurant create is shape-checked and closed to guests', async () => {
  await s.addDoc(s.collection(owner, 'restaurants'), restaurant('own-owner'));
  await deny(s.addDoc(s.collection(guest, 'restaurants'), restaurant('own-guest')));
  await deny(s.addDoc(s.collection(owner, 'restaurants'), { ...restaurant('own-owner'), verified: true }));
  await deny(s.addDoc(s.collection(owner, 'restaurants'), { ...restaurant('own-owner'), extra: 'x' }));
  await deny(s.addDoc(s.collection(owner, 'restaurants'), { ...restaurant('own-owner'), name: 'x'.repeat(201) }));
});

const review = uid => ({
  restaurantId: 'own-r', authorUid: uid, authorName: 'N', authorPhotoURL: null,
  rating: 5, text: 'good', photoURLs: [], createdAt: s.serverTimestamp(),
});
test('review create is shape-checked and author cannot re-attribute', async () => {
  const col = s.collection(owner, 'restaurants/own-r/reviews');
  const ref = await s.addDoc(col, review('own-owner'));
  await deny(s.addDoc(s.collection(guest, 'restaurants/own-r/reviews'), review('own-guest')));
  await deny(s.addDoc(col, { ...review('own-owner'), rating: 6 }));
  await deny(s.addDoc(col, { ...review('own-owner'), restaurantId: 'other' }));
  await deny(s.updateDoc(ref, { authorUid: 'own-member' }));
  await s.updateDoc(ref, { text: 'edited' });
});
