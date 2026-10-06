#!/usr/bin/env node
/**
 * R03 contact migration. Compile functions first. ADC or emulator credentials.
 * --commit mutates; --strip also removes public fields in the same transaction.
 * Default: counts-only dry run. Deploy the public-PII guard before stripping.
 * Safe to rerun after interruption; never logs tokens, emails or account IDs.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldPath, FieldValue } from "firebase-admin/firestore";
import contact from "../lib/user-contact.js";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mango-pet-app";
initializeApp({ ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }), projectId });
const db = getFirestore();
const args = process.argv.slice(2);
const commit = args.includes("--commit"), strip = args.includes("--strip");
let cursor = args.find((arg) => arg.startsWith("--after="))?.slice("--after=".length);
if (strip && !commit) throw new Error("--strip requires --commit");
const totals = { scanned: 0, needsCopy: 0, copied: 0, stripped: 0 };

async function run() {
  while (true) {
    let query = db.collection("users").orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      totals.scanned++;
      const data = doc.data();
      if (!("email" in data) && !("fcmTokens" in data)) continue;
      totals.needsCopy++;
      if (commit) {
        const result = await contact.migrateUserContact(db, doc.id, strip);
        if (result.changed) { totals.copied++; if (strip) totals.stripped++; }
      }
    }
    cursor = page.docs.at(-1).id;
  }
  console.log(JSON.stringify({ mode: commit ? (strip ? "commit-strip" : "commit-copy") : "dry-run", ...totals }));
  if (commit) await db.collection("piiMigrations").add({ ranAt: FieldValue.serverTimestamp(), strip, ...totals });
}
run().catch((error) => { console.error("Contact migration failed:", error.code ?? "unknown"); process.exitCode = 1; });
