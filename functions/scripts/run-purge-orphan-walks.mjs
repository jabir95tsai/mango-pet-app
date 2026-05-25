#!/usr/bin/env node
/**
 * Purge orphan walks — Admin SDK runner.
 *
 * The spec'd entry point is the `purgeMyOrphanWalks` callable in
 * functions/src/index.ts (deployed for the in-app invocation path). For
 * one-off ops cleanups we run the same logic directly via Admin SDK so
 * we don't need to round-trip through an authenticated browser session
 * just to delete a few stale docs. Audit doc format matches the
 * callable (orphanWalkPurges/{uid}_{ISO}) with `source: "admin-script"`.
 *
 * Definition of orphan (matches the callable):
 *   - walkerUid == target uid
 *   - familyId != null  (personal-mode walks are NEVER auto-deleted)
 *   - familyId NOT in target user's user.familyIds[]
 *
 * Each delete fires recomputeWalkerLeaderboardsOnDelete (the onDelete
 * trigger) which recomputes the leaderboard entry from scratch — no
 * manual entry cleanup required.
 *
 * Prereq: Application Default Credentials on your machine:
 *   gcloud auth application-default login        # one-time
 *
 * Usage:
 *   node scripts/run-purge-orphan-walks.mjs --dry-run --uid=DXWa...   # preview
 *   node scripts/run-purge-orphan-walks.mjs --uid=DXWa...             # REAL — destructive
 *
 * --uid is REQUIRED (no "purge everyone" mode by design — orphan
 * detection is a per-user decision against that user's familyIds).
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

if (!targetUid) {
  console.error("ERROR: --uid=<walkerUid> is required.");
  console.error(
    "       (No 'purge everyone' mode — orphan detection is per-user.)",
  );
  process.exit(1);
}

const BATCH_LIMIT = 400;

async function deleteRefsInBatches(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const slice = refs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const ref of slice) batch.delete(ref);
    await batch.commit();
  }
}

async function run() {
  const mode = dryRun ? "DRY-RUN" : "REAL";
  console.log(
    `[${mode}] purge orphan walks — project=${projectId} uid=${targetUid}`,
  );

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    console.error(`ERROR: user ${targetUid} not found.`);
    process.exit(1);
  }
  const familyIds = new Set(
    (userSnap.data()?.familyIds ?? []).filter(Boolean),
  );
  console.log(`Current familyIds: ${JSON.stringify(Array.from(familyIds))}`);

  const walksSnap = await db
    .collection("walks")
    .where("walkerUid", "==", targetUid)
    .get();
  console.log(`Total walks with walkerUid=${targetUid}: ${walksSnap.size}`);

  const orphans = [];
  let keptPersonal = 0;
  let keptCurrentFamily = 0;
  for (const d of walksSnap.docs) {
    const w = d.data();
    const fid = w.familyId;
    if (fid == null) {
      keptPersonal++;
      continue;
    }
    if (typeof fid === "string" && familyIds.has(fid)) {
      keptCurrentFamily++;
      continue;
    }
    orphans.push({
      walkId: d.id,
      familyId: typeof fid === "string" ? fid : String(fid),
      startedAt:
        w.startedAt instanceof Timestamp
          ? w.startedAt.toDate().toISOString()
          : null,
      ref: d.ref,
    });
  }

  console.log(
    `Orphans found: ${orphans.length} ` +
      `(kept: ${keptPersonal} personal, ${keptCurrentFamily} current-family)`,
  );
  for (const o of orphans) {
    console.log(
      `  ${o.walkId}  familyId=${o.familyId}  startedAt=${o.startedAt}`,
    );
  }

  if (!dryRun && orphans.length > 0) {
    await deleteRefsInBatches(orphans.map((o) => o.ref));
    console.log(`\nDeleted ${orphans.length} orphan walks.`);
    console.log(
      "Each delete fires recomputeWalkerLeaderboardsOnDelete — wait ~1-2s " +
        "before checking the leaderboard.",
    );
  }

  // Audit doc — same shape as the callable's, with source=admin-script.
  const isoNow = new Date().toISOString();
  await db.doc(`orphanWalkPurges/${targetUid}_${isoNow}`).set({
    uid: targetUid,
    ranAt: Timestamp.now(),
    dryRun,
    familyIds: Array.from(familyIds),
    keptPersonal,
    keptCurrentFamily,
    orphans: orphans.map(({ ref, ...rest }) => rest),
    source: "admin-script",
  });

  console.log(`\nAudit doc: orphanWalkPurges/${targetUid}_${isoNow}`);
  console.log(`[${mode}] done.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
