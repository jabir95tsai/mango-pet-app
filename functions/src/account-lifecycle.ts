import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;
type StorageFile = ReturnType<Bucket["file"]>;
export const confirmationHash = (value: string) => createHash("sha256").update(value).digest("hex");
const validSegment = (value: unknown): value is string => typeof value === "string"
  && value.length > 0 && value !== "." && value !== ".." && !value.includes("/")
  && Buffer.byteLength(value, "utf8") <= 1500;
function knownStorageResource(relative: string): { collection: string; id: string } | null {
  const match = /^(pets)\/([^/]+)\/avatar\.[^/]+$/.exec(relative)
    ?? /^(posts)\/([^/]+)\/\d+\.[^/]+$/.exec(relative)
    ?? /^(walks)\/([^/]+)\/photos\/\d+-\d+\.[^/]+$/.exec(relative);
  return match && validSegment(match[2]) ? { collection: match[1], id: match[2] } : null;
}

async function deleteListedGeneration(file: StorageFile) {
  const generation = file.metadata.generation;
  if (generation == null) throw new Error("Storage listing omitted object generation");
  try {
    const [current] = await file.getMetadata();
    if (String(current.generation) !== String(generation)) return false;
    await file.delete({ ignoreNotFound: true, ifGenerationMatch: generation });
    return true;
  } catch (error) {
    const code = Number((error as { code?: number }).code);
    if (code === 404 || code === 412) return false;
    throw error;
  }
}

/** The marker is server-only. Create it atomically with confirmation, and hold
 * a lease longer than the callable's 300s lifetime to serialize cascades. */
export async function beginAccountDeletion(db: Firestore, uid: string, confirmation: unknown) {
  if (typeof confirmation !== "string") throw new HttpsError("invalid-argument", "Display name confirmation required");
  const name = confirmation.trim();
  const ref = db.doc(`deletedAccounts/${uid}`);
  const userRef = db.doc(`users/${uid}`);
  let authName = "";
  if (!(await userRef.get()).exists && !(await ref.get()).exists) {
    authName = (await getAuth().getUser(uid)).displayName ?? "";
  }
  const leaseId = randomUUID();
  return db.runTransaction(async (tx) => {
    const [user, checkpoint] = await Promise.all([tx.get(userRef), tx.get(ref)]);
    const previous = checkpoint.data();
    if (previous) {
      if (previous.confirmationHash !== confirmationHash(name)) throw new HttpsError("failed-precondition", "displayName confirmation does not match");
      if (previous.state === "complete" || previous.state === "finalizing") return { state: previous.state as string, summary: previous.summary, leaseId };
      if (previous.leaseUntil?.toMillis() > Date.now()) throw new HttpsError("aborted", "Account deletion is already running; retry later");
    } else if (String(user.exists ? user.data()?.displayName ?? "" : authName).trim() !== name) {
      throw new HttpsError("failed-precondition", "displayName confirmation does not match");
    }
    tx.set(ref, {
      uid, state: "deleting", confirmationHash: confirmationHash(name), leaseId,
      leaseUntil: Timestamp.fromMillis(Date.now() + 360_000),
      startedAt: previous?.startedAt ?? FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { state: "deleting", summary: previous?.summary, leaseId };
  });
}

export async function releaseAccountDeletionLease(db: Firestore, uid: string, leaseId: string) {
  const ref = db.doc(`deletedAccounts/${uid}`);
  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (current.data()?.leaseId !== leaseId) return;
    tx.update(ref, { leaseId: FieldValue.delete(), leaseUntil: FieldValue.delete() });
  });
}

export async function claimAccountDeletion(db: Firestore, uid: string) {
  const ref = db.doc(`deletedAccounts/${uid}`);
  return db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data();
    if (!current || current.state !== "deleting") return null;
    if (current.uid !== uid || !/^[a-f0-9]{64}$/.test(current.confirmationHash ?? "")) {
      throw new HttpsError("failed-precondition", "Invalid account deletion checkpoint");
    }
    if (current.leaseUntil?.toMillis() > Date.now()) throw new HttpsError("aborted", "Account deletion is already running");
    const leaseId = randomUUID();
    tx.update(ref, { leaseId, leaseUntil: Timestamp.fromMillis(Date.now() + 360_000) });
    return leaseId;
  });
}

