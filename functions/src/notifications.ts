/** Notification inbox writers (docs/features/ios-notification-center.md).
 * Inbox only — no push. Every write re-checks the recipient inside the same
 * transaction: profile exists, no deletion fence, actor not blocked. */
import { FieldValue, type DocumentData, type Firestore, type Transaction } from "firebase-admin/firestore";
import { isFirestoreDocumentId } from "./document-id";
import { findObjectionableTerm } from "./moderation-helpers";

const COMMENT_PREVIEW_MAX = 80;
const REACTION_ACTORS_SHOWN = 3;

async function recipientAccepts(tx: Transaction, db: Firestore, uid: string, actorUid: string): Promise<boolean> {
  const [user, fence] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(db.doc(`deletedAccounts/${uid}`))]);
  if (!user.exists || fence.exists) return false;
  return !((user.data()?.blockedUids ?? []) as string[]).includes(actorUid);
}

async function readPostAuthor(db: Firestore, postId: string): Promise<string | null> {
  const post = await db.doc(`posts/${postId}`).get();
  const authorUid = post.data()?.authorUid;
  return isFirestoreDocumentId(authorUid) ? authorUid : null;
}

export async function writeCommentNotification(db: Firestore, postId: string, commentId: string, comment: DocumentData): Promise<boolean> {
  const actorUid = comment.authorUid;
  const text = typeof comment.text === "string" ? comment.text : "";
  // Objectionable comments are auto-hidden by onCommentCreated; never surface them.
  if (!isFirestoreDocumentId(actorUid) || findObjectionableTerm(text)) return false;
  const authorUid = await readPostAuthor(db, postId);
  if (!authorUid || authorUid === actorUid) return false;
  return db.runTransaction(async (tx) => {
    if (!(await recipientAccepts(tx, db, authorUid, actorUid))) return false;
    tx.set(db.doc(`users/${authorUid}/notifications/comment_${commentId}`), {
      type: "comment",
      actorUids: [actorUid],
      actorCount: 1,
      postId,
      commentId,
      commentPreview: Array.from(text.replace(/\s+/g, " ").trim()).slice(0, COMMENT_PREVIEW_MAX).join(""),
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/** Rebuild reaction_{postId} from the reactions subcollection, so duplicate or
 * out-of-order create/delete events converge. `addedUid` bumps createdAt only
 * when that actor is actually listed (not the author, not blocked). */
export async function syncReactionNotification(db: Firestore, postId: string, addedUid: string | null): Promise<void> {
  const authorUid = await readPostAuthor(db, postId);
  if (!authorUid) return;
  const ref = db.doc(`users/${authorUid}/notifications/reaction_${postId}`);
  await db.runTransaction(async (tx) => {
    const [user, fence, existing, reactions] = await Promise.all([
      tx.get(db.doc(`users/${authorUid}`)),
      tx.get(db.doc(`deletedAccounts/${authorUid}`)),
      tx.get(ref),
      tx.get(db.collection(`posts/${postId}/reactions`)),
    ]);
    if (!user.exists || fence.exists) return;
    const blocked = new Set((user.data()?.blockedUids ?? []) as string[]);
    const actors = reactions.docs
      .filter((d) => d.id !== authorUid && !blocked.has(d.id))
      .sort((a, b) => (b.data().reactedAt?.toMillis?.() ?? 0) - (a.data().reactedAt?.toMillis?.() ?? 0))
      .map((d) => d.id);
    if (actors.length === 0) {
      if (existing.exists) tx.delete(ref);
      return;
    }
    const touch = addedUid !== null && actors.includes(addedUid);
    if (!touch && !existing.exists) return; // never create an un-timestamped row
    tx.set(ref, {
      type: "reaction",
      actorUids: actors.slice(0, REACTION_ACTORS_SHOWN),
      actorCount: actors.length,
      postId,
      ...(touch ? { createdAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });
  });
}

export async function writeFriendRequestNotification(db: Firestore, recipientUid: string, requestId: string, request: DocumentData): Promise<boolean> {
  const actorUid = request.fromUid;
  if (!isFirestoreDocumentId(actorUid) || actorUid === recipientUid) return false;
  return db.runTransaction(async (tx) => {
    if (!(await recipientAccepts(tx, db, recipientUid, actorUid))) return false;
    tx.set(db.doc(`users/${recipientUid}/notifications/friendRequest_${requestId}`), {
      type: "friendRequest",
      actorUids: [actorUid],
      actorCount: 1,
      friendRequestId: requestId,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}
