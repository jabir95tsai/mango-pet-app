const assert = require('node:assert/strict');

// Never run fixtures against a real project, even with ambient credentials.
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
assert.equal(process.env.GCLOUD_PROJECT, 'demo-mango-security');
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-mango-security' });

const functions = require('../lib/index.js');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const db = getFirestore();
const auth = (uid, provider = 'password') => ({
  uid, token: { sub: uid, firebase: { sign_in_provider: provider } },
});
module.exports = { db, Timestamp, functions, auth };
