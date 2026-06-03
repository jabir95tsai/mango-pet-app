/**
 * Expenses tab body — this-month total + hand-rolled SVG donut + tappable
 * category legend (filter) + filtered expense list. Mirrors web
 * pet-expenses-body. Month-scoped (donut + list reflect the current month).
 * The camera FAB (P2d) + manual-add form (P2c) attach to this tab later.
 */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { startOfMonth } from "@mango/shared-business";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from "@mango/shared-types";

import { CATEGORY_COLOR } from "@/lib/expense-ui";
import { groupThousands } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import { ExpenseDonut, type DonutSegment } from "./expense-donut";
import { ExpenseRow } from "./expense-row";

const tPP = scoped("PetsPage");
const tExp = scoped("Expense");

function ms(ts: { toMillis?: () => number } | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

export function PetExpensesBody({
  petId,
  expenses,
}: {
  petId: string;
  expenses: Expense[];
}) {
  const [selectedCat, setSelectedCat] = useState<ExpenseCategory | null>(null);

  const monthExpenses = useMemo(() => {
    const start = startOfMonth().getTime();
    return expenses
      .filter((e) => e.petId === petId && ms(e.spentAt) >= start)
      .sort((a, b) => ms(b.spentAt) - ms(a.spentAt));
  }, [expenses, petId]);

  const total = useMemo(
    () => monthExpenses.reduce((s, e) => s + e.amount, 0),
    [monthExpenses],
  );

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return map;
  }, [monthExpenses]);

  const segments: DonutSegment[] = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((c) => ({
        category: c,
        amount: byCategory.get(c) ?? 0,
      }))
        .filter((s) => s.amount > 0)
        .sort((a, b) => b.amount - a.amount), // largest at 12 o'clock (web parity)
    [byCategory],
  );

  const visible = useMemo(
    () =>
      selectedCat
        ? monthExpenses.filter((e) => e.category === selectedCat)
        : monthExpenses,
    [monthExpenses, selectedCat],
  );

  const monthNum = new Date().getMonth() + 1;

  if (monthExpenses.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyEmoji}>🧾</Text>
        <Text style={styles.emptyText}>{tPP("expenses.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.monthTitle}>
        {tPP("expenses.monthTitle", { month: monthNum })}
      </Text>

      <View style={styles.donutWrap}>
        <ExpenseDonut segments={segments} total={total} />
      </View>

      {/* Legend / category filter pills */}
      <View style={styles.legend}>
        {segments.map((s) => {
          const active = selectedCat === s.category;
          return (
            <Pressable
              key={s.category}
              onPress={() =>
                setSelectedCat((cur) => (cur === s.category ? null : s.category))
              }
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View
                style={[styles.dot, { backgroundColor: CATEGORY_COLOR[s.category] }]}
              />
              <Text style={styles.pillLabel}>
                {tExp(`categories.${s.category}`)}
              </Text>
              <Text style={styles.pillAmount}>{`$${groupThousands(s.amount)}`}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Filtered list */}
      <View style={styles.list}>
        {visible.length === 0 ? (
          <Text style={styles.filterEmpty}>{tPP("expenses.filterEmpty")}</Text>
        ) : (
          visible.map((e) => <ExpenseRow key={e.expenseId} expense={e} />)
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  monthTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    paddingHorizontal: spacing.xs,
  },
  donutWrap: { alignItems: "center", paddingVertical: spacing.sm },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillActive: { borderColor: colors.brand, backgroundColor: colors.cardSoft },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pillLabel: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  pillAmount: { fontSize: 12, fontWeight: "700", color: colors.ink },
  list: { gap: spacing.sm },
  filterEmpty: {
    fontSize: 13,
    color: colors.ink3,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.ink3 },
});
