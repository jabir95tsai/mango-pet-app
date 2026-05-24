"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseCard } from "./expense-card";
import { ExpenseFormDialog } from "./expense-form-dialog";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  listPersonalExpenses,
  updateExpense,
} from "@/lib/firebase/expenses";
import type { Expense, ExpenseInput, Pet } from "@/lib/types";

type Props = {
  pets: Pet[];
};

/** How many expenses to show in the overview — full archive lives at
 *  `/app/expenses` with filters / scanner / monthly summary. */
const LATEST_LIMIT = 10;

/**
 * Latest-N expenses overview — mixed across all pets, each card already
 * carries `🐾 petName` so origin is obvious. Lives at the top of
 * `/app/pets` per spec docs/features/reminders-to-pets-page.md (Home +
 * Pets IA reorg, B section). The full `/app/expenses` page stays
 * available via the "查看更多" link for cross-pet totals + receipt
 * scanner + monthly summary.
 *
 * Owns its own fetch so the parent page's pets-only useEffect stays
 * untouched (UI/UX rule against editing page-level data fetching).
 */
export function ExpensesOverviewSection({ pets }: Props) {
  const tE = useTranslations("Expense");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family } = useFamily();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(
    undefined,
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    // Pull a bit more than we show so user-side edits / deletes don't
    // shrink the visible list. The `LATEST_LIMIT` slice below is what
    // actually renders.
    const opts = { max: LATEST_LIMIT * 2 };
    try {
      const list = family
        ? await listExpenses(family.familyId, opts)
        : await listPersonalExpenses(user.uid, opts);
      setExpenses(list);
    } catch (err) {
      console.error("[expenses-overview] fetch failed:", err);
      setExpenses([]);
    }
  }, [user, family]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd(input: ExpenseInput) {
    if (!user) return;
    await createExpense({
      ...input,
      familyId: family?.familyId ?? null,
      payerUid: user.uid,
      payerName: user.displayName ?? undefined,
    });
    await refresh();
  }

  async function handleUpdate(input: ExpenseInput) {
    if (!editingExpense) return;
    await updateExpense(editingExpense.expenseId, input);
    setEditingExpense(undefined);
    await refresh();
  }

  async function handleDelete(expense: Expense) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: `${expense.vendor || tE(`categories.${expense.category}`)} · NT$ ${expense.amount.toLocaleString()}`,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteExpense(expense.expenseId);
    await refresh();
  }

  // Spec edge case: no pets → hide entirely (no pet means no expense
  // attribution makes sense; pet-create CTA below covers discovery).
  if (pets.length === 0) return null;

  const visible = expenses.slice(0, LATEST_LIMIT);

  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          {tE("title")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddingExpense(true)}>
            <Plus className="size-4" />
            {tE("add")}
          </Button>
          <Link
            href="/app/expenses"
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
          >
            查看更多 →
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={tE("title")}
          description="目前沒有開銷紀錄"
          action={
            <Button size="sm" onClick={() => setAddingExpense(true)}>
              <Plus className="size-4" />
              {tE("add")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((e) => (
            <ExpenseCard
              key={e.expenseId}
              expense={e}
              onEdit={() => setEditingExpense(e)}
              onDelete={() => handleDelete(e)}
            />
          ))}
        </div>
      )}

      <ExpenseFormDialog
        open={addingExpense}
        onClose={() => setAddingExpense(false)}
        pets={pets}
        onSubmit={handleAdd}
      />

      <ExpenseFormDialog
        open={editingExpense !== undefined}
        onClose={() => setEditingExpense(undefined)}
        pets={pets}
        initial={editingExpense}
        onSubmit={handleUpdate}
      />
    </section>
  );
}
