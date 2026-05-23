/**
 * Mango Pet — Cloud Functions
 *
 *   - scanReminders: every 15 min, sends FCM push for due reminders.
 *   - aggregateLeaderboards: daily at 00:30 Asia/Taipei, recomputes weekly/monthly/all-time scores.
 *   - acceptFriendRequest / removeFriend: callable, mutates both sides atomically.
 *
 * Deploy:
 *   firebase deploy --only functions
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// Keep this aligned with the largest "notify before" option in the reminder form.
// The function queries by trigger time, so a one-week advance notification must
// include reminders whose trigger is still a week away.
const LOOK_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const FUNCTION_REGION = "asia-east1";

// ─────────────────────────────────────────────────────────────────────
// scanReminders — every 15 min
// ─────────────────────────────────────────────────────────────────────

export const scanReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 2,
    memory: "256MiB",
  },
  async () => {
    const now = Timestamp.now();
    const nowMs = now.toMillis();

    // collectionGroup catches both:
    //   - legacy: users/{uid}/reminders/*
    //   - new:    reminders/{reminderId} (top-level, family-scoped)
    // We dispatch by whether the doc has a `familyId` field. Once all
    // legacy data is migrated and the legacy paths are deleted, the
    // collectionGroup query will only return top-level docs.
    const snap = await db
      .collectionGroup("reminders")
      .where("done", "==", false)
      .where("notified", "==", false)
      .where("triggerAt", "<=", Timestamp.fromMillis(nowMs + LOOK_AHEAD_MS))
      .get();

    logger.info(`scanReminders: candidate count = ${snap.size}`);

    let sent = 0;
    let deferred = 0;
    let noTokens = 0;
    let failed = 0;

    for (const reminderDoc of snap.docs) {
      try {
        const reminder = reminderDoc.data();
        const triggerMs = (reminder.triggerAt as Timestamp).toMillis();
        const notifyBeforeMs =
          (Number(reminder.notifyBeforeMinutes) || 0) * 60 * 1000;
        const dueAt = triggerMs - notifyBeforeMs;

        if (dueAt > nowMs) {
          deferred++;
          continue;
        }

        // Determine recipient uids:
        //   - Family reminder (top-level with familyId): broadcast to all
        //     members of the family. Anyone can mark done, so everyone
        //     should know the pet needs attention.
        //   - Legacy per-user reminder: send only to that user.
        let recipientUids: string[];
        const familyId = reminder.familyId as string | undefined;
        if (familyId) {
          const famSnap = await db.doc(`families/${familyId}`).get();
          const fam = famSnap.data();
          recipientUids = ((fam?.memberUids ?? []) as string[]).filter(Boolean);
        } else {
          const parentUid = reminderDoc.ref.parent.parent?.id;
          recipientUids = parentUid ? [parentUid] : [];
        }

        if (recipientUids.length === 0) {
          await reminderDoc.ref.update({ notified: true, notifiedAt: now });
          continue;
        }

        // Collect FCM tokens from every recipient. Each token-removal write
        // happens against its own user doc, so we keep track of which uid
        // each token came from for later cleanup.
        const tokensWithOwner: { uid: string; token: string }[] = [];
        const userRefByUid = new Map<string, FirebaseFirestore.DocumentReference>();
        for (const recipUid of recipientUids) {
          const userRef = db.doc(`users/${recipUid}`);
          const userSnap = await userRef.get();
          userRefByUid.set(recipUid, userRef);
          const t = ((userSnap.data()?.fcmTokens ?? []) as string[]).filter(Boolean);
          for (const tok of t) tokensWithOwner.push({ uid: recipUid, token: tok });
        }

        if (tokensWithOwner.length === 0) {
          await reminderDoc.ref.update({ notified: true, notifiedAt: now });
          noTokens++;
          continue;
        }

        const title = (reminder.title as string) || "Mango Pet";
        const body =
          (reminder.description as string) ||
          (reminder.petId ? "🐾 提醒到時間了" : "🔔 提醒到時間了");

        const tokensList = tokensWithOwner.map((t) => t.token);
        const response = await messaging.sendEachForMulticast({
          tokens: tokensList,
          notification: { title, body },
          data: {
            reminderId: reminderDoc.id,
            petId: (reminder.petId as string) || "",
            url: reminder.petId ? `/app/pets/${reminder.petId}` : "/app",
          },
          webpush: {
            fcmOptions: {
              link: reminder.petId ? `/app/pets/${reminder.petId}` : "/app",
            },
          },
        });

        // Group invalid tokens by their owner uid for per-user arrayRemove.
        const invalidByUid = new Map<string, string[]>();
        response.responses.forEach((r, idx) => {
          if (!r.success && r.error) {
            const code = r.error.code;
            if (
              code === "messaging/invalid-registration-token" ||
              code === "messaging/registration-token-not-registered"
            ) {
              const { uid, token } = tokensWithOwner[idx];
              const list = invalidByUid.get(uid) ?? [];
              list.push(token);
              invalidByUid.set(uid, list);
            }
          }
        });
        for (const [uid, tokens] of invalidByUid) {
          const ref = userRefByUid.get(uid);
          if (!ref) continue;
          await ref.update({
            fcmTokens: FieldValue.arrayRemove(...tokens),
          });
        }

        await reminderDoc.ref.update({ notified: true, notifiedAt: now });
        sent++;
      } catch (err) {
        failed++;
        logger.error(
          `Failed processing reminder ${reminderDoc.ref.path}`,
          err,
        );
      }
    }

    logger.info(
      `scanReminders done — sent=${sent} deferred=${deferred} noTokens=${noTokens} failed=${failed}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// aggregateLeaderboards — daily 00:30 Asia/Taipei
// ─────────────────────────────────────────────────────────────────────

type WalkRow = {
  ownerUid: string;
  startedAt: Timestamp;
  distanceKm: number;
  durationMin: number;
  score: number;
};

type UserAccum = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  city?: string;
  totalScore: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  walkCount: number;
  walkDays: Set<number>;
};

function dayBucket(ts: Timestamp): number {
  return Math.floor(ts.toMillis() / 86_400_000);
}

function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `weekly_${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `monthly_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function streakFromDays(days: Set<number>): number {
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort((a, b) => b - a);
  const todayIdx = Math.floor(Date.now() / 86_400_000);
  if (sorted[0] < todayIdx - 1) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === 1) streak++;
    else break;
  }
  return streak;
}

async function writeLeaderboard(
  periodKey: string,
  accums: Map<string, UserAccum>,
): Promise<void> {
  const now = Timestamp.now();
  const collection = db.collection(`leaderboards/${periodKey}/entries`);

  // Clear stale entries (anyone no longer in top scores)
  const existing = await collection.get();
  const currentUids = new Set(accums.keys());
  const batch = db.batch();
  for (const doc of existing.docs) {
    if (!currentUids.has(doc.id)) batch.delete(doc.ref);
  }

  for (const a of accums.values()) {
    batch.set(collection.doc(a.uid), {
      uid: a.uid,
      displayName: a.displayName,
      photoURL: a.photoURL,
      city: a.city,
      totalScore: Math.round(a.totalScore * 10) / 10,
      totalDistanceKm: Math.round(a.totalDistanceKm * 100) / 100,
      totalDurationMin: Math.round(a.totalDurationMin),
      walkCount: a.walkCount,
      streakDays: streakFromDays(a.walkDays),
      updatedAt: now,
    });
  }

  await batch.commit();
}

export const aggregateLeaderboards = onSchedule(
  {
    schedule: "30 0 * * *",
    timeZone: "Asia/Taipei",
    region: FUNCTION_REGION,
    retryCount: 1,
    memory: "512MiB",
  },
  async () => {
    const now = new Date();
    const weekKey = isoWeekLabel(now);
    const monthKey = monthLabel(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allWalks = await db.collectionGroup("walks").get();
    logger.info(`aggregateLeaderboards: walks = ${allWalks.size}`);

    const usersById = new Map<string, { displayName: string; photoURL: string | null; city?: string }>();

    const weekly = new Map<string, UserAccum>();
    const monthly = new Map<string, UserAccum>();
    const allTime = new Map<string, UserAccum>();

    function getOrInit(
      map: Map<string, UserAccum>,
      uid: string,
    ): UserAccum {
      let acc = map.get(uid);
      if (acc) return acc;
      const profile = usersById.get(uid);
      acc = {
        uid,
        displayName: profile?.displayName ?? "Friend",
        photoURL: profile?.photoURL ?? null,
        city: profile?.city,
        totalScore: 0,
        totalDistanceKm: 0,
        totalDurationMin: 0,
        walkCount: 0,
        walkDays: new Set<number>(),
      };
      map.set(uid, acc);
      return acc;
    }

    // Dedupe across legacy (users/{uid}/walks/) and new (walks/) paths.
    // During the migration window both can exist for the same logical
    // walk (same doc id, the migration copies preserving id). We prefer
    // the top-level doc when both are present (it has familyId set), but
    // count whichever exists exactly once.
    const docsById = new Map<
      string,
      { data: WalkRow; path: string; isTopLevel: boolean }
    >();
    for (const doc of allWalks.docs) {
      const isTopLevel = !doc.ref.path.startsWith("users/");
      const prior = docsById.get(doc.id);
      if (prior && prior.isTopLevel) continue; // already have the canonical copy
      docsById.set(doc.id, {
        data: doc.data() as WalkRow,
        path: doc.ref.path,
        isTopLevel,
      });
    }

    for (const { data: w } of docsById.values()) {
      if (!w.ownerUid) continue;

      if (!usersById.has(w.ownerUid)) {
        const userSnap = await db.doc(`users/${w.ownerUid}`).get();
        const data = userSnap.data() ?? {};
        usersById.set(w.ownerUid, {
          displayName: (data.displayName as string) ?? "Friend",
          photoURL: (data.photoURL as string | null) ?? null,
          city: data.city as string | undefined,
        });
      }

      const at = w.startedAt.toDate();
      const dayIdx = dayBucket(w.startedAt);

      const buckets: { map: Map<string, UserAccum>; ok: boolean }[] = [
        { map: weekly, ok: at >= weekStart },
        { map: monthly, ok: at >= monthStart },
        { map: allTime, ok: true },
      ];

      for (const b of buckets) {
        if (!b.ok) continue;
        const acc = getOrInit(b.map, w.ownerUid);
        acc.totalScore += w.score ?? 0;
        acc.totalDistanceKm += w.distanceKm ?? 0;
        acc.totalDurationMin += w.durationMin ?? 0;
        acc.walkCount += 1;
        acc.walkDays.add(dayIdx);
      }
    }

    await Promise.all([
      writeLeaderboard(weekKey, weekly),
      writeLeaderboard(monthKey, monthly),
      writeLeaderboard("all_time", allTime),
    ]);

    logger.info(
      `aggregateLeaderboards done — weekly=${weekly.size}, monthly=${monthly.size}, all=${allTime.size}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// Friend operations — callable (need cross-user writes)
// ─────────────────────────────────────────────────────────────────────

export const acceptFriendRequest = onCall(
  // `invoker: "public"` is the default for callable functions. The Cloud
  // Run IAM for this service had drifted (OPTIONS preflight returned 403
  // while paired callables on the same config returned 204), and a
  // plain `firebase deploy` UPDATE path does NOT re-apply the invoker
  // binding — only the initial CREATE does. The fix that landed was to
  // `firebase functions:delete acceptFriendRequest --force` then deploy
  // fresh. Setting this explicitly is documentation + defense for any
  // future re-create.
  { region: FUNCTION_REGION, cors: true, invoker: "public" },
  async (req) => {
    const myUid = req.auth?.uid;
    if (!myUid) throw new HttpsError("unauthenticated", "Sign-in required");
    const fromUid = (req.data?.fromUid as string | undefined)?.trim();
    if (!fromUid) throw new HttpsError("invalid-argument", "fromUid required");

    const reqRef = db.doc(`users/${myUid}/friendRequests/${fromUid}`);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError("not-found", "Request not found");
    }

    const [meSnap, themSnap] = await Promise.all([
      db.doc(`users/${myUid}`).get(),
      db.doc(`users/${fromUid}`).get(),
    ]);
    const me = meSnap.data();
    const them = themSnap.data();
    if (!me || !them) {
      throw new HttpsError("failed-precondition", "Profiles missing");
    }

    const now = Timestamp.now();
    const batch = db.batch();
    batch.set(db.doc(`users/${myUid}/friends/${fromUid}`), {
      uid: fromUid,
      displayName: them.displayName ?? "Friend",
      photoURL: them.photoURL ?? null,
      addedAt: now,
    });
    batch.set(db.doc(`users/${fromUid}/friends/${myUid}`), {
      uid: myUid,
      displayName: me.displayName ?? "Friend",
      photoURL: me.photoURL ?? null,
      addedAt: now,
    });
    batch.delete(reqRef);
    await batch.commit();

    return { ok: true };
  },
);

export const removeFriend = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const myUid = req.auth?.uid;
    if (!myUid) throw new HttpsError("unauthenticated", "Sign-in required");
    const friendUid = (req.data?.friendUid as string | undefined)?.trim();
    if (!friendUid) throw new HttpsError("invalid-argument", "friendUid required");

    const batch = db.batch();
    batch.delete(db.doc(`users/${myUid}/friends/${friendUid}`));
    batch.delete(db.doc(`users/${friendUid}/friends/${myUid}`));
    await batch.commit();

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────
// sendTestPush — callable, sends a sanity-check notification to the
// caller's own FCM tokens. Use to verify VAPID key + SW registration
// without waiting for the next scanReminders tick.
// ─────────────────────────────────────────────────────────────────────

export const sendTestPush = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User doc not found");
    }
    const userData = userSnap.data() ?? {};
    const tokens = ((userData.fcmTokens as string[] | undefined) ?? []).filter(
      Boolean,
    );
    if (tokens.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "尚未啟用推播通知，請先到設定開啟",
      );
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "🥭 測試推播",
        body: "推播設定成功！提醒到時間會像這樣通知你。",
      },
      data: { url: "/app" },
      webpush: {
        fcmOptions: { link: "/app" },
      },
    });

    // Clean up invalid tokens — same logic as scanReminders so test
    // pushes also self-heal stale registrations.
    const invalidTokens: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error) {
        const code = r.error.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    if (invalidTokens.length > 0) {
      await userSnap.ref.update({
        fcmTokens: FieldValue.arrayRemove(...invalidTokens),
      });
    }

    return {
      ok: response.successCount > 0,
      sent: response.successCount,
      failed: response.failureCount,
      invalidTokens: invalidTokens.length,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────
// Families — multi-user pet sharing
//
// Data model:
//   families/{familyId}
//     name, ownerUid, memberUids[], inviteCode (6 digits), createdAt
//   users/{uid}.familyIds: string[]
//   users/{uid}.currentFamilyId: string
//
// Invite flow: creator gets a 6-digit code, shares it OOB (LINE/SMS), invitee
// types it into the join dialog. Code is unique across active families.
// ─────────────────────────────────────────────────────────────────────

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_MAX_ATTEMPTS = 10;

function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

async function reserveUniqueInviteCode(): Promise<string> {
  // Family inviteCode collisions are vanishingly rare at small scale (10^6
  // codes, dozens of families). Retry-on-collide is fine.
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateInviteCode();
    const dupe = await db
      .collection("families")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (dupe.empty) return code;
  }
  throw new HttpsError(
    "resource-exhausted",
    "Could not allocate a unique invite code after retries",
  );
}

export const createFamily = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const name = ((req.data?.name as string | undefined) ?? "").trim() || "我的家庭";
    if (name.length > 40) {
      throw new HttpsError("invalid-argument", "Family name too long");
    }

    const inviteCode = await reserveUniqueInviteCode();
    const familyRef = db.collection("families").doc();
    const now = Timestamp.now();

    const batch = db.batch();
    batch.set(familyRef, {
      name,
      ownerUid: uid,
      memberUids: [uid],
      inviteCode,
      createdAt: now,
    });
    // Append to user.familyIds; set currentFamilyId so subsequent reads scope
    // to this family without an explicit switch.
    batch.set(
      db.doc(`users/${uid}`),
      {
        familyIds: FieldValue.arrayUnion(familyRef.id),
        currentFamilyId: familyRef.id,
      },
      { merge: true },
    );
    await batch.commit();

    return { familyId: familyRef.id, inviteCode };
  },
);

export const joinFamilyByCode = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const code = ((req.data?.inviteCode as string | undefined) ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError("invalid-argument", "邀請碼必須是 6 位數字");
    }

    const found = await db
      .collection("families")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (found.empty) {
      throw new HttpsError("not-found", "邀請碼無效或已過期");
    }
    const familyDoc = found.docs[0];
    const family = familyDoc.data();
    const members = (family.memberUids as string[] | undefined) ?? [];

    if (members.includes(uid)) {
      return { familyId: familyDoc.id, alreadyMember: true };
    }

    const batch = db.batch();
    batch.update(familyDoc.ref, {
      memberUids: FieldValue.arrayUnion(uid),
    });
    batch.set(
      db.doc(`users/${uid}`),
      {
        familyIds: FieldValue.arrayUnion(familyDoc.id),
        // Switching context to the just-joined family is the obvious
        // default — user typed the code, they want to use it now.
        currentFamilyId: familyDoc.id,
      },
      { merge: true },
    );
    await batch.commit();

    return { familyId: familyDoc.id, alreadyMember: false };
  },
);

export const leaveFamily = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const familyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!familyId) throw new HttpsError("invalid-argument", "familyId required");

    const familyRef = db.doc(`families/${familyId}`);
    const snap = await familyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Family not found");
    const family = snap.data() ?? {};
    const members = (family.memberUids as string[] | undefined) ?? [];
    if (!members.includes(uid)) {
      throw new HttpsError("failed-precondition", "Not a member");
    }

    const isOwner = family.ownerUid === uid;
    const isLast = members.length === 1;

    const batch = db.batch();

    if (isLast) {
      // Last member out — delete the family doc entirely. The owned pets /
      // walks / etc. remain (orphaned) for safety; the user can re-link
      // them by creating a new family. We don't cascade-delete user data.
      batch.delete(familyRef);
    } else {
      // Remove from memberUids; if the owner is leaving, promote the
      // earliest-listed remaining member to owner.
      const remaining = members.filter((m) => m !== uid);
      const update: Record<string, unknown> = {
        memberUids: FieldValue.arrayRemove(uid),
      };
      if (isOwner && remaining.length > 0) {
        update.ownerUid = remaining[0];
      }
      batch.update(familyRef, update);
    }

    // Detach from this user's familyIds. If currentFamilyId points here,
    // unset it; client will pick another family (if any) on next refresh.
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};
    const update: Record<string, unknown> = {
      familyIds: FieldValue.arrayRemove(familyId),
    };
    if (userData.currentFamilyId === familyId) {
      update.currentFamilyId = FieldValue.delete();
    }
    batch.update(userRef, update);

    await batch.commit();
    return { ok: true };
  },
);

export const regenerateInviteCode = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const familyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!familyId) throw new HttpsError("invalid-argument", "familyId required");

    const familyRef = db.doc(`families/${familyId}`);
    const snap = await familyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Family not found");
    const family = snap.data() ?? {};
    const members = (family.memberUids as string[] | undefined) ?? [];
    if (!members.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a member of this family");
    }

    const inviteCode = await reserveUniqueInviteCode();
    await familyRef.update({ inviteCode });
    return { inviteCode };
  },
);

export const removeFamilyMember = onCall(
  { region: FUNCTION_REGION, cors: true },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
    const familyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    const memberUid = ((req.data?.memberUid as string | undefined) ?? "").trim();
    if (!familyId || !memberUid) {
      throw new HttpsError("invalid-argument", "familyId and memberUid required");
    }

    const familyRef = db.doc(`families/${familyId}`);
    const snap = await familyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Family not found");
    const family = snap.data() ?? {};

    // Only the owner can remove others; anyone can remove themselves (use
    // leaveFamily for that, but allow self-removal here too as a fallback).
    if (family.ownerUid !== uid && memberUid !== uid) {
      throw new HttpsError("permission-denied", "Only the family owner can remove members");
    }

    const batch = db.batch();
    batch.update(familyRef, {
      memberUids: FieldValue.arrayRemove(memberUid),
    });
    const memberRef = db.doc(`users/${memberUid}`);
    const memberSnap = await memberRef.get();
    const memberData = memberSnap.data() ?? {};
    const memberUpdate: Record<string, unknown> = {
      familyIds: FieldValue.arrayRemove(familyId),
    };
    if (memberData.currentFamilyId === familyId) {
      memberUpdate.currentFamilyId = FieldValue.delete();
    }
    batch.update(memberRef, memberUpdate);
    await batch.commit();

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────
// importPersonalToFamily — Phase B3 callable
// Bulk-move the caller's personal-mode docs (familyId == null,
// per-collection owner field == caller.uid) into a family they belong
// to. Plain "search and replace familyId" — duplicate detection is
// deferred to B4 (pet-merge wizard). Writes an audit doc to
// families/{familyId}/migrations for the family to inspect later.
// ─────────────────────────────────────────────────────────────────────

/** Per-collection metadata for the bulk import. The owner field is
 *  the doc field the personal-mode rule checks (see firestore.rules). */
