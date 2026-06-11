#!/usr/bin/env node
/**
 * One-time migration — security-hardening #2.
 * Move email + fcmTokens out of the world-readable users/{uid} public doc
 * into the owner-only users/{uid}/private/contact subdoc, then strip them
 * from the public doc.
 *
 * Idempotent + two-phase-safe:
 *   - COPY phase always runs: merges email/fcmTokens into private/contact
 *     (only fields present on the public doc; never clobbers a richer private
 *     doc — uses arrayUnion-free merge of the public snapshot).
 *   - STRIP phase (deletes the public fields) runs ONLY with --strip.
 * Run order for a zero-downtime rollout:
 *   1. deploy rules (private subdoc) + functions (dual-read) + client first.
 *   2. node migrate-user-pii.mjs              # dry-run, shows counts
 *   3. node migrate-user-pii.mjs --commit     # COPY to private (no strip yet)
 *   4. (verify push still works)
 *   5. node migrate-user-pii.mjs --commit --strip   # remove public PII
 *
 * Prereq: ADC (gcloud auth application-default login).
 * Usage:
 *   node migrate-user-pii.mjs                 # dry-run (default)
 *   node migrate-user-pii.mjs --commit        # copy to private
 *   node migrate-user-pii.mjs --commit --strip  # copy + strip public fields
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mango-pet-app";
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const strip = args.includes("--strip");

async function run() {
  const snap = await db.collection("users").get();
  let scanned = 0;
  let needsCopy = 0;
  let copied = 0;
  let stripped = 0;
  const sample = [];

  for (const doc of snap.docs) {
    scanned++;
    const d = doc.data();
    const hasEmail = "email" in d;
    const hasTokens = "fcmTokens" in d;
    if (!hasEmail && !hasTokens) continue;
    needsCopy++;

    const privateRef = doc.ref.collection("private").doc("contact");
    const payload = {};
    if (hasEmail) payload.email = d.email ?? null;
    if (hasTokens) payload.fcmTokens = (d.fcmTokens ?? []).filter(Boolean);

    if (sample.length < 10) {
      sample.push({
        uid: doc.id,
        email: hasEmail ? (d.email ? "<present>" : null) : "(absent)",
        tokenCount: hasTokens ? (d.fcmTokens ?? []).length : "(absent)",
      });
    }

    if (commit) {
      // COPY: merge into private/contact. merge:true so re-running is safe
      // and a client-written private doc (newer tokens) isn't lost — but to
      // avoid overwriting newer private tokens with stale public ones, only
      // set fcmTokens when the private doc doesn't already have a non-empty
      // set.
      const existingPriv = (await privateRef.get()).data() ?? {};
      const mergePayload = { ...payload };
      if (
        hasTokens &&
        Array.isArray(existingPriv.fcmTokens) &&
        existingPriv.fcmTokens.length > 0
      ) {
        delete mergePayload.fcmTokens; // keep the newer private set
      }
      if (
        hasEmail &&
        existingPriv.email != null &&
        existingPriv.email !== ""
      ) {
        // keep an already-set private email (it's the same value anyway)
        delete mergePayload.email;
      }
      if (Object.keys(mergePayload).length > 0) {
        await privateRef.set(mergePayload, { merge: true });
      }
      copied++;

      if (strip) {
        const stripPayload = {};
        if (hasEmail) stripPayload.email = FieldValue.delete();
        if (hasTokens) stripPayload.fcmTokens = FieldValue.delete();
        await doc.ref.update(stripPayload);
        stripped++;
      }
    }
  }

  console.log(
    `migrate-user-pii ${commit ? (strip ? "[COMMIT+STRIP]" : "[COMMIT copy]") : "[DRY-RUN]"}`,
  );
  console.log(`  scanned=${scanned} needsCopy=${needsCopy} copied=${copied} stripped=${stripped}`);
  console.log("  sample:", JSON.stringify(sample, null, 2));

  if (commit) {
    const isoNow = new Date().toISOString();
    await db.doc(`piiMigrations/${isoNow}`).set({
      ranAt: FieldValue.serverTimestamp(),
      strip,
      scanned,
      needsCopy,
      copied,
      stripped,
    });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
