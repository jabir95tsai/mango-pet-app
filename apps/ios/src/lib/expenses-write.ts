/**
 * iOS expenses WRITE layer — direct Firestore writes mirroring
 * apps/web/src/lib/firebase/expenses.ts (createExpense / updateExpense /
 * deleteExpense). ownerUid is mirrored to payerUid for legacy attribution
 * queries, same as web.
 */
import firestore from "@react-native-firebase/firestore";
import type { ExpenseInput } from "@mango/shared-types";

import { clean, deleteField, serverTimestamp, tsFromDate } from "./write-utils";

const col = () => firestore().collection("expenses");
const refOf = (id: string) => col().doc(id);

export type CreateExpenseArgs = ExpenseInput & {
  /** `null` → personal-mode expense (gated by payerUid == self). */
  familyId: string | null;
  payerUid: string;
  payerName?: string;
};

export async function createExpense(args: CreateExpenseArgs): Promise<string> {
  const ref = await col().add({
    familyId: args.familyId,
    ...clean({
      payerUid: args.payerUid,
      payerName: args.payerName,
      // Mirror to ownerUid so legacy ownerUid-grouped queries attribute right.
      ownerUid: args.payerUid,
      petId: args.petId,
      petName: args.petName,
      amount: args.amount,
      currency: "TWD",
      vendor: args.vendor,
      category: args.category,
      spentAt: tsFromDate(args.spentAt),
      notes: args.notes,
      items: args.items?.length ? args.items : undefined,
      source: args.source,
      createdAt: serverTimestamp(),
    }),
  });
  return ref.id;
}

/**
 * Patch an expense. Same field set + clean() semantics as web updateExpense
 * (blank strings / undefined are skipped, never cleared).
 *
 * iOS addition: `items` is written only when the caller passes it — a
 * non-empty array replaces the line items, an empty array removes the field
 * (same "absent when empty" shape createExpense writes). Web's updateExpense
 * ignores `items`, so the web edit dialog silently drops item edits; the iOS
 * form only passes `items` when the user actually changed them, so an edit
 * that leaves items alone sends exactly web's payload. Rules: payer-only
 * update, no affectedKeys restriction.
 */
export async function updateExpense(
  expenseId: string,
  patch: Partial<ExpenseInput>,
): Promise<void> {
  const updates: Record<string, unknown> = clean({
    petId: patch.petId,
    petName: patch.petName,
    amount: patch.amount,
    vendor: patch.vendor,
    category: patch.category,
    spentAt: patch.spentAt ? tsFromDate(patch.spentAt) : undefined,
    notes: patch.notes,
  });
  if (patch.items !== undefined) {
    updates.items = patch.items.length ? patch.items : deleteField();
  }
  await refOf(expenseId).update(updates);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await refOf(expenseId).delete();
}
