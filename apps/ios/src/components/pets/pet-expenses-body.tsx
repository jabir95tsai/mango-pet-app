/**
 * 開銷 tab body — 1:1 with apps/web/src/components/pets/pet-expenses-body.tsx:
 *  1. month-total bar (NT$ total + "+12% 較上月" chip vs last month; cookie
 *     tone when up, leaf when down)
 *  2. donut + "分類占比 / N 項" legend card (per-slice swatch, %, $)
 *  3. 8 fixed category filter pills (全部 + every category) — narrow the LIST
 *     only; the total bar + donut keep showing the whole month
 *  4. PetExpenseCard list with edit / delete
 * Empty month → the Wallet empty card with an add CTA (web EmptyExpenses).
 *
 * Actions:
 *  - onEdit(e): opens the edit form (owned by the pets screen). The pencil is
 *    only shown on rows the signed-in user paid for — Firestore rules only let
 *    the payer update an expense, so other members would always hit a
 *    permission error (web shows it and fails; iOS hides it).
 *  - onDelete(e): optional override. Without it the body confirms (web
 *    handleDeleteExpense copy) → deleteExpense → onChanged().
 *  - onAdd(): empty-state CTA (web opens the manual form, not the scanner).
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Plus, Wallet } from "lucide-react-native";
import type { Expense, ExpenseCategory } from "@mango/shared-types";

import { confirm, alertError } from "@/lib/confirm";
import { CATEGORY_COLOR } from "@/lib/expense-ui";
import { deleteExpense } from "@/lib/expenses-write";
import { groupThousands } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuth } from "@/state/auth-context";
import { colors, radius, shadows } from "@/theme/theme";
import { ExpenseDonut, type DonutSegment } from "./expense-donut";
import { PetExpenseCard } from "./pet-expense-card";

type CategoryFilter = ExpenseCategory | "all";

// Web FILTERS — fixed order, always all 8 (not just categories with spend).
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

function ms(ts: { toMillis?: () => number } | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

function startOfMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfLastMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
}

/** Web handleDeleteExpense: confirm with "{vendor} · NT$ {amount}". */
export async function confirmAndDeleteExpense(e: Expense): Promise<boolean> {
  const ok = await confirm({
    title: t("Common.delete"),
    message: `${e.vendor ?? ""} · NT$ ${groupThousands(e.amount)}`,
    confirmLabel: t("Common.delete"),
    cancelLabel: t("Common.cancel"),
    destructive: true,
  });
  if (!ok) return false;
  await deleteExpense(e.expenseId);
  return true;
}

