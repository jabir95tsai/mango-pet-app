import type { DocumentData, DocumentReference, Firestore, Timestamp } from "firebase-admin/firestore";

export type LeaderboardWrite = {
  ref: DocumentReference;
  ownerUid: string;
  data: DocumentData;
  merge?: boolean;
};

const CHUNK_SIZE = 400;
const validUid = (uid: unknown): uid is string => typeof uid === "string" && !!uid && uid !== "." && uid !== ".." && !uid.includes("/");

/** A stale score is not authority to revive an account. Reading the marker in
 * the same transaction makes deletion and late cron/trigger writes serialize. */
export async function writeActiveLeaderboardEntries(
  db: Firestore, writes: LeaderboardWrite[], removals: DocumentReference[] = [],
): Promise<void> {
  const operations = [
    ...removals.map((ref) => ({ kind: "delete" as const, ref })),
    ...writes.filter((entry) => validUid(entry.ownerUid)).map((entry) => ({ kind: "write" as const, ...entry })),
  ];
  for (let offset = 0; offset < operations.length; offset += CHUNK_SIZE) {
    const chunk = operations.slice(offset, offset + CHUNK_SIZE);
    await db.runTransaction(async (tx) => {
      const owners = [...new Set(chunk.flatMap((entry) => entry.kind === "write" ? [entry.ownerUid] : []))];
      const markers = await Promise.all(owners.map((uid) => tx.get(db.doc(`deletedAccounts/${uid}`))));
      const blocked = new Set(owners.filter((_, index) => markers[index].exists));
      for (const entry of chunk) {
        if (entry.kind === "delete") tx.delete(entry.ref);
        else if (!blocked.has(entry.ownerUid)) {
          if (entry.merge) tx.set(entry.ref, entry.data, { merge: true });
          else tx.set(entry.ref, entry.data);
        }
      }
    });
  }
}

/** Query results may predate account/entry deletion. Update only an existing,
 * still-owned dog entry; merge-set would resurrect a partial document. */
export async function syncExistingDogEntryVisibility(
  db: Firestore, uid: string, refs: DocumentReference[], visibility: string, now: Timestamp,
): Promise<number> {
  if (!validUid(uid)) return 0;
  const scoped = refs.filter((ref) => /^dogLeaderboards\/[^/]+\/entries\/[^/]+$/.test(ref.path));
  let updated = 0;
  for (let offset = 0; offset < scoped.length; offset += CHUNK_SIZE) {
    const chunk = scoped.slice(offset, offset + CHUNK_SIZE);
    updated += await db.runTransaction(async (tx) => {
      if ((await tx.get(db.doc(`deletedAccounts/${uid}`))).exists) return 0;
      const entries = await Promise.all(chunk.map((ref) => tx.get(ref)));
      const eligible = entries.filter((entry) => entry.exists && entry.data()?.ownerUid === uid);
      for (const entry of eligible) tx.update(entry.ref, { ownerVisibility: visibility, lastUpdatedAt: now });
      return eligible.length;
    });
  }
  return updated;
}
