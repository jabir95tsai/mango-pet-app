/**
 * iOS reminders WRITE layer — direct Firestore writes mirroring
 * apps/web/src/lib/firebase/reminders.ts (createReminder / updateReminder /
 * completeReminder / deleteReminder). These are NOT Cloud Functions on web
 * either; the scanReminders cron just reads the resulting docs. Doc shape +
 * the repeat-advance logic match web byte-for-byte.
 */
import firestore from "@react-native-firebase/firestore";
import type { Reminder, ReminderInput, ReminderRepeat } from "@mango/shared-types";

import {
  clean,
  deleteField,
  serverTimestamp,
  tsFromDate,
  type DatableTimestamp,
} from "./write-utils";

const col = () => firestore().collection("reminders");
const refOf = (id: string) => col().doc(id);

export type CreateReminderArgs = ReminderInput & {
  /** `null` → personal-mode reminder (gated by createdByUid == self). */
  familyId: string | null;
  createdByUid: string;
};

export async function createReminder(
  args: CreateReminderArgs,
): Promise<string> {
  const ref = await col().add({
    // familyId kept explicitly (incl null) so `where(familyId == null)` works.
    familyId: args.familyId,
    ...clean({
      createdByUid: args.createdByUid,
      petId: args.petId,
      title: args.title,
      description: args.description,
      triggerAt: tsFromDate(args.triggerAt),
      repeat: args.repeat,
      notifyBeforeMinutes: args.notifyBeforeMinutes,
      done: false,
      notified: false,
      createdAt: serverTimestamp(),
    }),
  });
  return ref.id;
}

export async function updateReminder(
  reminderId: string,
  patch: Partial<ReminderInput>,
  opts?: { resetNotification?: boolean },
): Promise<void> {
  const updates = clean({
    petId: patch.petId,
    title: patch.title,
    description: patch.description,
    repeat: patch.repeat,
    notifyBeforeMinutes: patch.notifyBeforeMinutes,
    triggerAt: patch.triggerAt ? tsFromDate(patch.triggerAt) : undefined,
  });
  await refOf(reminderId).update(
    opts?.resetNotification
      ? { ...updates, notified: false, notifiedAt: deleteField() }
      : updates,
  );
}

function advance(triggerAt: Date, repeat: ReminderRepeat): Date | null {
  const next = new Date(triggerAt);
  switch (repeat) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return null;
  }
}

function advanceToFuture(from: Date, repeat: ReminderRepeat): Date | null {
  if (repeat === "none") return null;
  let cursor: Date | null = from;
  const now = Date.now();
  let guard = 0;
  while (cursor && cursor.getTime() <= now && guard < 1000) {
    cursor = advance(cursor, repeat);
    guard++;
  }
  return cursor;
}

/** Mark done — repeating reminders advance to the next future trigger; one-off
 *  reminders flip done=true. Mirrors web completeReminder. */
export async function completeReminder(
  reminder: Reminder,
  doneByUid: string,
): Promise<void> {
  const next = advanceToFuture(
    (reminder.triggerAt as unknown as DatableTimestamp).toDate(),
    reminder.repeat,
  );
  if (next) {
    await refOf(reminder.reminderId).update({
      triggerAt: tsFromDate(next),
      notified: false,
      doneByUid,
    });
  } else {
    await refOf(reminder.reminderId).update({
      done: true,
      doneAt: serverTimestamp(),
      doneByUid,
    });
  }
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await refOf(reminderId).delete();
}