export function PetExpensesBody({
  petId,
  expenses,
  onEdit,
  onDelete,
  onAdd,
  onChanged,
}: {
  petId: string;
  expenses: Expense[];
  /** Open the edit form for this expense (pencil hidden when absent). */
  onEdit?: (e: Expense) => void;
  /** Override the built-in confirm + delete. */
  onDelete?: (e: Expense) => void;
  /** Empty-state CTA (manual add form). Hidden when absent. */
  onAdd?: () => void;
  /** Called after the built-in delete succeeded (reload data). */
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Category filter pills narrow the list only; total bar + donut keep the
  // full month so the user sees the big picture regardless of the filter.
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const data = useMemo(() => {
    const monthStart = startOfMonth();
    const lastStart = startOfLastMonth();
    const mine = expenses.filter((e) => e.petId === petId);
    const thisMonth = mine.filter((e) => ms(e.spentAt) >= monthStart);
    const lastMonth = mine.filter((e) => {
      const m = ms(e.spentAt);
      return m >= lastStart && m < monthStart;
    });
    const total = thisMonth.reduce((s, e) => s + e.amount, 0);
    const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
    const pctChange =
      lastTotal === 0 ? null : Math.round(((total - lastTotal) / lastTotal) * 100);

    // Roll up by category, descending, drop empties (largest at 12 o'clock).
    const byCategory = new Map<ExpenseCategory, number>();
    for (const e of thisMonth) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    const slices: DonutSegment[] = Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      total,
      pctChange,
      slices,
      thisMonth: thisMonth.sort((a, b) => ms(b.spentAt) - ms(a.spentAt)),
    };
  }, [expenses, petId]);

  async function handleDelete(e: Expense) {
    if (onDelete) {
      onDelete(e);
      return;
    }
    if (deletingId) return;
    setDeletingId(e.expenseId);
    try {
      if (await confirmAndDeleteExpense(e)) onChanged?.();
    } catch (err) {
      alertError(err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingId(null);
    }
  }

  if (data.thisMonth.length === 0) {
    return <EmptyExpenses onAdd={onAdd} />;
  }

  const monthLabel = new Date().getMonth() + 1;
  const pct = data.pctChange;
  const pctSign = pct == null ? "" : pct >= 0 ? "+" : "";
  const pctDown = pct != null && pct < 0;
  const visible = data.thisMonth.filter((e) => filter === "all" || e.category === filter);

  return (
    <View style={styles.wrap}>
      {/* Month total bar */}
      <View style={[styles.card, styles.totalBar]}>
        <View style={styles.totalLeft}>
          <Text style={styles.monthTitle}>
            {t("PetsPage.expenses.monthTitle", { month: monthLabel })}
          </Text>
          <Text style={styles.totalLine}>
            <Text style={styles.totalUnit}>NT$ </Text>
            {groupThousands(data.total)}
          </Text>
        </View>
        {pct != null ? (
          <View style={[styles.pctChip, pctDown ? styles.pctChipDown : styles.pctChipUp]}>
            <Text style={[styles.pctText, { color: pctDown ? colors.leaf : colors.cookie }]}>
              {t("PetsPage.expenses.monthCompare", { sign: pctSign, pct })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Donut + legend */}
      {data.slices.length > 0 ? (
        <View style={[styles.card, styles.donutCard]}>
          <ExpenseDonut segments={data.slices} total={data.total} size={128} />
          <View style={styles.legend}>
            <View style={styles.legendHead}>
              <Text style={styles.legendTitle}>{t("PetsPage.expenses.byCategory")}</Text>
              <Text style={styles.legendCount}>
                {t("PetsPage.expenses.itemCount", { count: data.slices.length })}
              </Text>
            </View>
            {data.slices.map((s) => {
              const share = data.total > 0 ? Math.round((s.amount / data.total) * 100) : 0;
              const label = t(`Expense.categories.${s.category}`);
              return (
                <View
                  key={s.category}
                  style={styles.legendRow}
                  accessible
                  accessibilityLabel={`${label} ${share}% NT$ ${groupThousands(s.amount)}`}
                >
                  <View
                    style={[styles.swatch, { backgroundColor: CATEGORY_COLOR[s.category] }]}
                  />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={styles.legendPct}>{`${share}%`}</Text>
                  <Text style={styles.legendValue}>{`$${groupThousands(s.amount)}`}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Category filter pills (simple toggle, no indicator) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          const label = f === "all" ? t("Filter.all") : t(`Expense.categories.${f}`);
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.pill,
                active ? styles.pillActive : styles.pillIdle,
                pressed && !active && styles.pillPressed,
              ]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      <View style={styles.list}>
        {visible.map((e) => (
          <PetExpenseCard
            key={e.expenseId}
            expense={e}
            busy={deletingId === e.expenseId}
            onEdit={onEdit && uid && e.payerUid === uid ? () => onEdit(e) : undefined}
            onDelete={() => void handleDelete(e)}
          />
        ))}
        {/* Filter narrowed everything out → quiet hint (total bar + donut
            above still show non-zero numbers). */}
        {filter !== "all" && visible.length === 0 ? (
          <Text style={styles.filterEmpty}>{t("PetsPage.expenses.filterEmpty")}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Web EmptyExpenses: Wallet in a cookie-tint disc + message + tint add pill. */
function EmptyExpenses({ onAdd }: { onAdd?: () => void }) {
  return (
    <View style={[styles.card, styles.empty]}>
      <View style={styles.emptyDisc}>
        <Wallet size={24} color={colors.cookie} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyText}>{t("PetsPage.expenses.empty")}</Text>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          hitSlop={{ top: 4, bottom: 4 }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
        >
          <Plus size={16} color={colors.cookie} strokeWidth={2.5} />
          <Text style={styles.emptyCtaText}>{t("PetsPage.expenses.addCta")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // web flex-col gap-2.5 pt-1
  wrap: { gap: 10, paddingTop: 4 },
  // web rounded-[18px] border hairline bg-card shadow-card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  // web flex items-center justify-between px-4 py-3.5
  totalBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  totalLeft: { flexShrink: 1 },
  monthTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.ink3,
  },
  totalLine: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  totalUnit: { fontSize: 12, fontWeight: "600", letterSpacing: 0, color: colors.ink3 },
  // web inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold
  pctChip: {
    flexShrink: 0,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pctChipUp: { backgroundColor: colors.cookieTint },
  pctChipDown: { backgroundColor: colors.leafTint },
  pctText: { fontSize: 11.5, fontWeight: "700" },
  // web flex items-center gap-3.5 p-3.5
  donutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  legend: { flex: 1, minWidth: 0, gap: 10 },
  legendHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  legendTitle: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  legendCount: { fontSize: 11, fontWeight: "600", color: colors.ink3 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.ink2 },
  legendPct: {
    minWidth: 28,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  legendValue: {
    minWidth: 52,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "600",
    color: colors.ink3,
    fontVariant: ["tabular-nums"],
  },
  // web mt-1 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1
  pillScroll: { marginTop: 4, marginHorizontal: -4 },
  pillRow: { gap: 6, paddingHorizontal: 4, paddingBottom: 4 },
  // web h-8 rounded-full px-3 text-xs font-semibold
  pill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: colors.brand },
  pillIdle: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
  pillPressed: { backgroundColor: colors.bgAlt },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  pillTextActive: { color: "#ffffff" },
  // web mt-2 flex-col gap-2.5
  list: { marginTop: 8, gap: 10 },
  filterEmpty: { textAlign: "center", fontSize: 12, color: colors.ink3 },
  // web mt-3 flex-col items-center gap-3 px-6 py-10
  empty: {
    marginTop: 12,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cookieTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  // web inline-flex h-9 gap-1 rounded-full bg-cookie-tint px-3 text-sm font-bold
  emptyCta: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.cookieTint,
  },
  emptyCtaPressed: { opacity: 0.85 },
  emptyCtaText: { fontSize: 14, fontWeight: "700", color: colors.cookie },
});
