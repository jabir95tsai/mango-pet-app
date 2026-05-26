"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Plus, Receipt, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
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
  listPersonalExpenses,
  updateExpense,
} from "@/lib/firebase/expenses";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
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
  const { family, loading: familyLoading } = useFamily();
  const searchParams = useSearchParams();

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
      // allSettled so an index-still-building expense query doesn't
      // also blank the pet picker.
      const [petR, exR] = await Promise.allSettled([
        family ? listPets(family.familyId) : listPersonalPets(user.uid),
        family
          ? listExpenses(family.familyId)
          : listPersonalExpenses(user.uid),
      ]);
      setPets(petR.status === "fulfilled" ? petR.value : []);
      setExpenses(exR.status === "fulfilled" ? exR.value : []);
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  // Deep-link: settings 的「拍收據」quick-action 帶 ?action=scan 進來，
  // 等 pets 載完（scanner 在 pets.length === 0 時 disabled）再自動開
  // 一次。Ref 守住「只開一次」— user 手動關掉 scanner 不會被 effect
  // 再彈開，但完整 page reload 仍會重彈（URL deep-link 行為）。
  const autoOpenedScannerRef = useRef(false);
  useEffect(() => {
    if (loading || pets.length === 0) return;
    if (autoOpenedScannerRef.current) return;
    if (searchParams?.get("action") === "scan") {
      autoOpenedScannerRef.current = true;
      setScannerOpen(true);
    }
  }, [searchParams, loading, pets.length]);

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
      await updateExpense(editing.expenseId, input);
    } else {
      await createExpense({
        ...input,
        familyId: family?.familyId ?? null,
        payerUid: user.uid,
        payerName: user.displayName ?? undefined,
      });
    }
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <RouteHeader
          title={t("expenses")}
          subtitle="拍收據 AI 自動記帳"
          className="mb-0"
        />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
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
          className="sm:w-auto"
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
                aria-pressed={petFilter === "all"}
                className={cn(
                  "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                  petFilter === "all"
                    ? "bg-amber-500 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-800",
                )}
              >
                {tF("allPets")}
              </button>
              {pets.map((p) => (
                <button
                  key={p.petId}
                  type="button"
                  onClick={() => setPetFilter(p.petId)}
                  aria-pressed={petFilter === p.petId}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    petFilter === p.petId
                      ? "bg-amber-500 text-white"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-800",
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
                  aria-pressed={active}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-800",
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