const IMPORT_TARGETS = [
  { type: "pets" as const, collection: "pets", ownerField: "ownerUid" },
  { type: "walks" as const, collection: "walks", ownerField: "walkerUid" },
  {
    type: "reminders" as const,
    collection: "reminders",
    ownerField: "createdByUid",
  },
  { type: "expenses" as const, collection: "expenses", ownerField: "payerUid" },
] as const;

type ImportType = (typeof IMPORT_TARGETS)[number]["type"];
type ImportCounts = Record<ImportType, number>;

export const importPersonalToFamily = onCall(
  { region: FUNCTION_REGION, cors: true, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const targetFamilyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!targetFamilyId) {
      throw new HttpsError("invalid-argument", "familyId required");
    }

    // Membership guard — caller must be in the target family before they
    // can flip ownership of any personal docs into it.
    const familyRef = db.doc(`families/${targetFamilyId}`);
    const familySnap = await familyRef.get();
    if (!familySnap.exists) {
      throw new HttpsError("not-found", "Family not found");
    }
    const memberUids =
      (familySnap.data()?.memberUids as string[] | undefined) ?? [];
    if (!memberUids.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a member of the target family",
      );
    }

    // Optional whitelist of types to import. Empty/missing = all 4.
    const requestedTypes = req.data?.types as ImportType[] | undefined;
    const targets =
      requestedTypes && requestedTypes.length > 0
        ? IMPORT_TARGETS.filter((t) => requestedTypes.includes(t.type))
        : IMPORT_TARGETS;

    const startedAt = Timestamp.now();
    const counts: ImportCounts = {
      pets: 0,
      walks: 0,
      reminders: 0,
      expenses: 0,
    };

    for (const target of targets) {
      // Query the caller's personal-mode docs in this collection.
      const snap = await db
        .collection(target.collection)
        .where(target.ownerField, "==", uid)
        .where("familyId", "==", null)
        .get();
      if (snap.empty) continue;

      // Chunk into batches of 400 to stay under Firestore's 500-write limit
      // (we reserve a few slots for the audit doc + headroom).
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const slice = docs.slice(i, i + 400);
        const batch = db.batch();
        for (const d of slice) {
          batch.update(d.ref, { familyId: targetFamilyId });
        }
        await batch.commit();
        counts[target.type] += slice.length;
      }

      logger.info(
        `importPersonalToFamily: moved ${counts[target.type]} ${target.type} ` +
          `for uid=${uid} into family=${targetFamilyId}`,
      );
    }

    // Audit doc — one per import event, id sortable by time.
    const finishedAt = Timestamp.now();
    const isoNow = new Date(finishedAt.toMillis()).toISOString();
    const auditId = `import-from-${uid}-${isoNow}`;
    await familyRef.collection("migrations").doc(auditId).set({
      type: "import-personal",
      fromUid: uid,
      targetFamilyId,
      startedAt,
      finishedAt,
      counts,
      // Record the type filter so a re-run debate can see whether unchecked
      // categories were truly empty or just skipped by the caller.
      requestedTypes: requestedTypes ?? null,
    });

    return { counts };
  },
);

