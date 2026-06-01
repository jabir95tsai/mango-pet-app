"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Sparkles, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import {
  fromLocalDateInput,
  todayLocalISO,
  toLocalDateInput,
} from "@/lib/dates";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseSource,
  ExtractedReceipt,
  Pet,
} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  initial?: Expense;
  prefill?: ExtractedReceipt | null;
  /** Pre-select this pet when opening a fresh form (no initial, no
   *  prefill picks it). Spec docs/features/expenses-into-pets-page.md
   *  D4: per-pet view auto-attaches the active pet so the user
   *  doesn't have to re-pick after entering the dialog from a
   *  pet-specific surface. Falls back to `pets[0]` when absent
   *  (legacy behaviour). */
  defaultPetId?: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
};

const CATEGORIES: ExpenseCategory[] = [
  "food",
  "medical",
  "grooming",
  "toy",
  "training",
  "insurance",
  "other",
];

export function ExpenseFormDialog({
  open,
  onClose,
  pets,
  initial,
  prefill,
  defaultPetId,
  onSubmit,
}: Props) {
  const tE = useTranslations("Expense");
  const tC = useTranslations("Common");

  const [petId, setPetId] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [spentAt, setSpentAt] = useState(todayLocalISO());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [source, setSource] = useState<ExpenseSource>("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setPetId(initial.petId);
      setAmount(String(initial.amount));
      setVendor(initial.vendor ?? "");
      setCategory(initial.category);
      setSpentAt(toLocalDateInput(new Date(initial.spentAt.toMillis())));
      setNotes(initial.notes ?? "");
      setItems(initial.items ?? []);
      setSource(initial.source);
    } else {
      // defaultPetId wins over the first-pet fallback when the
      // caller passed one (per-pet entry surface); otherwise behave
      // as before for legacy callers / freehand-compose path.
      const seedPetId =
        defaultPetId && pets.some((p) => p.petId === defaultPetId)
          ? defaultPetId
          : pets[0]?.petId ?? "";
      setPetId(seedPetId);
      setAmount(prefill?.amount ? String(prefill.amount) : "");
      setVendor(prefill?.vendor ?? "");
      setCategory(prefill?.category ?? "other");
      setSpentAt(prefill?.spentAt ?? todayLocalISO());
      setNotes("");
      setItems(prefill?.items ?? []);
      setSource(prefill ? "ai_scan" : "manual");
    }
    setError(null);
  }, [open, initial, prefill, defaultPetId, pets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!petId) {
      setError("請選擇寵物");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError("金額必須大於 0");
      return;
    }

    const pet = pets.find((p) => p.petId === petId);
    const cleanItems = items.map((it) => it.trim()).filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        petId,
        petName: pet?.name,
        amount: amountNum,
        vendor: vendor.trim() || undefined,
        category,
        spentAt: fromLocalDateInput(spentAt),
        notes: notes.trim() || undefined,
        items: cleanItems.length ? cleanItems : undefined,
        source,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? tC("edit") : tE("add")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {source === "ai_scan" && !initial && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
            <Sparkles className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-zinc-700 dark:text-zinc-300">
              AI 已自動填入欄位，
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                所有欄位都可手動編輯
              </span>
              ，請確認後儲存
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <FieldLabel>{tE("fields.pet")}</FieldLabel>
          <Select value={petId} onChange={(e) => setPetId(e.target.value)} required>
            {pets.length === 0 ? (
              <option value="">{tE("noPet")}</option>
            ) : (
              pets.map((p) => (
                <option key={p.petId} value={p.petId}>
                  {p.name}
                </option>
              ))
            )}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tE("fields.amount")}</FieldLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                NT$
              </span>
              <Input
                type="number"
                step="1"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tE("fields.spentAt")}</FieldLabel>
            <Input
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tE("fields.category")}</FieldLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tE(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tE("fields.vendor")}</FieldLabel>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder={tE("vendorPlaceholder")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tE("fields.items")}</FieldLabel>
          {items.length > 0 && (
            <ul className="flex flex-col gap-1.5 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <Input
                    value={it}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = e.target.value;
                      setItems(next);
                    }}
                    className="flex-1 h-9 text-sm"
                    placeholder={tE("itemPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItems(items.filter((_, idx) => idx !== i))
                    }
                    aria-label={tE("removeItem")}
                    className="size-9 grid place-items-center rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setItems([...items, ""])}
            className="self-start"
          >
            <Plus className="size-3.5" />
            新增品項
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tE("fields.notes")}</FieldLabel>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "..." : tC("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