export async function checkAccountDeletionLease(db: Firestore, uid: string, leaseId: string, tx?: FirebaseFirestore.Transaction) {
  const ref = db.doc(`deletedAccounts/${uid}`);
  const current = (await (tx ? tx.get(ref) : ref.get())).data();
  if (current?.state !== "deleting" || current?.leaseId !== leaseId || !(current.leaseUntil?.toMillis() > Date.now())) {
    throw new HttpsError("aborted", "Account deletion lease expired or changed");
  }
}

export async function markAccountDeletionFinalizing(db: Firestore, uid: string, leaseId: string, summary: object) {
  await db.runTransaction(async (tx) => {
    await checkAccountDeletionLease(db, uid, leaseId, tx);
    tx.update(db.doc(`deletedAccounts/${uid}`), {
      state: "finalizing", reason: "user-initiated", summary, updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/** Delete only the explicitly supplied owner namespace. The caller chooses a
 * canonical prefix; arbitrary download URLs are never deletion authority.
 * Generation matching protects a newly overwritten object from an old listing. */
export async function deleteStoragePrefix(db: Firestore, bucket: Bucket, prefix: string, stillAllowed?: () => Promise<boolean>) {
  if (!/^users\/[^/]+\/posts\/[^/]+\/$/.test(prefix)) {
    throw new Error("Unsafe storage cleanup prefix");
  }
  if (!prefix.endsWith("/")) throw new Error("Storage cleanup prefix must end with slash");
  const [files] = await bucket.getFiles({ prefix });
  const referenced = await referencedStorageObjects(db, files.map((file) => file.name));
  let deleted = 0;
  for (const file of files) {
    if (!/^\d+\.[^/]+$/.test(file.name.slice(prefix.length)) || referenced.has(file.name)) continue;
    if (stillAllowed && !(await stillAllowed())) return deleted;
    if (await deleteListedGeneration(file)) deleted++;
  }
  return deleted;
}

/** Retain live shared references, including a family pet avatar uploaded by
 * someone other than the pet creator. This is a conservative, read-only scan
 * of the current reference schema, never deletion authority from a URL. */
async function referencedStorageObjects(db: Firestore, names: string[], deletingUid?: string) {
  const referenced = new Set<string>();
  if (!names.length) return referenced;
  const inspect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (value && typeof value === "object") { Object.values(value).forEach(inspect); return; }
    if (typeof value !== "string") return;
    const variants = [value];
    for (let pass = 0; pass < 2; pass++) {
      try { variants.push(decodeURIComponent(variants[variants.length - 1])); }
      catch {
        // An undecodable Storage reference cannot prove unreferencedness.
        if (/firebasestorage|storage\.googleapis|gs:\/\//i.test(value)) names.forEach((name) => referenced.add(name));
        break;
      }
    }
    // Also handles URLs embedded in knowledge markdown. A false positive
    // only retains a file. It must never cause deletion of an external object.
    for (const name of names) {
      if (variants.some((text) => text.includes(encodeURIComponent(name)) || text.includes(name))) referenced.add(name);
    }
  };
  const queries = [
    db.collection("pets").select("photoURL"),
    db.collection("posts").select("photoURLs", "authorPhotoURL"),
    db.collection("walks").select("photoURLs", "walkerPhotoURL"),
    db.collection("expenses").select("receiptURL"),
    db.collection("users").select("photoURL"),
    db.collection("knowledgeArticles").select("coverImageURL", "contentMd"),
    db.collectionGroup("comments").select("authorPhotoURL"),
    db.collectionGroup("reviews").select("photoURLs", "authorPhotoURL"),
    db.collectionGroup("friends").select("photoURL"),
    db.collectionGroup("friendRequests").select("fromPhotoURL"),
    db.collectionGroup("entries").select("photoURL", "petPhotoURL"),
  ];
  for (const query of queries) {
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      if (deletingUid && doc.ref.path === `users/${deletingUid}`) continue;
      Object.values(doc.data()).forEach(inspect);
    }
  }
  return referenced;
}

export async function deleteUnsharedAccountStorage(db: Firestore, bucket: Bucket, uid: string, checkLease?: () => Promise<void>) {
  if (!validSegment(uid)) throw new Error("Invalid storage owner");
  const prefix = `users/${uid}/`;
  const [files] = await bucket.getFiles({ prefix });
  const referenced = await referencedStorageObjects(db, files.map((file) => file.name), uid);
  let deleted = 0;
  let retained = 0;
  for (const file of files) {
    await checkLease?.();
    const relative = file.name.slice(prefix.length);
    const resource = knownStorageResource(relative);
    // Unknown/private paths have no retention policy yet; fail closed.
    if (!resource || referenced.has(file.name) || (await db.doc(`${resource.collection}/${resource.id}`).get()).exists) {
      retained++;
      continue;
    }
    if (await deleteListedGeneration(file)) deleted++;
    else retained++;
  }
  return { deleted, retained };
}

/** Parent absence is rechecked in each deletion transaction. A delayed event
 * must not delete a recreated post's new children or its new photo prefix. */
export async function cleanupDeletedPost(db: Firestore, bucket: Bucket, postId: string, authorUid: unknown, deletePhotos = true) {
  if (!validSegment(postId)) throw new Error("Invalid post ID");
  const postRef = db.doc(`posts/${postId}`);
  const result = { commentsDeleted: 0, reactionsDeleted: 0, storagePhotosDeleted: 0, skippedRecreated: false };
  for (const name of ["comments", "reactions"] as const) {
    while (true) {
      const count = await db.runTransaction(async (tx) => {
        if ((await tx.get(postRef)).exists) return -1;
        const children = await tx.get(postRef.collection(name).limit(350));
        for (const child of children.docs) tx.delete(child.ref);
        return children.size;
      });
      if (count === -1) return { ...result, skippedRecreated: true };
      result[name === "comments" ? "commentsDeleted" : "reactionsDeleted"] += count;
      if (count < 350) break;
    }
  }
  const absent = async () => !(await postRef.get()).exists;
  if (!(await absent())) return { ...result, skippedRecreated: true };
  if (deletePhotos && validSegment(authorUid)) {
    result.storagePhotosDeleted = await deleteStoragePrefix(db, bucket, `users/${authorUid}/posts/${postId}/`, absent);
  }
  await db.runTransaction(async (tx) => {
    if (!(await tx.get(postRef)).exists) tx.delete(db.doc(`postInteractionThrottle/${postId}`));
  });
  result.skippedRecreated = !(await absent());
  return result;
}

export async function deleteOwnComments(db: Firestore, uid: string) {
  const comments = await db.collectionGroup("comments").where("authorUid", "==", uid).get();
  let deleted = 0;
  for (const comment of comments.docs) {
    // A future unrelated collection named comments must not be cascaded.
    if (!/^posts\/[^/]+\/comments\/[^/]+$/.test(comment.ref.path)) continue;
    deleted += await db.runTransaction(async (tx) => {
      const current = await tx.get(comment.ref);
      if (!current.exists || current.data()?.authorUid !== uid) return 0;
      tx.delete(comment.ref);
      return 1;
    });
  }
  // Existing onCommentDeleted maintains surviving parent commentCount. Never
  // decrement here too: both callable and trigger would subtract the same item.
  return deleted;
}

export async function deleteOwnReactions(db: Firestore, uid: string) {
  const reactions = await db.collectionGroup("reactions").where("uid", "==", uid).get();
  let deleted = 0;
  for (const reaction of reactions.docs) {
    if (!/^posts\/[^/]+\/reactions\/[^/]+$/.test(reaction.ref.path)) continue;
    deleted += await db.runTransaction(async (tx) => {
      const current = await tx.get(reaction.ref);
      const parent = await tx.get(reaction.ref.parent.parent!);
      if (!current.exists || current.data()?.uid !== uid) return 0;
      if (parent.exists) {
        const counts = { ...(parent.data()?.reactionCounts ?? {}) };
        const emoji = current.data()?.emoji || "❤️";
        counts[emoji] = Math.max(0, (Number(counts[emoji]) || 0) - 1);
        tx.update(parent.ref, { reactionCounts: counts });
      }
      tx.delete(current.ref);
      return 1;
    });
  }
  return deleted;
}

/** Delete reviews and update the surviving restaurant in the same commit,
 * so an interrupted retry cannot lose the parent needing recomputation. */
export async function deleteOwnReviews(db: Firestore, uid: string) {
  const reviews = await db.collectionGroup("reviews").where("authorUid", "==", uid).get();
  const parents = new Map<string, DocumentReference>();
  for (const review of reviews.docs) {
    if (/^restaurants\/[^/]+\/reviews\/[^/]+$/.test(review.ref.path)) parents.set(review.ref.parent.parent!.path, review.ref.parent.parent!);
  }
  let deleted = 0;
  for (const parentRef of parents.values()) {
    while (true) {
      const count = await db.runTransaction(async (tx) => {
        const parent = await tx.get(parentRef);
        const all = await tx.get(parentRef.collection("reviews"));
        const own = all.docs.filter((doc) => doc.data().authorUid === uid).slice(0, 350);
        if (!own.length) return 0;
        const removed = new Set(own.map((doc) => doc.id));
        const remaining = all.docs.filter((doc) => !removed.has(doc.id));
        if (parent.exists) tx.update(parentRef, {
          reviewCount: remaining.length,
          averageRating: remaining.length ? remaining.reduce((sum, doc) => sum + (Number(doc.data().rating) || 0), 0) / remaining.length : 0,
        });
        for (const doc of own) tx.delete(doc.ref);
        return own.length;
      });
      deleted += count;
      if (count < 350) break;
    }
  }
  return deleted;
}

export async function exportOwnComments(db: Firestore, uid: string) {
  const comments = await db.collectionGroup("comments").where("authorUid", "==", uid).get();
  return comments.docs.filter((doc) => /^posts\/[^/]+\/comments\/[^/]+$/.test(doc.ref.path))
    .map((doc) => ({ ...doc.data(), commentId: doc.id, postId: doc.ref.parent.parent!.id }));
}

export async function exportUserCollections(db: Firestore, uid: string) {
  const names = ["achievements", "stats", "photoDownloadState"] as const;
  const snapshots = await Promise.all(names.map((name) => db.collection(`users/${uid}/${name}`).get()));
  return Object.fromEntries(names.map((name, index) => [name,
    snapshots[index].docs.map((doc) => ({ ...doc.data(), id: doc.id })),
  ]));
}

/** Final phase can be safely retried by both the callable and the server-only
 * checkpoint trigger. Auth failure never produces a false completed result. */
export async function finalizeAccountDeletion(
  db: Firestore, uid: string, deleteAuthUser: (uid: string) => Promise<unknown> = (id) => getAuth().deleteUser(id),
) {
  const checkpoint = db.doc(`deletedAccounts/${uid}`);
  const snap = await checkpoint.get();
  if (snap.data()?.state !== "finalizing") return;
  try {
    await deleteAuthUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  // recursiveDelete also covers unknown/legacy descendants left after earlier
  // failed attempts; deleting only the parent would leave them retrievable.
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc(`familyJoinAttempts/${uid}`).delete();
  await checkpoint.update({ state: "complete", completedAt: FieldValue.serverTimestamp() });
}

/** Persist post cleanup work before deleting parents, so account retries can
 * finish even when a parent has already disappeared from the author query. */
export async function deleteAccountPosts(db: Firestore, bucket: Bucket, uid: string, checkLease?: () => Promise<void>) {
  const queue = db.collection(`deletedAccounts/${uid}/posts`);
  const posts = await db.collection("posts").where("authorUid", "==", uid).get();
  for (const post of posts.docs) {
    await checkLease?.();
    await db.runTransaction(async (tx) => {
      const current = await tx.get(post.ref);
      if (!current.exists || current.data()?.authorUid !== uid) return;
      tx.set(queue.doc(post.id), { postId: post.id, authorUid: uid });
      tx.delete(post.ref);
    });
  }
  const pending = await queue.get();
  let deleted = 0;
  for (const item of pending.docs) {
    await checkLease?.();
    // IDs/owner come from the verified server query, never a client profile.
    // Account cleanup performs one protected Storage sweep after all Firestore
    // records are removed, instead of rescanning every shared reference per post.
    const result = await cleanupDeletedPost(db, bucket, item.id, uid, false);
    if (result.skippedRecreated) {
      const retained = await db.runTransaction(async (tx) => {
        const replacement = await tx.get(db.doc(`posts/${item.id}`));
        if (!replacement.exists || replacement.data()?.authorUid === uid) return false;
        tx.delete(item.ref);
        return true;
      });
      if (retained) continue; // Another owner's recreated ID is outside this cascade.
      throw new Error("Post recreated during account deletion; retry required");
    }
    await item.ref.delete();
    deleted++;
  }
  return deleted;
}

export async function deleteUserSubcollections(db: Firestore, userRef: DocumentReference) {
  for (const collection of await userRef.listCollections()) await db.recursiveDelete(collection);
}
