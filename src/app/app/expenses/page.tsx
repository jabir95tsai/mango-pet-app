"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Plus, Receipt, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseCard } from "@/components/expenses/expense-card";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseSummary } from "@/components/expenses/expense-summary";
import { ReceiptScanner } from "@/components/expenses/receipt-scanner";
import {
  aggregateByCategory,
  aggregateByMonth,
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "@/lib/firebase/expenses";
import { listPets } from "@/lib/firebase/pets";
import { cn } from "@/lib/utils";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExtractedReceipt,
  Pet,
} from "@/lib/types";

type CategoryFilter = ExpenseCategory | "all";

const FILTERS: CategoryFilter[] = [
  "all",
  "food",
  "medical",
  "grooming",
  "toy",
  "training",
  "insurance",
  "other",
];

export default function ExpensesPage() {
  const t = useTranslations("Nav");
  const tE = useTranslations("Expense");
  const tC = useTranslations("Common");
  const tF = useTranslations("Filter");
  const askConfirm = useConfirm();
  const { user } = useAuth();

  const [pets, setPets] = useState<Pet[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [petFilter, setPetFilter] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [prefill, setPrefill] = useState<ExtractedReceipt | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [petList, exList] = await Promise.all([
        listPets(user.uid),
        listExpenses(user.uid),
      ]);
      setPets(petList);
      setExpenses(exList);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (petFilter !== "all" && e.petId !== petFilter) return false;
      return true;
    });
  }, [expenses, filter, petFilter]);

  const total = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered],
  );
  const byCategory = useMemo(() => aggregateByCategory(filtered), [filtered]);
  const byMonth = useMemo(() => aggregateByMonth(filtered), [filtered]);

  function openAddManual() {
    setEditing(undefined);
    setPrefill(null);
    setFormOpen(true);
  }

  function openScanner() {
    setEditing(undefined);
    setPrefill(null);
    setScannerOpen(true);
  }

  function handleExtracted(data: ExtractedReceipt) {
    setPrefill(data);
    setFormOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setPrefill(null);
    setFormOpen(true);
  }

  async function handleSubmit(input: ExpenseInput) {
    if (!user) return;
    if (editing) {
      await updateExpense(user.uid, editing.expenseId, input);
    } else {
      await createExpense(user.uid, input);
    }
    await refresh();
  }

  async function handleDelete(expense: Expense) {
    if (!user) return;
    const ok = await askConfirm({
      title: tC("delete"),
      message: `${expense.vendor || tE(`categories.${expense.category}`)} · NT$ ${expense.amount.toLocaleString()}`,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteExpense(user.uid, expense.expenseId);
    await refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <RouteHeader title={t("expenses")} subtitle="拍收據 AI 自動記帳" />
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          size="md"
          className="flex-1"
          onClick={openScanner}
          disabled={pets.length === 0}
        >
          <Camera className="size-4" />
          {tE("scanReceipt")}
        </Button>
        <Button
          size="md"
          variant="secondary"
          onClick={openAddManual}
          disabled={pets.length === 0}
        >
          <Plus className="size-4" />
          {tE("manual")}
        </Button>
      </div>

      {pets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="先新增寵物"
          description="記帳前需要先建立寵物資料，才能 tag 是哪隻的開銷。"
        />
      ) : (
        <>
          {pets.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-3">
              <button
                type="button"
                onClick={() => setPetFilter("all")}
                className={cn(
                  "shrink-0 px-3 h-7 rounded-full text-xs font-medium transition-colors",
                  petFilter === "all"
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800",
                )}
              >
                {tF("allPets")}
              </button>
              {pets.map((p) => (
                <button
                  key={p.petId}
                  type="button"
                  onClick={() => setPetFilter(p.petId)}
                  className={cn(
                    "shrink-0 px-3 h-7 rounded-full text-xs font-medium transition-colors",
                    petFilter === p.petId
                      ? "bg-amber-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800",
                  )}
                >
                  🐾 {p.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
            {FILTERS.map((f) => {
              const active = filter === f;
              const label = f === "all" ? tF("all") : tE(`categories.${f}`);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "shrink-0 px-3 h-7 rounded-full text-xs font-medium transition-colors",
                    active
                      ? "bg-amber-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <ExpenseSummary
            total={total}
            byCategory={byCategory}
            byMonth={byMonth}
          />

          {loading ? (
            <p className="text-sm text-zinc-500">{tC("loading")}</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="尚無開銷"
              description="拍張收據或手動新增第一筆。"
              action={
                <Button onClick={openScanner} disabled={pets.length === 0}>
                  <Camera className="size-4" />
                  {tE("scanReceipt")}
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((e) => (
                <ExpenseCard
                  key={e.expenseId}
                  expense={e}
                  onEdit={() => openEdit(e)}
                  onDelete={() => handleDelete(e)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ReceiptScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onExtracted={handleExtracted}
      />

      <ExpenseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        pets={pets}
        initial={editing}
        prefill={prefill}
        onSubmit={handleSubmit}
      />
    </>
  );
}
