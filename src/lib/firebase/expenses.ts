import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "@/lib/types";

function expensesCol(uid: string) {
  return collection(getDb(), "users", uid, "expenses");
}

function expenseDoc(uid: string, expenseId: string) {
  return doc(getDb(), "users", uid, "expenses", expenseId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export async function createExpense(
  uid: string,
  input: ExpenseInput,
): Promise<Expense> {
  const data = clean({
    ownerUid: uid,
    petId: input.petId,
    petName: input.petName,
    amount: input.amount,
    currency: "TWD" as const,
    vendor: input.vendor,
    category: input.category,
    spentAt: Timestamp.fromDate(input.spentAt),
    notes: input.notes,
    items: input.items?.length ? input.items : undefined,
    source: input.source,
    createdAt: serverTimestamp(),
  });

  const docRef = await addDoc(expensesCol(uid), data);
  return {
    expenseId: docRef.id,
    ownerUid: uid,
    petId: input.petId,
    petName: input.petName,
    amount: input.amount,
    currency: "TWD",
    vendor: input.vendor,
    category: input.category,
    spentAt: Timestamp.fromDate(input.spentAt),
    notes: input.notes,
    items: input.items,
    source: input.source,
    createdAt: Timestamp.now(),
  };
}

export async function listExpenses(
  uid: string,
  opts?: {
    petId?: string;
    category?: ExpenseCategory;
    sinceMs?: number;
    max?: number;
  },
): Promise<Expense[]> {
  const max = opts?.max ?? 200;
  const snap = await getDocs(
    query(expensesCol(uid), orderBy("spentAt", "desc"), limit(max)),
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
  uid: string,
  fromMs: number,
  toMs: number,
): Promise<Expense[]> {
  const snap = await getDocs(
    query(
      expensesCol(uid),
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
  uid: string,
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
  await updateDoc(expenseDoc(uid, expenseId), updates);
}

export async function deleteExpense(
  uid: string,
  expenseId: string,
): Promise<void> {
  await deleteDoc(expenseDoc(uid, expenseId));
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
