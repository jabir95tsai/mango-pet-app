#!/usr/bin/env node
// Repair only wire numeric types, never counter values. ADC for production;
// explicit --post=ID allowlist required. Default dry-run, --commit to apply.
import { pathToFileURL } from 'node:url';

export const EMOJIS = ['❤️', '😂', '🐶', '👍', '🎉'];

export function normalizationPlan(post, reactions) {
  const fields = post.fields?.reactionCounts?.mapValue?.fields;
  if (!fields || Object.keys(fields).length !== EMOJIS.length
    || Object.keys(fields).some(key => !EMOJIS.includes(key))) throw new Error('Invalid counter keys');
  const actual = Object.fromEntries(EMOJIS.map(key => [key, 0]));
  for (const reaction of reactions) {
    const uid = reaction.fields?.uid?.stringValue;
    const emoji = reaction.fields?.emoji?.stringValue;
    if (!uid || reaction.name.split('/').at(-1) !== uid || !EMOJIS.includes(emoji)) {
      throw new Error('Invalid reaction document');
    }
    actual[emoji]++;
  }
  const normalized = {};
  let changedFields = 0;
  for (const emoji of EMOJIS) {
    const wire = fields[emoji];
    const integer = Object.hasOwn(wire, 'integerValue');
    const double = Object.hasOwn(wire, 'doubleValue');
    if (integer === double) throw new Error('Invalid counter type');
    const value = Number(integer ? wire.integerValue : wire.doubleValue);
    if (!Number.isSafeInteger(value) || value < 0 || value !== actual[emoji]) {
      throw new Error('Counter is fractional, unsafe, negative or differs from reactions');
    }
    normalized[emoji] = { integerValue: String(value) };
    if (double) changedFields++;
  }
  if (!post.updateTime) throw new Error('Missing document update time');
  return {
    changedFields,
    write: {
      update: { name: post.name, fields: { reactionCounts: { mapValue: { fields: normalized } } } },
      updateMask: { fieldPaths: ['reactionCounts'] },
      currentDocument: { updateTime: post.updateTime },
    },
  };
}

// request is injected for authenticated production use and emulator regressions.
// All reads and the type-only update share one server transaction. Concurrent
// edits abort instead of overwriting; interrupted runs can safely be rerun.
export async function normalizePost(request, projectId, postId, commit = false) {
  // This targeted migration accepts generated IDs, not arbitrary URL segments.
  if (!/^[a-z][a-z0-9-]+$/.test(projectId) || !/^[A-Za-z0-9_-]{1,1500}$/.test(postId)) {
    throw new Error('Invalid target');
  }
  const database = `projects/${projectId}/databases/(default)`;
  const name = `${database}/documents/posts/${postId}`;
  const { transaction } = await request('POST', `${database}/documents:beginTransaction`, {
    options: commit ? { readWrite: {} } : { readOnly: {} },
  });
  let completed = false;
  try {
    // batchGet carries transaction bytes in JSON; the emulator's getDocument
    // query-string decoder does not support BYTE_STRING transaction values.
    const snapshots = await request('POST', `${database}/documents:batchGet`, {
      documents: [name], transaction, mask: { fieldPaths: ['reactionCounts'] },
    });
    const post = snapshots.find(row => row.found)?.found;
    if (!post) throw new Error('Target post no longer exists');
    const rows = await request('POST', `${name}:runQuery`, {
      transaction,
      structuredQuery: { from: [{ collectionId: 'reactions' }],
        select: { fields: [{ fieldPath: 'uid' }, { fieldPath: 'emoji' }] } },
    });
    const reactions = rows.flatMap(row => row.document ? [row.document] : []);
    const plan = normalizationPlan(post, reactions);
    if (commit && plan.changedFields) {
      await request('POST', `${database}/documents:commit`, { transaction, writes: [plan.write] });
      completed = true;
      const saved = await request('GET', `${name}?mask.fieldPaths=reactionCounts`);
      if (Object.values(saved.fields.reactionCounts.mapValue.fields).some(v => !Object.hasOwn(v, 'integerValue'))) {
        throw new Error('Post-write wire type verification failed');
      }
    }
    return { changedFields: plan.changedFields, applied: completed };
  } finally {
    if (!completed) await request('POST', `${database}/documents:rollback`, { transaction });
  }
}

export function restTransport(baseUrl, tokenProvider) {
  return async (method, resource, body) => {
    const response = await fetch(`${baseUrl}/v1/${resource}`, {
      method, signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${await tokenProvider()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(`Firestore request failed: ${data.error?.status ?? response.status}`);
      error.code = data.error?.status ?? response.status; throw error;
    }
    return data;
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), projectId = args.find(a => a.startsWith('--project='))?.slice(10);
  const postIds = [...new Set(args.filter(a => a.startsWith('--post=')).map(a => a.slice(7)))];
  if (!projectId || !postIds.length) throw new Error('Specify --project=ID and --post=ID (repeatable); optional --commit');
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (host && (!/^127\.0\.0\.1:\d+$/.test(host) || !projectId.startsWith('demo-'))) throw new Error('Unsafe emulator target');
  const { applicationDefault } = await import('firebase-admin/app');
  const credential = host ? null : applicationDefault();
  const request = restTransport(host ? `http://${host}` : 'https://firestore.googleapis.com',
    async () => host ? 'owner' : (await credential.getAccessToken()).access_token);
  const result = { mode: args.includes('--commit') ? 'commit' : 'dry-run', checked: 0, changedPosts: 0, changedFields: 0 };
  for (const postId of postIds) {
    const normalized = await normalizePost(request, projectId, postId, args.includes('--commit'));
    result.checked++; result.changedFields += normalized.changedFields;
    if (normalized.applied) result.changedPosts++;
  }
  console.log(JSON.stringify(result));
}
