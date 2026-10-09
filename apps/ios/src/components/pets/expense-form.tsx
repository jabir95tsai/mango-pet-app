/**
 * Expense add / edit form — 1:1 with apps/web/src/components/expenses/
 * expense-form-dialog.tsx:
 *  - AI-prefill banner (source "ai_scan", new expense only)
 *  - pet picker (default = the active pet) → amount (NT$ prefix) → date →
 *    category (default "other", like web) → vendor → editable line items
 *    (+ 新增品項 / remove) → notes
 *  - title Expense.add, or Common.edit when editing
 *  - save errors are surfaced (alertError) and the sheet stays open
 *
 * Writes go through the expenses-write layer: createExpense (new; payer = the
 * signed-in user, familyId = the current scope) or updateExpense (edit; web's
 * field set, plus items only when the user changed them). The date is stored
 * as local midnight, like web's fromLocalDateInput.
 *
 * Reused by the receipt scanner flow: the pets screen passes `initial` (AI
 * prefill), `source="ai_scan"` and `items`.
 */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Plus, Sparkles, X } from "lucide-react-native";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type ExpenseSource,
  type Pet,
} from "@mango/shared-types";

import { Button, Field, IconButton, Input, Textarea } from "@/components/ui";
import { alertError } from "@/lib/confirm";
import { createExpense, updateExpense } from "@/lib/expenses-write";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import { DateField, FormSheet, SelectField } from "./form-sheet";

export type ExpenseFormInitial = {
  amount?: number;
  vendor?: string;
  category?: ExpenseCategory;
  spentAt?: Date;
};

