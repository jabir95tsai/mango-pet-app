import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import type { Reminder, ReminderInput } from "@/lib/types";

function remindersCol(uid: string) {
  return collection(getDb(), "users", uid, "reminders");
}

function reminderDoc(uid: string, reminderId: string) {
  return doc(getDb(), "users", uid, "reminders", reminderId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export async function listReminders(
  uid: string,
  opts?: { petId?: string; includeDone?: boolean },
): Promise<Reminder[]> {
  const snap = await getDocs(query(remindersCol(uid), orderBy("triggerAt", "asc")));
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
  uid: string,
  withinDays = 30,
): Promise<Reminder[]> {
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(Date.now() + withinDays * 86400_000);
  const snap = await getDocs(
    query(
      remindersCol(uid),
      where("triggerAt", ">=", now),
      where("triggerAt", "<=", cutoff),
      orderBy("triggerAt", "asc"),
    ),
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as Reminder), reminderId: d.id }))
    .filter((r) => !r.done);
}

export async function listOverdueReminders(uid: string): Promise<Reminder[]> {
  const now = Timestamp.now();
  const snap = await getDocs(
    query(
      remindersCol(uid),
      where("triggerAt", "<", now),
      orderBy("triggerAt", "desc"),
    ),
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as Reminder), reminderId: d.id }))
    .filter((r) => !r.done);
}

export async function createReminder(
  uid: string,
  input: ReminderInput,
): Promise<Reminder> {
  const docRef = await addDoc(
    remindersCol(uid),
    clean({
      petId: input.petId,
      title: input.title,
      description: input.description,
      triggerAt: Timestamp.fromDate(input.triggerAt),
      repeat: input.repeat,
      notifyBeforeMinutes: input.notifyBeforeMinutes,
      done: false,
      notified: false,
      createdAt: serverTimestamp(),
    }),
  );
  return {
    reminderId: docRef.id,
    petId: input.petId,
    title: input.title,
    description: input.description,
    triggerAt: Timestamp.fromDate(input.triggerAt),
    repeat: input.repeat,
    notifyBeforeMinutes: input.notifyBeforeMinutes,
    done: false,
    createdAt: Timestamp.now(),
  };
}

export async function updateReminder(
  uid: string,
  reminderId: string,
  patch: Partial<ReminderInput>,
): Promise<void> {
  const updates = clean({
    petId: patch.petId,
    title: patch.title,
    description: patch.description,
    repeat: patch.repeat,
    notifyBeforeMinutes: patch.notifyBeforeMinutes,
    triggerAt: patch.triggerAt ? Timestamp.fromDate(patch.triggerAt) : undefined,
  });
  await updateDoc(reminderDoc(uid, reminderId), updates);
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
  uid: string,
  reminder: Reminder,
): Promise<void> {
  const next = advanceToFuture(
    (reminder.triggerAt as Timestamp).toDate(),
    reminder.repeat,
  );
  if (next) {
    await updateDoc(reminderDoc(uid, reminder.reminderId), {
      triggerAt: Timestamp.fromDate(next),
      notified: false,
    });
  } else {
    await updateDoc(reminderDoc(uid, reminder.reminderId), {
      done: true,
      doneAt: serverTimestamp(),
    });
  }
}

export async function deleteReminder(
  uid: string,
  reminderId: string,
): Promise<void> {
  await deleteDoc(reminderDoc(uid, reminderId));
}