// ─────────────────────────────────────────────────────────────────────
// mergeAndImportToFamily — Phase B4 callable
// Caller-supplied merge map of (personalPetId → familyPetId) pairs to
// fold into existing family pets, plus the same bulk-import pass
// importPersonalToFamily does for the rest. The match detection itself
// runs client-side (cheap, both lists already in memory after B3's
// ImportWizard render) — the server just executes what was confirmed.
//
// Merge semantics per spec:
//   - Move the personal pet's healthRecords subcollection docs over to
//     the family pet (read all, batched .set on the new ref, batched
//     .delete on the old refs — Firestore has no atomic subcoll move).
//   - Reassign petId on the personal user's walks / reminders / expenses
//     to the family pet's id. (Other family members' walks/reminders/
//     expenses are untouched — they already pointed at the family pet.)
//   - Delete the personal pet doc.
//   - DO NOT overwrite family pet fields (photoURL / bio / weightKg) —
//     spec is explicit: family pet wins on every field. The non-canonical
//     pet's values are logged in the audit doc for forensics.
// ─────────────────────────────────────────────────────────────────────

type MergePair = { personalPetId: string; familyPetId: string };

export const mergeAndImportToFamily = onCall(
  { region: FUNCTION_REGION, cors: true, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const targetFamilyId = ((req.data?.familyId as string | undefined) ?? "").trim();
    if (!targetFamilyId) {
      throw new HttpsError("invalid-argument", "familyId required");
    }
    const merges = (req.data?.merges as MergePair[] | undefined) ?? [];

    // Membership guard (same as importPersonalToFamily).
    const familyRef = db.doc(`families/${targetFamilyId}`);
    const familySnap = await familyRef.get();
    if (!familySnap.exists) {
      throw new HttpsError("not-found", "Family not found");
    }
    const memberUids =
      (familySnap.data()?.memberUids as string[] | undefined) ?? [];
    if (!memberUids.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a member of the target family",
      );
    }

    const startedAt = Timestamp.now();
    const mergedPets: Array<{
      personalPetId: string;
      familyPetId: string;
      movedHealthRecords: number;
      reassignedWalks: number;
      reassignedReminders: number;
      reassignedExpenses: number;
      lostFields: Record<string, unknown>;
    }> = [];

    // ── Step 1: process each user-confirmed merge ───────────────────
    for (const pair of merges) {
      // Sanity: caller must actually own the personal pet AND the family
      // pet must belong to the target family. We trust the client's
      // matching, but we double-check ownership here to prevent a
      // malicious caller from "merging" some other family's pet into
      // theirs.
      const personalRef = db.doc(`pets/${pair.personalPetId}`);
      const familyPetRef = db.doc(`pets/${pair.familyPetId}`);
      const [personalSnap, familyPetSnap] = await Promise.all([
        personalRef.get(),
        familyPetRef.get(),
      ]);
      if (!personalSnap.exists || !familyPetSnap.exists) continue;

      const pData = personalSnap.data() ?? {};
      const fData = familyPetSnap.data() ?? {};
      if (pData.familyId !== null || pData.ownerUid !== uid) {
        // Not actually the caller's personal pet — skip silently to keep
        // the rest of the merge batch from aborting.
        continue;
      }
      if (fData.familyId !== targetFamilyId) {
        continue;
      }

      // Move healthRecords subcollection: read personal pet's records,
      // batched-write to family pet path, batched-delete from old.
      let movedHealthRecords = 0;
      const hrSnap = await personalRef.collection("healthRecords").get();
      if (!hrSnap.empty) {
        const docs = hrSnap.docs;
        for (let i = 0; i < docs.length; i += 200) {
          const slice = docs.slice(i, i + 200);
          const writeBatch = db.batch();
          for (const d of slice) {
            const newRef = familyPetRef
              .collection("healthRecords")
              .doc(d.id);
            writeBatch.set(newRef, { ...d.data(), petId: pair.familyPetId });
            writeBatch.delete(d.ref);
          }
          await writeBatch.commit();
          movedHealthRecords += slice.length;
        }
      }

      // Reassign petId on caller's personal walks/reminders/expenses
      // that pointed at the personal pet. Note: we DON'T touch other
      // members' docs (they wouldn't reference a personal pet anyway).
      const collections = [
        { col: "walks", owner: "walkerUid" },
        { col: "reminders", owner: "createdByUid" },
        { col: "expenses", owner: "payerUid" },
      ] as const;
      const reassigned: Record<string, number> = {
        walks: 0,
        reminders: 0,
        expenses: 0,
      };
      for (const { col, owner } of collections) {
        const qSnap = await db
          .collection(col)
          .where(owner, "==", uid)
          .where("familyId", "==", null)
          .where("petId", "==", pair.personalPetId)
          .get();
        if (qSnap.empty) continue;
        const docs = qSnap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const slice = docs.slice(i, i + 400);
          const wb = db.batch();
          for (const d of slice) {
            // Reassign to the family pet AND switch into the family in
            // one write so the doc transitions atomically from personal
            // to family-scoped.
            wb.update(d.ref, {
              petId: pair.familyPetId,
              familyId: targetFamilyId,
            });
          }
          await wb.commit();
          reassigned[col] += slice.length;
        }
      }

      // Capture the values we're about to drop — spec wants them in the
      // audit log so the user could in principle recover.
      const lostFields = {
        photoURL: pData.photoURL ?? null,
        bio: pData.bio ?? null,
        weightKg: pData.weightKg ?? null,
        breed: pData.breed ?? null,
      };

      // Delete the personal pet doc last — order matters: if anything
      // above fails, a retry replays the moves idempotently (set/update
      // by id), but a half-done state still has the personal pet doc
      // present, which is the right signal that the merge isn't done.
      await personalRef.delete();

      mergedPets.push({
        personalPetId: pair.personalPetId,
        familyPetId: pair.familyPetId,
        movedHealthRecords,
        reassignedWalks: reassigned.walks,
        reassignedReminders: reassigned.reminders,
        reassignedExpenses: reassigned.expenses,
        lostFields,
      });
    }

    // ── Step 2: bulk import everything remaining ────────────────────
    // After the merges above, any remaining personal-mode docs the
    // caller owns get the same flat move importPersonalToFamily does.
    // We don't filter by type here because the wizard already decided
    // — if the caller wants no bulk move, they pass merges only and
    // type-restrict via the existing importPersonalToFamily callable
    // (server-side honouring the client choice is the wizard's job).
    const importCounts: ImportCounts = {
      pets: 0,
      walks: 0,
      reminders: 0,
      expenses: 0,
    };
    const requestedTypes = req.data?.importTypes as ImportType[] | undefined;
    const targets =
      requestedTypes && requestedTypes.length > 0
        ? IMPORT_TARGETS.filter((t) => requestedTypes.includes(t.type))
        : IMPORT_TARGETS;

    for (const target of targets) {
      const snap = await db
        .collection(target.collection)
        .where(target.ownerField, "==", uid)
        .where("familyId", "==", null)
        .get();
      if (snap.empty) continue;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const slice = docs.slice(i, i + 400);
        const wb = db.batch();
        for (const d of slice) {
          wb.update(d.ref, { familyId: targetFamilyId });
        }
        await wb.commit();
        importCounts[target.type] += slice.length;
      }
    }

    // ── Step 3: audit ───────────────────────────────────────────────
    const finishedAt = Timestamp.now();
    const isoNow = new Date(finishedAt.toMillis()).toISOString();
    const auditId = `merge-import-from-${uid}-${isoNow}`;
    await familyRef.collection("migrations").doc(auditId).set({
      type: "merge-and-import",
      fromUid: uid,
      targetFamilyId,
      startedAt,
      finishedAt,
      mergedPets,
      importCounts,
      requestedTypes: requestedTypes ?? null,
    });

    logger.info(
      `mergeAndImportToFamily: uid=${uid} family=${targetFamilyId} ` +
        `merged=${mergedPets.length} import=${JSON.stringify(importCounts)}`,
    );

    return { mergedPets, importCounts };
  },
);

