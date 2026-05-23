import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./config";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "@/lib/types";

const EXPENSES = "expenses";

function expensesCol() {
  return collection(getDb(), EXPENSES);
}

function expenseDoc(expenseId: string) {
  return doc(getDb(), EXPENSES, expenseId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export type CreateExpenseArgs = ExpenseInput & {
  /** Pass `null` to create a personal-mode expense (lives outside any
   *  family; permission gated by `payerUid == self`). */
  familyId: string | null;
  payerUid: string;
  payerName?: string;
};

export async function createExpense(
  args: CreateExpenseArgs,
): Promise<Expense> {
  // familyId preserved explicitly (including null) so the field is
  // queryable as `where("familyId", "==", null)`.
  const data = {
    familyId: args.familyId,
    ...clean({
      payerUid: args.payerUid,
      payerName: args.payerName,
      // Mirror to ownerUid so legacy queries that group by ownerUid still
      // attribute correctly to the payer.
      ownerUid: args.payerUid,
      petId: args.petId,
      petName: args.petName,
      amount: args.amount,
      currency: "TWD" as const,
      vendor: args.vendor,
      category: args.category,
      spentAt: Timestamp.fromDate(args.spentAt),
      notes: args.notes,
      items: args.items?.length ? args.items : undefined,
      source: args.source,
      createdAt: serverTimestamp(),
    }),
  };

  const docRef = await addDoc(expensesCol(), data);
  const snap = await getDoc(docRef);
  return { ...(snap.data() as Expense), expenseId: docRef.id };
}

export async function listExpenses(
  familyId: string,
  opts?: {
    petId?: string;
    category?: ExpenseCategory;
    sinceMs?: number;
    max?: number;
  },
): Promise<Expense[]> {
  const max = opts?.max ?? 200;
  const snap = await getDocs(
    query(
      expensesCol(),
      where("familyId", "==", familyId),
      orderBy("spentAt", "desc"),
      limit(max),
    ),
  );
  let rows = snap.docs.map((d) => ({
    ...(d.data() as Expense),
    expenseId: d.id,
  }));
  if (opts?.petId) rows = rows.filter((e) => e.petId === opts.petId);
  if (opts?.category) rows = rows.filter((e) => e.category === opts.category);
  if (opts?.sinceMs)
    rows = rows.filter((e) => e.spentAt.toMillis() >= opts.sinceMs!);
  return rows;
}

/** Personal-mode counterpart of {@link listExpenses}. Index:
 *  `(payerUid ASC, familyId ASC, spentAt DESC)`. */
export async function listPersonalExpenses(
  payerUid: string,
  opts?: {
    petId?: string;
    category?: ExpenseCategory;
    sinceMs?: number;
    max?: number;
  },
): Promise<Expense[]> {
  const max = opts?.max ?? 200;
  const snap = await getDocs(
    query(
      expensesCol(),
      where("payerUid", "==", payerUid),
      where("familyId", "==", null),
      orderBy("spentAt", "desc"),
      limit(max),
    ),
  );
  let rows = snap.docs.map((d) => ({
    ...(d.data() as Expense),
    expenseId: d.id,
  }));
  if (opts?.petId) rows = rows.filter((e) => e.petId === opts.petId);
  if (opts?.category) rows = rows.filter((e) => e.category === opts.category);
  if (opts?.sinceMs)
    rows = rows.filter((e) => e.spentAt.toMillis() >= opts.sinceMs!);
  return rows;
}

export async function listExpensesInRange(
  familyId: string,
  fromMs: number,
  toMs: number,
): Promise<Expense[]> {
  const snap = await getDocs(
    query(
      expensesCol(),
      where("familyId", "==", familyId),
      where("spentAt", ">=", Timestamp.fromMillis(fromMs)),
      where("spentAt", "<=", Timestamp.fromMillis(toMs)),
      orderBy("spentAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({
    ...(d.data() as Expense),
    expenseId: d.id,
  }));
}

export async function updateExpense(
  expenseId: string,
  patch: Partial<ExpenseInput>,
): Promise<void> {
  const updates = clean({
    petId: patch.petId,
    petName: patch.petName,
    amount: patch.amount,
    vendor: patch.vendor,
    category: patch.category,
    spentAt: patch.spentAt ? Timestamp.fromDate(patch.spentAt) : undefined,
    notes: patch.notes,
  });
  await updateDoc(expenseDoc(expenseId), updates);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await deleteDoc(expenseDoc(expenseId));
}

/** One-shot legacy migration: users/{uid}/expenses/* → top-level. */
export async function migrateLegacyExpensesToFamily(
  legacyUid: string,
  familyId: string,
): Promise<number> {
  const legacy = await getDocs(
    collection(getDb(), "users", legacyUid, "expenses"),
  );
  if (legacy.empty) return 0;

  let migrated = 0;
  const docs = legacy.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const slice = docs.slice(i, i + 400);
    const batch = writeBatch(getDb());
    for (const legacyDoc of slice) {
      const newRef = doc(getDb(), EXPENSES, legacyDoc.id);
      const existing = await getDoc(newRef);
      if (existing.exists()) continue;
      const data = legacyDoc.data();
      batch.set(newRef, {
        ...data,
        familyId,
        payerUid: data.ownerUid ?? legacyUid,
      });
      migrated++;
    }
    if (migrated > 0) await batch.commit();
  }
  return migrated;
}

// ── Aggregations ──

export type CategoryTotal = {
  category: ExpenseCategory;
  total: number;
  count: number;
};

export function aggregateByCategory(expenses: Expense[]): CategoryTotal[] {
  const map = new Map<ExpenseCategory, CategoryTotal>();
  for (const e of expenses) {
    const cur = map.get(e.category) ?? {
      category: e.category,
      total: 0,
      count: 0,
    };
    cur.total += e.amount;
    cur.count += 1;
    map.set(e.category, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export type MonthlyTotal = {
  month: string; // YYYY-MM
  total: number;
};

export function aggregateByMonth(expenses: Expense[]): MonthlyTotal[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const d = new Date(e.spentAt.toMillis());
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(month, (map.get(month) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Per-payer breakdown: who paid how much in this set of expenses. */
export type PayerTotal = { uid: string; name?: string; total: number; count: number };

export function aggregateByPayer(expenses: Expense[]): PayerTotal[] {
  const map = new Map<string, PayerTotal>();
  for (const e of expenses) {
    const uid = e.payerUid ?? e.ownerUid;
    if (!uid) continue;
    const cur = map.get(uid) ?? {
      uid,
      name: e.payerName,
      total: 0,
      count: 0,
    };
    cur.total += e.amount;
    cur.count += 1;
    if (!cur.name && e.payerName) cur.name = e.payerName;
    map.set(uid, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
