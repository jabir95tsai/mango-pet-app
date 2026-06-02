/**
 * iOS Pets-screen READ layer — reminders + expenses for the active scope, via
 * @react-native-firebase/firestore. Query shapes mirror the web helpers
 * byte-for-byte (apps/web/src/lib/firebase/{reminders,expenses}.ts) so both
 * platforms read the same docs through the same composite indexes:
 *   - personal: where(<owner>==uid) + where(familyId==null) + orderBy(<ts>)
 *   - family:   where(familyId==fam) + orderBy(<ts>)
 *
 * Pets / walks / family-scope resolution are reused from `@/lib/walk-data`
 * (already shipped + indexed in P1) rather than duplicated.
 *
 * READS ONLY. Writes (createReminder / createExpense / callables) land in P2c+.
 */
import firestore from "@react-native-firebase/firestore";
import type { Expense, Reminder } from "@mango/shared-types";

/** Same 200-row cap the web expenses/walks lists pull. */
export const EXPENSES_LIMIT = 200;

/**
 * Reminders in the active scope, ordered by triggerAt asc (soonest first).
 * NOT done-filtered here — callers filter `!done` + by petId client-side
 * (mirrors web `listReminders` / `listPersonalReminders`).
 */
export async function listRemindersForScope(
  familyId: string | null,
  uid: string,
): Promise<Reminder[]> {
  const col = firestore().collection("reminders");
  const q =
    familyId !== null
      ? col.where("familyId", "==", familyId).orderBy("triggerAt", "asc")
      : col
          .where("createdByUid", "==", uid)
          .where("familyId", "==", null)
          .orderBy("triggerAt", "asc");
  const snap = await q.get();
  return snap.docs.map(
    (d) =>
      ({ ...(d.data() as object), reminderId: d.id }) as unknown as Reminder,
  );
}

/**
 * Expenses in the active scope, newest first, capped. Pet-scoping +
 * month-filtering happen client-side (mirrors web `listExpenses` /
 * `listPersonalExpenses`).
 */
export async function listExpensesForScope(
  familyId: string | null,
  uid: string,
  max: number = EXPENSES_LIMIT,
): Promise<Expense[]> {
  const col = firestore().collection("expenses");
  const base =
    familyId !== null
      ? col.where("familyId", "==", familyId).orderBy("spentAt", "desc")
      : col
          .where("payerUid", "==", uid)
          .where("familyId", "==", null)
          .orderBy("spentAt", "desc");
  const snap = await base.limit(max).get();
  return snap.docs.map(
    (d) => ({ ...(d.data() as object), expenseId: d.id }) as unknown as Expense,
  );
}
