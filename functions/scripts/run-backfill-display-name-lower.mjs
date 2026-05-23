#!/usr/bin/env node
/**
 * Display-name-lower backfill — Admin SDK runner.
 *
 * The spec'd entry point is the `backfillDisplayNameLower` callable in
 * functions/src/index.ts (deployed for any future programmatic admin
 * re-run). For this one-off backfill we run the same logic directly
 * via Admin SDK to avoid setting up an admin custom claim + ID-token
 * exchange for a single ops run. Audit doc format is identical, with
 * `source: "admin-script"` to distinguish from callable invocations.
 *
 * Spec: docs/features/friends-search-lowercase.md (Phase 2)
 * Same pattern as functions/scripts/run-legacy-cleanup.mjs.
 *
 * Prereq: Application Default Credentials on your machine:
 *   gcloud auth application-default login        # one-time
 *
 * Lives under functions/scripts/ (not scripts/) because firebase-admin
 * is only declared in functions/package.json — Node ESM resolution
 * would fail from the project-root scripts/ dir.
 *
 * Usage (run from project root):
 *   node functions/scripts/run-backfill-display-name-lower.mjs --dry-run   # safe: count only
 *   node functions/scripts/run-backfill-display-name-lower.mjs             # REAL — writes displayNameLower
 *
 * Always do `--dry-run` first. Real run only writes the missing field;
 * idempotent — re-running shows missing=0.
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

const BATCH_LIMIT = 400;

function computeDisplayNameLower(name) {
  return String(name ?? "").trim().toLowerCase();
}

async function run() {
  const mode = dryRun ? "DRY-RUN" : "REAL";
  console.log(`[${mode}] backfill displayNameLower — project=${projectId}`);

  const allUsers = await db.collection("users").get();
  const total = allUsers.size;
  console.log(`Scanning ${total} users`);

  // Mirrors backfillDisplayNameLower() in functions/src/index.ts. Keep
  // in sync.
  const pending = [];
  for (const doc of allUsers.docs) {
    const data = doc.data();
    const existing = data.displayNameLower;
    if (typeof existing === "string" && existing.length > 0) continue;
    const value = computeDisplayNameLower(data.displayName);
    pending.push({ ref: doc.ref, value, uid: doc.id, displayName: data.displayName });
  }
  const missing = pending.length;
  console.log(`Missing: ${missing} (already-set: ${total - missing})`);

  // Echo a sample so the operator can sanity-check the lowercasing
  // before approving the real run.
  const sample = pending.slice(0, 5);
  if (sample.length > 0) {
    console.log("Sample of pending writes (first 5):");
    for (const { uid, displayName, value } of sample) {
      console.log(`  ${uid}: ${JSON.stringify(displayName)} -> ${JSON.stringify(value)}`);
    }
  }

  let written = 0;
  if (!dryRun) {
    for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
      const slice = pending.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const { ref, value } of slice) {
        batch.update(ref, { displayNameLower: value });
      }
      await batch.commit();
      written += slice.length;
    }
  }

  const counts = { total, missing, written };
  console.log(`\nCounts: ${JSON.stringify(counts)}`);

  const auditId = new Date().toISOString().replace(/[:.]/g, "-");
  await db.collection("displayNameLowerBackfills").doc(auditId).set({
    ranAt: Timestamp.now(),
    mode: dryRun ? "dryRun" : "real",
    invokedBy: "admin-sdk",
    source: "admin-script",
    counts,
  });

  console.log(`\nAudit doc: displayNameLowerBackfills/${auditId}`);
  console.log(`[${mode}] done.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