// ─────────────────────────────────────────────────────────────────────
// deleteUserAccount — D1 (full hard delete cascade)
// User-initiated account deletion per docs/features/delete-account.md.
// Step order matters — see spec Phase 1 §"執行順序很重要".
// ─────────────────────────────────────────────────────────────────────

type DeleteSummary = {
  personalPetsHardDeleted: number;
  personalWalksHardDeleted: number;
  personalRemindersHardDeleted: number;
  personalExpensesHardDeleted: number;
  familyPetsHardDeleted: number;
  familyPetSubcollectionsCascaded: number;
  familyWalksHardDeleted: number;
  familyRemindersHardDeleted: number;
  familyRemindersDoneByCleared: number;
  familyExpensesHardDeleted: number;
  postsHardDeleted: number;
  reactionsHardDeleted: number;
  reviewsHardDeleted: number;
  restaurantsSubmittedByCleared: number;
  familiesLeft: number;
  familiesDissolved: number;
  storagePhotosDeleted: number;
};

const BATCH_SIZE = 400; // stay safely under Firestore's 500-write cap

/** Commit `mutator` calls in chunked batches so a 5000-doc cleanup
 *  doesn't blow the 500-write batch limit. Best-effort per chunk —
 *  if a chunk fails the error propagates and the caller aborts the
 *  remaining steps. */
