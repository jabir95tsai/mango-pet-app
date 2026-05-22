import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./config";
import type { Reminder, ReminderInput } from "@/lib/types";

const REMINDERS = "reminders";

function remindersCol() {
  return collection(getDb(), REMINDERS);
}

function reminderDoc(reminderId: string) {
  return doc(getDb(), REMINDERS, reminderId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export async function listReminders(
  familyId: string,
  opts?: { petId?: string; includeDone?: boolean },
): Promise<Reminder[]> {
  const snap = await getDocs(
    query(
      remindersCol(),
      where("familyId", "==", familyId),
      orderBy("triggerAt", "asc"),
    ),
  );
  let reminders = snap.docs.map((d) => ({
    ...(d.data() as Reminder),
    reminderId: d.id,
  }));
  if (opts?.petId) {
    reminders = reminders.filter((r) => r.petId === opts.petId);
  }
  if (!opts?.includeDone) {
    reminders = reminders.filter((r) => !r.done);
  }
  return reminders;
}

export async function listUpcomingReminders(
  familyId: string,
  withinDays = 30,
): Promise<Reminder[]> {
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(Date.now() + withinDays * 86400_000);
  const snap = await getDocs(
    query(
      remindersCol(),
      where("familyId", "==", familyId),
      where("triggerAt", ">=", now),
      where("triggerAt", "<=", cutoff),
      orderBy("triggerAt", "asc"),
    ),
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as Reminder), reminderId: d.id }))
    .filter((r) => !r.done);
}

export async function listOverdueReminders(familyId: string): Promise<Reminder[]> {
  const now = Timestamp.now();
  const snap = await getDocs(
    query(
      remindersCol(),
      where("familyId", "==", familyId),
      where("triggerAt", "<", now),
      orderBy("triggerAt", "desc"),
    ),
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as Reminder), reminderId: d.id }))
    .filter((r) => !r.done);
}

export type CreateReminderArgs = ReminderInput & {
  familyId: string;
  createdByUid: string;
};

export async function createReminder(
  args: CreateReminderArgs,
): Promise<Reminder> {
  const docRef = await addDoc(
    remindersCol(),
    clean({
      familyId: args.familyId,
      createdByUid: args.createdByUid,
      petId: args.petId,
      title: args.title,
      description: args.description,
      triggerAt: Timestamp.fromDate(args.triggerAt),
      repeat: args.repeat,
      notifyBeforeMinutes: args.notifyBeforeMinutes,
      done: false,
      notified: false,
      createdAt: serverTimestamp(),
    }),
  );
  const snap = await getDoc(docRef);
  return { ...(snap.data() as Reminder), reminderId: docRef.id };
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
    triggerAt: patch.triggerAt ? Timestamp.fromDate(patch.triggerAt) : undefined,
  });
  await updateDoc(
    reminderDoc(reminderId),
    opts?.resetNotification
      ? {
          ...updates,
          notified: false,
          notifiedAt: deleteField(),
        }
      : updates,
  );
}

function advance(triggerAt: Date, repeat: Reminder["repeat"]): Date | null {
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

function advanceToFuture(from: Date, repeat: Reminder["repeat"]): Date | null {
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

export async function completeReminder(
  reminder: Reminder,
  /** Member who marked it done — attribution for shared reminders. */
  doneByUid: string,
): Promise<void> {
  const next = advanceToFuture(
    (reminder.triggerAt as Timestamp).toDate(),
    reminder.repeat,
  );
  if (next) {
    await updateDoc(reminderDoc(reminder.reminderId), {
      triggerAt: Timestamp.fromDate(next),
      notified: false,
      // Track who last marked it done for the "fed by 媽媽" badge UX.
      doneByUid,
    });
  } else {
    await updateDoc(reminderDoc(reminder.reminderId), {
      done: true,
      doneAt: serverTimestamp(),
      doneByUid,
    });
  }
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await deleteDoc(reminderDoc(reminderId));
}

/** One-shot legacy migration: users/{uid}/reminders/* → top-level reminders/*
 *  Idempotent — won't overwrite existing top-level docs by the same id. */
export async function migrateLegacyRemindersToFamily(
  legacyUid: string,
  familyId: string,
): Promise<number> {
  const legacy = await getDocs(
    collection(getDb(), "users", legacyUid, "reminders"),
  );
  if (legacy.empty) return 0;

  let migrated = 0;
  const docs = legacy.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const slice = docs.slice(i, i + 400);
    const batch = writeBatch(getDb());
    for (const legacyDoc of slice) {
      const newRef = doc(getDb(), REMINDERS, legacyDoc.id);
      const existing = await getDoc(newRef);
      if (existing.exists()) continue;
      const data = legacyDoc.data();
      batch.set(newRef, {
        ...data,
        familyId,
        createdByUid: data.createdByUid ?? legacyUid,
      });
      migrated++;
    }
    if (migrated > 0) await batch.commit();
  }
  return migrated;
}
