import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
const hasOwn = (data: DocumentData, field: string) => Object.prototype.hasOwnProperty.call(data, field);

/** Ignore malformed legacy values; never send objects or duplicate tokens to FCM. */
export function contactTokens(...values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => Array.isArray(value)
    ? value.filter((token): token is string => typeof token === "string" && token.trim().length > 0)
    : []))];
}

/** During migration both stores may have different devices. A nonempty private
 * list must not hide a still-legacy iOS device. Rules prohibit new public tokens. */
export async function readContactTokens(db: Firestore, uid: string, publicData?: DocumentData): Promise<string[]> {
  const [privateSnap, publicUser] = await Promise.all([
    db.doc(`users/${uid}/private/contact`).get(),
    publicData === undefined ? db.doc(`users/${uid}`).get().then((snap) => snap.data()) : publicData,
  ]);
  return contactTokens(privateSnap.data()?.fcmTokens, publicUser?.fcmTokens);
}

/** Remove rejected tokens without recreating the forbidden public field or a
 * deleted profile's private subcollection. Concurrent registrations retry. */
export async function removeContactTokens(db: Firestore, uid: string, invalid: string[]): Promise<void> {
  if (invalid.length === 0) return;
  const rejected = new Set(invalid);
  const userRef = db.doc(`users/${uid}`), privateRef = userRef.collection("private").doc("contact");
  await db.runTransaction(async (tx) => {
    const [user, privateSnap, deletion] = await Promise.all([
      tx.get(userRef), tx.get(privateRef), tx.get(db.doc(`deletedAccounts/${uid}`)),
    ]);
    if (!user.exists || deletion.exists) return;
    const tokens = contactTokens(privateSnap.data()?.fcmTokens, user.data()?.fcmTokens)
      .filter((token) => !rejected.has(token));
    if (privateSnap.exists || tokens.length > 0) tx.set(privateRef, { fcmTokens: tokens }, { merge: true });
    if (hasOwn(user.data()!, "fcmTokens")) tx.update(userRef, { fcmTokens: FieldValue.delete() });
  });
}

export type ContactMigrationResult = {
  found: boolean;
  changed: boolean;
  hadPublicEmail: boolean;
  hadPublicTokens: boolean;
  tokenCount: number;
};

/** Copy/strip one exact profile atomically. No stale pre-scan snapshot is used,
 * and retrying never overwrites another device's tokens or private email. */
export async function migrateUserContact(db: Firestore, uid: string, strip: boolean): Promise<ContactMigrationResult> {
  const userRef = db.doc(`users/${uid}`), privateRef = userRef.collection("private").doc("contact");
  return db.runTransaction(async (tx) => {
    const [user, privateSnap, deletion] = await Promise.all([
      tx.get(userRef), tx.get(privateRef), tx.get(db.doc(`deletedAccounts/${uid}`)),
    ]);
    const unchanged = { found: user.exists, changed: false, hadPublicEmail: false, hadPublicTokens: false, tokenCount: 0 };
    if (!user.exists || deletion.exists) return unchanged;
    const pub = user.data()!, priv = privateSnap.data() ?? {};
    const hadPublicEmail = hasOwn(pub, "email"), hadPublicTokens = hasOwn(pub, "fcmTokens");
    if (!hadPublicEmail && !hadPublicTokens) return unchanged;
    const payload: DocumentData = {};
    const tokens = contactTokens(priv.fcmTokens, pub.fcmTokens);
    if (hadPublicTokens) payload.fcmTokens = tokens;
    if (hadPublicEmail && !(typeof priv.email === "string" && priv.email.length > 0)) {
      if (typeof pub.email === "string" || pub.email === null) payload.email = pub.email;
    }
    if (Object.keys(payload).length) tx.set(privateRef, payload, { merge: true });
    if (strip) tx.update(userRef, {
      ...(hadPublicEmail ? { email: FieldValue.delete() } : {}),
      ...(hadPublicTokens ? { fcmTokens: FieldValue.delete() } : {}),
    });
    return { found: true, changed: true, hadPublicEmail, hadPublicTokens, tokenCount: tokens.length };
  });
}
