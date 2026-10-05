import { FieldValue, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const SHORT_WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_LIMIT = 5;
const DAY_LIMIT = 20;

export async function consumeFamilyJoinAttempt(db: Firestore, uid: string, nowMs = Date.now()) {
  // Outside the client-writable profile, so clearing profile/private data cannot
  // clear the quota. No invite codes or caller-supplied IP addresses are stored.
  const ref = db.doc(`familyJoinAttempts/${uid}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const stored: unknown = snapshot.exists ? snapshot.data()?.attemptsMs : [];
    if (!Array.isArray(stored) || stored.length > DAY_LIMIT
      || !stored.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
      throw new HttpsError("internal", "Invalid family join quota state");
    }
    const daily = (stored as number[]).filter((time) => time > nowMs - DAY_MS).sort((a, b) => a - b);
    const recent = daily.filter((time) => time > nowMs - SHORT_WINDOW_MS);
    const retryAt = Math.max(
      recent.length >= SHORT_LIMIT ? recent[recent.length - SHORT_LIMIT] + SHORT_WINDOW_MS : 0,
      daily.length >= DAY_LIMIT ? daily[daily.length - DAY_LIMIT] + DAY_MS : 0,
    );
    if (retryAt > nowMs) {
      throw new HttpsError("resource-exhausted", "嘗試次數過多，請稍後再試", {
        retryAfterSeconds: Math.ceil((retryAt - nowMs) / 1000),
      });
    }
    tx.set(ref, { attemptsMs: [...daily, nowMs], updatedAt: Timestamp.fromMillis(nowMs) });
  });
}

export async function joinSelectedFamily(db: Firestore, ref: DocumentReference, uid: string, code: string) {
  return db.runTransaction(async (tx) => {
    // The query result may be stale after code rotation, family deletion or a
    // concurrent join. All checks and both membership writes share one transaction.
    const current = await tx.get(ref);
    const family = current.data();
    if (!family || family.inviteCode !== code) {
      throw new HttpsError("not-found", "邀請碼無效或已過期");
    }
    if (!Array.isArray(family.memberUids)) {
      throw new HttpsError("failed-precondition", "Family membership is invalid");
    }
    if (family.memberUids.includes(uid)) {
      return { familyId: ref.id, alreadyMember: true };
    }
    tx.update(ref, { memberUids: FieldValue.arrayUnion(uid) });
    tx.set(db.doc(`users/${uid}`), {
      familyIds: FieldValue.arrayUnion(ref.id), currentFamilyId: ref.id,
    }, { merge: true });
    return { familyId: ref.id, alreadyMember: false };
  });
}

export async function joinFamilyWithCode(db: Firestore, uid: string, code: string) {
  // Commit the quota first. A not-found result MUST NOT roll back this write;
  // successful joins and already-member calls also consume attempts.
  await consumeFamilyJoinAttempt(db, uid);
  const found = await db.collection("families").where("inviteCode", "==", code).limit(1).get();
  if (found.empty) throw new HttpsError("not-found", "邀請碼無效或已過期");
  return joinSelectedFamily(db, found.docs[0].ref, uid, code);
}
