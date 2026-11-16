/**
 * Notification inbox — users/{uid}/notifications (written only by Cloud
 * Functions) + users/{uid}.notificationsLastSeenAt (written here on page
 * focus). See docs/features/ios-notification-center.md Phase 2.
 */
import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import type { AppNotification } from "@mango/shared-types";

import { serverTimestamp } from "./write-utils";

const userRef = (uid: string) => firestore().collection("users").doc(uid);
const inbox = (uid: string) => userRef(uid).collection("notifications").orderBy("createdAt", "desc");

type Millis = { toMillis?: () => number } | null | undefined;
const ms = (ts: Millis) => ts?.toMillis?.() ?? 0;

/** Realtime newest-first inbox, capped at `limit` (spec: 50). */
export function subscribeNotifications(
  uid: string,
  limit: number,
  onChange: (rows: AppNotification[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return inbox(uid)
    .limit(limit)
    .onSnapshot(
      (snap) =>
        onChange(
          snap.docs.map((d) => ({ ...(d.data() as AppNotification), notificationId: d.id })),
        ),
      (e) => onError?.(e),
    );
}

/** One-shot read of the previous lastSeen (ms; 0 = never seen). */
export async function getNotificationsLastSeenMs(uid: string): Promise<number> {
  const snap = await userRef(uid).get();
  return ms(snap.data()?.notificationsLastSeenAt as Millis);
}

export function markNotificationsSeen(uid: string): Promise<void> {
  return userRef(uid).update({ notificationsLastSeenAt: serverTimestamp() });
}

/** Bell red dot: newest notification.createdAt > notificationsLastSeenAt.
 *  Two listeners (limit 1 + own user doc); reminders never affect it (Q9). */
export function useHasUnreadNotifications(uid: string | null | undefined): boolean {
  const [latest, setLatest] = useState(0);
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    if (!uid) {
      setLatest(0);
      return;
    }
    const offInbox = inbox(uid)
      .limit(1)
      .onSnapshot(
        (snap) => setLatest(ms(snap.docs[0]?.data().createdAt as Millis)),
        () => setLatest(0),
      );
    const offUser = userRef(uid).onSnapshot(
      // Pending serverTimestamp reads as null locally → treat as "now".
      (snap) => {
        const v = snap?.data()?.notificationsLastSeenAt as Millis;
        setSeen(v === null ? Date.now() : ms(v));
      },
      () => {},
    );
    return () => {
      offInbox();
      offUser();
    };
  }, [uid]);
  return latest > seen;
}