/** Local midnight of the picked day (web fromLocalDateInput). */
function dayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameItems(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Interpolation sentinel used to bold the middle clause of the AI notice.
const EDITABLE_MARK = "\u0000";

export function ExpenseForm({
  familyId,
  uid,
  displayName,
  petId,
  petName,
  pets,
  expense,
  initial,
  source = "manual",
  items,
  onClose,
  onSaved,
}: {
  familyId: string | null;
  uid: string;
  displayName?: string;
  /** Default pet for a new expense (the active pet). */
  petId: string;
  petName?: string;
  /** Pet picker options (web Select). Without it only the default pet shows. */
  pets?: Pet[];
  /** Edit mode: seed from this expense and save with updateExpense. */
  expense?: Expense;
  /** AI-scan / caller prefill for a NEW expense. */
  initial?: ExpenseFormInitial;
  source?: ExpenseSource;
  /** Prefilled line items for a NEW expense (AI scan). */
  items?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = expense !== undefined;

  const petOptions = useMemo(() => {
    const opts = (pets ?? []).map((p) => ({ value: p.petId, label: p.name }));
    const ensure = (id: string | undefined, label: string | undefined) => {
      if (id && !opts.some((o) => o.value === id)) {
        opts.unshift({ value: id, label: label || "—" });
      }
    };
    // Editing an expense whose pet is outside the list still shows its pet.
    if (editing) ensure(expense.petId, expense.petName);
    else ensure(petId, petName);
    return opts;
  }, [pets, editing, expense, petId, petName]);

  const [selPetId, setSelPetId] = useState<string>(() =>
    editing ? expense.petId : petId,
  );
  const [amount, setAmount] = useState(() =>
    editing
      ? String(expense.amount)
      : initial?.amount != null
        ? String(initial.amount)
        : "",
  );
  const [spentAt, setSpentAt] = useState<Date>(() =>
    editing
      ? (expense.spentAt?.toDate?.() ?? new Date())
      : (initial?.spentAt ?? new Date()),
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    () => (editing ? expense.category : initial?.category) ?? "other",
  );
  const [vendor, setVendor] = useState(() =>
    editing ? (expense.vendor ?? "") : (initial?.vendor ?? ""),
  );
  const [lineItems, setLineItems] = useState<string[]>(() =>
    editing ? [...(expense.items ?? [])] : [...(items ?? [])],
  );
  const [notes, setNotes] = useState(() => (editing ? (expense.notes ?? "") : ""));
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveSource: ExpenseSource = editing ? expense.source : source;
  const showAiBanner = effectiveSource === "ai_scan" && !editing;

  const amt = Number(amount.replace(/,/g, "").trim());
  const valid = !!selPetId && amount.trim() !== "" && Number.isFinite(amt) && amt > 0;

  async function save() {
    if (!valid || saving) return;
    // Denormalised name of the picked pet (web: pets.find(...)?.name).
    const selPetName =
      pets?.find((p) => p.petId === selPetId)?.name ??
      (editing && selPetId === expense.petId ? expense.petName : undefined) ??
      (selPetId === petId ? petName : undefined);
    const cleanItems = lineItems.map((it) => it.trim()).filter(Boolean);
    const common = {
      petId: selPetId,
      petName: selPetName,
      amount: amt,
      vendor: vendor.trim() || undefined,
      category,
      spentAt: dayOf(spentAt),
      notes: notes.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        const itemsChanged = !sameItems(cleanItems, expense.items ?? []);
        await updateExpense(expense.expenseId, {
          ...common,
          ...(itemsChanged ? { items: cleanItems } : {}),
        });
      } else {
        await createExpense({
          ...common,
          familyId,
          payerUid: uid,
          payerName: displayName,
          items: cleanItems.length ? cleanItems : undefined,
          source: effectiveSource,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      alertError(e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  function updateItem(i: number, value: string) {
    setLineItems((cur) => cur.map((it, idx) => (idx === i ? value : it)));
  }
  function removeItem(i: number) {
    setFocusIdx(null);
    setLineItems((cur) => cur.filter((_, idx) => idx !== i));
  }
  function addItem() {
    setFocusIdx(lineItems.length);
    setLineItems((cur) => [...cur, ""]);
  }

  const [noticeHead, noticeTail] = t("Expense.aiPrefill.notice", {
    editable: EDITABLE_MARK,
  }).split(EDITABLE_MARK);

  return (
    <FormSheet
      visible
      title={editing ? t("Common.edit") : t("Expense.add")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!valid}
    >
      {showAiBanner ? (
        <View style={styles.aiBanner} accessibilityRole="text">
          <Sparkles size={16} color={colors.brand} strokeWidth={2} style={styles.aiIcon} />
          <Text style={styles.aiText}>
            {noticeHead}
            <Text style={styles.aiStrong}>{t("Expense.aiPrefill.editable")}</Text>
            {noticeTail ?? ""}
          </Text>
        </View>
      ) : null}

      <SelectField
        label={t("Expense.fields.pet")}
        value={selPetId}
        onChange={setSelPetId}
        options={petOptions}
      />

      <Field label={t("Expense.fields.amount")}>
        <View>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            autoFocus={!editing && initial?.amount == null}
            accessibilityLabel={`${t("Expense.fields.amount")} NT$`}
            style={styles.amountInput}
          />
          <View style={styles.amountPrefix} pointerEvents="none">
            <Text style={styles.amountPrefixText}>NT$</Text>
          </View>
        </View>
      </Field>

      <DateField label={t("Expense.fields.spentAt")} value={spentAt} onChange={setSpentAt} />

      <SelectField
        label={t("Expense.fields.category")}
        value={category}
        onChange={setCategory}
        options={EXPENSE_CATEGORIES.map((c) => ({
          value: c,
          label: t(`Expense.categories.${c}`),
        }))}
      />

      <Field label={t("Expense.fields.vendor")}>
        <Input
          value={vendor}
          onChangeText={setVendor}
          placeholder={t("Expense.vendorPlaceholder")}
          accessibilityLabel={t("Expense.fields.vendor")}
        />
      </Field>

      <Field label={t("Expense.fields.items")}>
        {lineItems.length > 0 ? (
          <View style={styles.itemList}>
            {lineItems.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                <Input
                  value={it}
                  onChangeText={(v) => updateItem(i, v)}
                  placeholder={t("Expense.itemPlaceholder")}
                  accessibilityLabel={`${t("Expense.fields.items")} ${i + 1}`}
                  autoFocus={focusIdx === i}
                  style={styles.itemInput}
                />
                <IconButton
                  icon={X}
                  size={36}
                  iconSize={16}
                  tone="ghost"
                  accessibilityLabel={t("Expense.removeItem")}
                  onPress={() => removeItem(i)}
                />
              </View>
            ))}
          </View>
        ) : null}
        <Button
          label={t("Expense.addItem")}
          variant="ghost"
          size="sm"
          icon={Plus}
          onPress={addItem}
          style={styles.addItemBtn}
        />
      </Field>

      <Field label={t("Expense.fields.notes")}>
        <Textarea
          value={notes}
          onChangeText={setNotes}
          accessibilityLabel={t("Expense.fields.notes")}
        />
      </Field>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  // web flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm → mango tint
  aiBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.brandTint,
    borderRadius: radius.md,
    padding: 12,
  },
  aiIcon: { marginTop: 2 },
  aiText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  aiStrong: { fontWeight: "600", color: colors.brandDeep },
  // web pl-10 + absolute "NT$" at left-3, text-xs ink3
  amountInput: { paddingLeft: 40, fontVariant: ["tabular-nums"] },
  amountPrefix: {
    position: "absolute",
    left: 12,
    top: 0,
    height: 44,
    justifyContent: "center",
  },
  amountPrefixText: { fontSize: 12, color: colors.ink3 },
  // web ul flex-col gap-1.5 rounded-lg bg-zinc-50 p-2 → bgAlt
  itemList: {
    gap: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    padding: spacing.sm,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemInput: { flex: 1 },
  addItemBtn: { alignSelf: "flex-start", marginTop: 2 },
});
