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
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const LOOK_AHEAD_MS = 24 * 60 * 60 * 1000;
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

        const uid = reminderDoc.ref.parent.parent?.id;
        if (!uid) continue;

        const userSnap = await db.doc(`users/${uid}`).get();
        const userData = userSnap.data();
        const tokens = ((userData?.fcmTokens ?? []) as string[]).filter(Boolean);

        if (tokens.length === 0) {
          await reminderDoc.ref.update({ notified: true, notifiedAt: now });
          noTokens++;
          continue;
        }

        const title = (reminder.title as string) || "Mango Pet";
        const body =
          (reminder.description as string) ||
          (reminder.petId ? "🐾 提醒到時間了" : "🔔 提醒到時間了");

        const response = await messaging.sendEachForMulticast({
          tokens,
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

    for (const doc of allWalks.docs) {
      const w = doc.data() as WalkRow;
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
  { region: FUNCTION_REGION, cors: true },
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
