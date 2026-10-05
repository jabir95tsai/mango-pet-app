import { FieldValue, type Firestore } from "firebase-admin/firestore";

// Profile familyIds is a client-writable UI cache, never an authority source.
export function memberFamilies(db: Firestore, uid: string) {
  return db.collection("families").where("memberUids", "array-contains", uid).get();
}

export async function exportMemberFamilies(db: Firestore, uid: string) {
  const snapshot = await memberFamilies(db, uid);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    // An explicit DTO keeps invite codes and future private fields out of exports.
    return {
      familyId: doc.id,
      name: data.name ?? null,
      ownerUid: data.ownerUid ?? null,
      memberUids: data.memberUids,
      createdAt: data.createdAt ?? null,
    };
  });
}

export function exportContactFields(contact: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  if (typeof contact.email === "string" || contact.email === null) {
    fields.email = contact.email;
  }
  if (Array.isArray(contact.fcmTokens)) {
    fields.fcmTokens = contact.fcmTokens.filter((token) => typeof token === "string");
  }
  return fields;
}

export async function leaveMemberFamilies(db: Firestore, uid: string) {
  const snapshot = await memberFamilies(db, uid);
  const counts = { familiesDissolved: 0, familiesLeft: 0 };
  for (const familyDoc of snapshot.docs) {
    // Membership and ownership may change after the query. Recheck atomically;
    // transaction retries must not increment the returned counts twice.
    const outcome = await db.runTransaction(async (tx) => {
      const current = await tx.get(familyDoc.ref);
      const data = current.data();
      if (!data || !Array.isArray(data.memberUids) || !data.memberUids.includes(uid)) {
        return "skipped";
      }
      const remaining = data.memberUids.filter((member: string) => member !== uid);
      if (remaining.length === 0) {
        tx.delete(familyDoc.ref);
        return "dissolved";
      }
      tx.update(familyDoc.ref, {
        memberUids: FieldValue.arrayRemove(uid),
        ...(data.ownerUid === uid ? { ownerUid: remaining[0] } : {}),
      });
      return "left";
    });
    if (outcome === "dissolved") counts.familiesDissolved++;
    if (outcome === "left") counts.familiesLeft++;
  }
  return counts;
}
