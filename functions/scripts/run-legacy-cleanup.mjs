#!/usr/bin/env node
/**
 * Legacy path cleanup — Admin SDK runner.
 *
 * The spec'd entry point is the `cleanupLegacyPaths` callable in
 * functions/src/index.ts (deployed for any future programmatic admin
 * re-run). For this one-off cleanup we run the same logic directly
 * via Admin SDK to avoid setting up an admin custom claim + ID-token
 * exchange for a single ops run. Audit doc format is identical, with
 * `source: "admin-script"` to distinguish from callable invocations.
 *
 * Spec: docs/features/legacy-path-cleanup.md (Phase 2, Steps B + C)
 *
 * Prereq: Application Default Credentials on your machine:
 *   gcloud auth application-default login        # one-time
 *
 * Usage:
 *   node scripts/run-legacy-cleanup.mjs --dry-run                # safe: counts only
 *   node scripts/run-legacy-cleanup.mjs --dry-run --uid=ABC123   # one user, counts only
 *   node scripts/run-legacy-cleanup.mjs                          # REAL — destructive (all users)
 *   node scripts/run-legacy-cleanup.mjs --uid=ABC123             # REAL — one user only
 *
 * Always do `--dry-run` first. Real runs cannot be rolled back; the
 * audit doc `legacyCleanups/{ISO}` is the only record afterwards.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mango-pet-app";

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targetUid = args.find((a) => a.startsWith("--uid="))?.split("=")[1];

const BATCH_LIMIT = 400;

async function deleteRefsInBatches(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const slice = refs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const ref of slice) batch.delete(ref);
    await batch.commit();
  }
}

// Mirrors cleanupLegacyForUid() in functions/src/index.ts. Keep in sync
// if the schema ever grows new legacy paths.
async function cleanupOne(uid) {
  const counts = {
    uid,
    pets: 0,
    healthRecords: 0,
    walks: 0,
    reminders: 0,
    expenses: 0,
  };

  // healthRecords first (nested under each pet) so we never leave
  // orphan sub-collections that would pollute collectionGroup queries.
  const petsSnap = await db.collection(`users/${uid}/pets`).get();
  for (const petDoc of petsSnap.docs) {
    const hrSnap = await db
      .collection(`users/${uid}/pets/${petDoc.id}/healthRecords`)
      .get();
    if (!dryRun && hrSnap.size > 0) {
      await deleteRefsInBatches(hrSnap.docs.map((d) => d.ref));
    }
    counts.healthRecords += hrSnap.size;
  }
  if (!dryRun && petsSnap.size > 0) {
    await deleteRefsInBatches(petsSnap.docs.map((d) => d.ref));
  }
  counts.pets = petsSnap.size;

  const walksSnap = await db.collection(`users/${uid}/walks`).get();
  if (!dryRun && walksSnap.size > 0) {
    await deleteRefsInBatches(walksSnap.docs.map((d) => d.ref));
  }
  counts.walks = walksSnap.size;

  const remindersSnap = await db.collection(`users/${uid}/reminders`).get();
  if (!dryRun && remindersSnap.size > 0) {
    await deleteRefsInBatches(remindersSnap.docs.map((d) => d.ref));
  }
  counts.reminders = remindersSnap.size;

  const expensesSnap = await db.collection(`users/${uid}/expenses`).get();
  if (!dryRun && expensesSnap.size > 0) {
    await deleteRefsInBatches(expensesSnap.docs.map((d) => d.ref));
  }
  counts.expenses = expensesSnap.size;

  return counts;
}

async function run() {
  const mode = dryRun ? "DRY-RUN" : "REAL";
  console.log(`[${mode}] cleanup legacy paths — project=${projectId}`);

  let uids;
  if (targetUid) {
    uids = [targetUid];
    console.log(`Target: single uid=${targetUid}`);
  } else {
    const usersSnap = await db.collection("users").get();
    uids = usersSnap.docs.map((d) => d.id);
    console.log(`Target: all ${uids.length} users`);
  }

  const counts = [];
  let uidsFailed = 0;
  for (const uid of uids) {
    try {
      const c = await cleanupOne(uid);
      counts.push(c);
      const total =
        c.pets + c.healthRecords + c.walks + c.reminders + c.expenses;
      if (total > 0) {
        console.log(
          `  ${uid}: pets=${c.pets} healthRecords=${c.healthRecords} ` +
            `walks=${c.walks} reminders=${c.reminders} expenses=${c.expenses}`,
        );
      }
    } catch (err) {
      uidsFailed++;
      console.error(`  ${uid} FAILED:`, err?.message ?? err);
    }
  }

  const totals = counts.reduce(
    (acc, c) => ({
      pets: acc.pets + c.pets,
      healthRecords: acc.healthRecords + c.healthRecords,
      walks: acc.walks + c.walks,
      reminders: acc.reminders + c.reminders,
      expenses: acc.expenses + c.expenses,
    }),
    { pets: 0, healthRecords: 0, walks: 0, reminders: 0, expenses: 0 },
  );

  console.log(
    `\nTotals: pets=${totals.pets} healthRecords=${totals.healthRecords} ` +
      `walks=${totals.walks} reminders=${totals.reminders} expenses=${totals.expenses}`,
  );
  console.log(`Users processed: ${uids.length} (failed: ${uidsFailed})`);

  const auditId = new Date().toISOString().replace(/[:.]/g, "-");
  await db.collection("legacyCleanups").doc(auditId).set({
    cleanedAt: Timestamp.now(),
    reason: "schema-cleanup",
    mode: dryRun ? "dryRun" : "real",
    invokedBy: "admin-sdk",
    source: "admin-script",
    targetUid: targetUid ?? null,
    uidsProcessed: uids.length,
    uidsFailed,
    totals,
    counts: counts.filter(
      (c) =>
        c.pets + c.healthRecords + c.walks + c.reminders + c.expenses > 0,
    ),
  });

  console.log(`\nAudit doc: legacyCleanups/${auditId}`);
  console.log(`[${mode}] done.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