async function deleteIdsInBatches<T>(
  items: T[],
  mutator: (b: FirebaseFirestore.WriteBatch, item: T) => void,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const item of slice) mutator(batch, item);
    await batch.commit();
  }
}

export const deleteUserAccount = onCall(
  {
    region: FUNCTION_REGION,
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");

    const confirmDisplayName =
      ((req.data?.confirmDisplayName as string | undefined) ?? "").trim();

    // ─── Step 0: verify displayName matches before anything destructive
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }
    const userData = userSnap.data() ?? {};
    if (userData.displayName !== confirmDisplayName) {
      throw new HttpsError(
        "failed-precondition",
        "displayName confirmation does not match",
      );
    }

    const summary: DeleteSummary = {
      personalPetsHardDeleted: 0,
      personalWalksHardDeleted: 0,
      personalRemindersHardDeleted: 0,
      personalExpensesHardDeleted: 0,
      familyPetsHardDeleted: 0,
      familyPetSubcollectionsCascaded: 0,
      familyWalksHardDeleted: 0,
      familyRemindersHardDeleted: 0,
      familyRemindersDoneByCleared: 0,
      familyExpensesHardDeleted: 0,
      postsHardDeleted: 0,
      reactionsHardDeleted: 0,
      reviewsHardDeleted: 0,
      restaurantsSubmittedByCleared: 0,
      familiesLeft: 0,
      familiesDissolved: 0,
      storagePhotosDeleted: 0,
    };

    // ─── Step 1: collect pets where this user is the creator (ownerUid).
    // These get cascade-deleted along with every sub-doc that references
    // them. We need their petIds up front so steps 2-3 can scrub
    // walks/reminders/expenses that pointed at them and avoid double-
    // counting in step 4.
    const myPetsSnap = await db
      .collection("pets")
      .where("ownerUid", "==", uid)
      .get();
    const myPetIds = new Set(myPetsSnap.docs.map((d) => d.id));
    const personalPetIds = new Set<string>();
    for (const p of myPetsSnap.docs) {
      if (p.data().familyId === null) {
        personalPetIds.add(p.id);
        summary.personalPetsHardDeleted++;
      } else {
        summary.familyPetsHardDeleted++;
      }
    }

    // ─── Step 2: per-pet subcollection cleanup (healthRecords + the
    // top-level walks/reminders/expenses that target each petId).
    for (const petId of myPetIds) {
      const isPersonal = personalPetIds.has(petId);

      // 2a. healthRecords subcollection.
      const hrSnap = await db
        .collection("pets")
        .doc(petId)
        .collection("healthRecords")
        .get();
      await deleteIdsInBatches(hrSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) {
        // healthRecords don't have a dedicated personal counter — the
        // spec rolls them into personalPetsHardDeleted's implied cascade;
        // we silently delete without bumping a counter.
      } else {
        summary.familyPetSubcollectionsCascaded += hrSnap.size;
      }

      // 2b. walks pointing at this pet.
      const walksSnap = await db
        .collection("walks")
        .where("petId", "==", petId)
        .get();
      await deleteIdsInBatches(walksSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) summary.personalWalksHardDeleted += walksSnap.size;
      else summary.familyPetSubcollectionsCascaded += walksSnap.size;

      // 2c. reminders pointing at this pet.
      const remSnap = await db
        .collection("reminders")
        .where("petId", "==", petId)
        .get();
      await deleteIdsInBatches(remSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) summary.personalRemindersHardDeleted += remSnap.size;
      else summary.familyPetSubcollectionsCascaded += remSnap.size;

      // 2d. expenses pointing at this pet.
      const expSnap = await db
        .collection("expenses")
        .where("petId", "==", petId)
        .get();
      await deleteIdsInBatches(expSnap.docs, (b, d) => b.delete(d.ref));
      if (isPersonal) summary.personalExpensesHardDeleted += expSnap.size;
      else summary.familyPetSubcollectionsCascaded += expSnap.size;
    }

    // ─── Step 3: delete the pet docs themselves.
    await deleteIdsInBatches(myPetsSnap.docs, (b, d) => b.delete(d.ref));

    // ─── Step 4: walks/reminders/expenses owned by the user under OTHER
    // people's pets. We query by the per-collection owner field and
    // exclude anything whose petId was already cascaded in step 2.
    {
      const snap = await db
        .collection("walks")
        .where("walkerUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => !myPetIds.has(d.data().petId as string),
      );
      // Only family-mode walks fall here; personal-mode walks have
      // walkerUid === uid AND petId in personalPetIds → already cascaded.
      // Defensive: also exclude familyId === null just in case (shouldn't
      // happen because personal walks ALWAYS reference a personal pet).
      const familyDocs = docs.filter((d) => d.data().familyId !== null);
      await deleteIdsInBatches(familyDocs, (b, d) => b.delete(d.ref));
      summary.familyWalksHardDeleted += familyDocs.length;
    }
    {
      const snap = await db
        .collection("reminders")
        .where("createdByUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => !myPetIds.has(d.data().petId as string),
      );
      const familyDocs = docs.filter((d) => d.data().familyId !== null);
      await deleteIdsInBatches(familyDocs, (b, d) => b.delete(d.ref));
      summary.familyRemindersHardDeleted += familyDocs.length;
    }
    {
      const snap = await db
        .collection("expenses")
        .where("payerUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => !myPetIds.has(d.data().petId as string),
      );
      const familyDocs = docs.filter((d) => d.data().familyId !== null);
      await deleteIdsInBatches(familyDocs, (b, d) => b.delete(d.ref));
      summary.familyExpensesHardDeleted += familyDocs.length;
    }

    // ─── Step 5: clear doneByUid/doneAt on reminders this user marked
    // done but didn't create. The reminder doc stays (it belongs to
    // someone else); only the attribution gets scrubbed.
    {
      const snap = await db
        .collection("reminders")
        .where("doneByUid", "==", uid)
        .get();
      const docs = snap.docs.filter(
        (d) => d.data().createdByUid !== uid && !myPetIds.has(d.data().petId as string),
      );
      await deleteIdsInBatches(docs, (b, d) =>
        b.update(d.ref, {
          doneByUid: FieldValue.delete(),
          doneAt: FieldValue.delete(),
        }),
      );
      summary.familyRemindersDoneByCleared += docs.length;
    }

    // ─── Step 6a: clear submittedByUid on restaurants. Restaurants are
    // community assets — we keep them around with attribution stripped.
    {
      const snap = await db
        .collection("restaurants")
        .where("submittedByUid", "==", uid)
        .get();
      await deleteIdsInBatches(snap.docs, (b, d) =>
        b.update(d.ref, { submittedByUid: FieldValue.delete() }),
      );
      summary.restaurantsSubmittedByCleared += snap.size;
    }

    // ─── Step 6b: posts authored by this user. Each post has a reactions
    // subcollection; nuke that first, then the post.
    {
      const postsSnap = await db
        .collection("posts")
        .where("authorUid", "==", uid)
        .get();
      for (const post of postsSnap.docs) {
        const rxSnap = await post.ref.collection("reactions").get();
        await deleteIdsInBatches(rxSnap.docs, (b, d) => b.delete(d.ref));
      }
      await deleteIdsInBatches(postsSnap.docs, (b, d) => b.delete(d.ref));
      summary.postsHardDeleted += postsSnap.size;
    }

    // ─── Step 6c: this user's reactions on OTHER people's posts.
    // Decrement each post's reactionCounts[emoji] before deleting the
    // reaction doc. Skip reactions on the user's own posts (already
    // killed by 6b) — grouped by parent post so we batch one update
    // per post.
    {
      const rxSnap = await db
        .collectionGroup("reactions")
        .where("uid", "==", uid)
        .get();
      // Group reactions by parent post id, accumulating per-emoji counts.
      // Skip reactions whose parent post we already deleted in 6b — same
      // condition: post.authorUid === uid → the post is gone and any
      // increment update against it would 404.
      const perPost = new Map<
        string,
        {
          ref: FirebaseFirestore.DocumentReference;
          emojiCounts: Record<string, number>;
          reactionRefs: FirebaseFirestore.DocumentReference[];
        }
      >();
      for (const r of rxSnap.docs) {
        const postRef = r.ref.parent.parent;
        if (!postRef) continue;
        const postSnap = await postRef.get();
        if (!postSnap.exists) continue;
        if (postSnap.data()?.authorUid === uid) continue;
        const emoji = (r.data().emoji as string) || "❤️";
        let entry = perPost.get(postRef.id);
        if (!entry) {
          entry = { ref: postRef, emojiCounts: {}, reactionRefs: [] };
          perPost.set(postRef.id, entry);
        }
        entry.emojiCounts[emoji] = (entry.emojiCounts[emoji] ?? 0) + 1;
        entry.reactionRefs.push(r.ref);
      }
      // Apply per-post: decrement counts then delete reaction doc.
      for (const entry of perPost.values()) {
        const updates: Record<string, FirebaseFirestore.FieldValue> = {};
        for (const [emoji, n] of Object.entries(entry.emojiCounts)) {
          updates[`reactionCounts.${emoji}`] = FieldValue.increment(-n);
        }
        const batch = db.batch();
        batch.update(entry.ref, updates);
        for (const refToDelete of entry.reactionRefs) batch.delete(refToDelete);
        await batch.commit();
        summary.reactionsHardDeleted += entry.reactionRefs.length;
      }
    }

    // ─── Step 6d: restaurant reviews authored by this user. Per spec,
    // recompute averageRating + reviewCount on each affected restaurant.
    {
      const reviewsSnap = await db
        .collectionGroup("reviews")
        .where("authorUid", "==", uid)
        .get();
      // Group by parent restaurant to do one rating recompute per
      // restaurant instead of per review.
      const perRestaurant = new Map<
        string,
        {
          ref: FirebaseFirestore.DocumentReference;
          reviewRefs: FirebaseFirestore.DocumentReference[];
        }
      >();
      for (const rv of reviewsSnap.docs) {
        const restRef = rv.ref.parent.parent;
        if (!restRef) continue;
        let entry = perRestaurant.get(restRef.id);
        if (!entry) {
          entry = { ref: restRef, reviewRefs: [] };
          perRestaurant.set(restRef.id, entry);
        }
        entry.reviewRefs.push(rv.ref);
      }
      for (const entry of perRestaurant.values()) {
        // Delete the reviews first.
        await deleteIdsInBatches(entry.reviewRefs, (b, ref) => b.delete(ref));
        // Recompute from the surviving review set.
        const remaining = await entry.ref.collection("reviews").get();
        let sum = 0;
        for (const rv of remaining.docs)
          sum += Number(rv.data().rating) || 0;
        const newCount = remaining.size;
        const newAvg = newCount > 0 ? sum / newCount : 0;
        await entry.ref.update({
          averageRating: newAvg,
          reviewCount: newCount,
        });
        summary.reviewsHardDeleted += entry.reviewRefs.length;
      }
    }

    // ─── Step 7: friends + friendRequests (both directions).
    {
      // My friends subcollection — for each entry, also delete the reverse
      // doc at users/{friendUid}/friends/{myUid}.
      const friendsSnap = await userRef.collection("friends").get();
      const friendUids = friendsSnap.docs.map((d) => d.id);
      await deleteIdsInBatches(friendsSnap.docs, (b, d) => b.delete(d.ref));
      // Reverse side.
      await deleteIdsInBatches(friendUids, (b, friendUid) =>
        b.delete(db.doc(`users/${friendUid}/friends/${uid}`)),
      );

      // friendRequests TO me: just nuke the subcollection.
      const incomingReqs = await userRef.collection("friendRequests").get();
      await deleteIdsInBatches(incomingReqs.docs, (b, d) => b.delete(d.ref));

      // friendRequests FROM me to others: collectionGroup lookup since the
      // docs live under different users.
      const outgoingReqs = await db
        .collectionGroup("friendRequests")
        .where("fromUid", "==", uid)
        .get();
      await deleteIdsInBatches(outgoingReqs.docs, (b, d) => b.delete(d.ref));
    }

    // ─── Step 8: small per-user subcollections (favorites + bookmarks).
    {
      const favSnap = await userRef.collection("favoriteRestaurants").get();
      await deleteIdsInBatches(favSnap.docs, (b, d) => b.delete(d.ref));
      const bmSnap = await userRef.collection("knowledgeBookmarks").get();
      await deleteIdsInBatches(bmSnap.docs, (b, d) => b.delete(d.ref));
    }

    // ─── Step 9: leaderboard entries (one per period).
    {
      const lbSnap = await db
        .collectionGroup("entries")
        .where("uid", "==", uid)
        .get();
      await deleteIdsInBatches(lbSnap.docs, (b, d) => b.delete(d.ref));
    }

    // ─── Step 10: families. For each family the user belongs to:
    //   - if they're the sole member → dissolve (delete family doc)
    //   - if they're the owner → promote memberUids[1] (next-oldest) to owner
    //   - always: remove uid from memberUids
    {
      const familyIds: string[] =
        (userData.familyIds as string[] | undefined) ?? [];
      for (const familyId of familyIds) {
        const famRef = db.doc(`families/${familyId}`);
        const famSnap = await famRef.get();
        if (!famSnap.exists) continue;
        const fam = famSnap.data() ?? {};
        const members = (fam.memberUids as string[] | undefined) ?? [];
        const remaining = members.filter((m) => m !== uid);
        if (remaining.length === 0) {
          // Sole member → dissolve.
          await famRef.delete();
          summary.familiesDissolved++;
          continue;
        }
        const updates: Record<string, unknown> = {
          memberUids: FieldValue.arrayRemove(uid),
        };
        if (fam.ownerUid === uid) {
          updates.ownerUid = remaining[0];
        }
        await famRef.update(updates);
        summary.familiesLeft++;
      }
    }

    // ─── Step 11: audit doc. Written BEFORE the user doc + auth user
    // delete so we always have a record even if step 13/14 fail.
    const isoNow = new Date().toISOString();
    const auditRef = db.doc(`deletedAccounts/${uid}-${isoNow}`);
    await auditRef.set({
      deletedAt: Timestamp.now(),
      reason: "user-initiated",
      summary,
    });

    // ─── Step 12: storage cleanup. Both pet avatars and post photos live
    // under users/{uid}/ — one prefix-delete covers everything this user
    // uploaded. Best-effort: failures here don't roll back Firestore (the
    // orphan files are cheap and not user-visible). We list first for an
    // accurate count, then delete — `deleteFiles` itself returns void
    // in the current SDK.
    try {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
      const fileCount = files.length;
      if (fileCount > 0) {
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
      }
      summary.storagePhotosDeleted = fileCount;
      await auditRef.update({ "summary.storagePhotosDeleted": fileCount });
    } catch (err) {
      logger.warn(`deleteUserAccount: storage cleanup failed for uid=${uid}`, err);
    }

    // ─── Step 13: delete the user profile doc. (Subcollections already
    // emptied above — Firestore deletes the doc itself; subcoll docs
    // would survive but they're already gone.)
    await userRef.delete();

    // ─── Step 14: nuke the Firebase Auth user. Done last so a failure
    // here leaves the data already deleted (user could just sign in
    // again to a clean state) instead of the opposite.
    try {
      await getAuth().deleteUser(uid);
    } catch (err) {
      logger.error(
        `deleteUserAccount: auth.deleteUser failed for uid=${uid} ` +
          `— Firestore already wiped; user may retry sign-in to clean up`,
        err,
      );
      // Don't rethrow — the user's data is gone, they're effectively
      // deleted from the app's perspective even if the auth record
      // lingers (it'll re-create an empty user doc on next sign-in).
    }

    logger.info(
      `deleteUserAccount: completed uid=${uid} summary=${JSON.stringify(summary)}`,
    );

    return { summary };
  },
);
