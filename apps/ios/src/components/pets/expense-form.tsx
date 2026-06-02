/**
 * Expense add form — amount + category + vendor + date + notes. Writes via the
 * expenses-write layer (createExpense, source "manual"). Reused by P2d's
 * receipt scanner, which passes `initial` (AI-extracted prefill), `source`
 * "ai_scan", and `items`. Mirrors web expense-form.
 */
import { useState } from "react";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseSource,
} from "@mango/shared-types";

import { createExpense } from "@/lib/expenses-write";
import { scoped } from "@/lib/i18n";
import { FormSheet, DateField, SelectField, TextField } from "./form-sheet";

const tExp = scoped("Expense");

export type ExpenseFormInitial = {
  amount?: number;
  vendor?: string;
  category?: ExpenseCategory;
  spentAt?: Date;
};

export function ExpenseForm({
  familyId,
  uid,
  displayName,
  petId,
  petName,
  initial,
  source = "manual",
  items,
  onClose,
  onSaved,
}: {
  familyId: string | null;
  uid: string;
  displayName?: string;
  petId: string;
  petName?: string;
  initial?: ExpenseFormInitial;
  source?: ExpenseSource;
  items?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(
    initial?.amount != null ? String(initial.amount) : "",
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    initial?.category ?? "food",
  );
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [spentAt, setSpentAt] = useState<Date>(initial?.spentAt ?? new Date());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const amt = parseFloat(amount);
  const valid = Number.isFinite(amt) && amt > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await createExpense({
        familyId,
        payerUid: uid,
        payerName: displayName,
        petId,
        petName,
        amount: amt,
        vendor: vendor.trim(),
        category,
        spentAt,
        notes: notes.trim(),
        items,
        source,
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      visible
      title={tExp("add")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!valid}
    >
      <TextField
        label={tExp("fields.amount")}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        autoFocus
      />
      <SelectField
        label={tExp("fields.category")}
        value={category}
        onChange={setCategory}
        options={EXPENSE_CATEGORIES.map((c) => ({
          value: c,
          label: tExp(`categories.${c}`),
        }))}
      />
      <TextField
        label={tExp("fields.vendor")}
        value={vendor}
        onChangeText={setVendor}
        placeholder={tExp("vendorPlaceholder")}
      />
      <DateField
        label={tExp("fields.spentAt")}
        value={spentAt}
        onChange={setSpentAt}
      />
      <TextField
        label={tExp("fields.notes")}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
    </FormSheet>
  );
}
