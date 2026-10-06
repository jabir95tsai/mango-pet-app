import type { Firestore, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/** Read the server-owned deletion fence in the SAME transaction as writes.
 * A profile may legitimately be missing on first native login; only this
 * checkpoint is deletion authority. Every affected account must be checked. */
export async function assertAccountsActive(tx: Transaction, db: Firestore, uids: string[]): Promise<void> {
  const checkpoints = await Promise.all([...new Set(uids)].map((uid) =>
    tx.get(db.doc(`deletedAccounts/${uid}`))));
  if (checkpoints.some((snapshot) => snapshot.exists)) {
    throw new HttpsError("failed-precondition", "Account deletion is in progress or complete");
  }
}

/** Each batch/chunk gets its own fence read; an earlier preflight is not
 * sufficient when deletion starts between queries or between chunks. */
export function withActiveAccounts<T>(
  db: Firestore, uids: string[], write: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.runTransaction(async (tx) => {
    await assertAccountsActive(tx, db, uids);
    return write(tx);
  });
}
