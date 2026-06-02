/**
 * One expense list row — category icon + vendor/category + date + amount.
 * Mirrors web pet-expense-card's row surface (read-only; edit/delete land in
 * P2c).
 */
import { StyleSheet, Text, View } from "react-native";
import type { Expense } from "@mango/shared-types";

import { CATEGORY_COLOR, CATEGORY_EMOJI } from "@/lib/expense-ui";
import { groupThousands, monthDay } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tExp = scoped("Expense");

export function ExpenseRow({ expense }: { expense: Expense }) {
  const label = tExp(`categories.${expense.category}`);
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.icon,
          { backgroundColor: `${CATEGORY_COLOR[expense.category]}33` },
        ]}
      >
        <Text style={styles.iconText}>
          {CATEGORY_EMOJI[expense.category] ?? "🧾"}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.vendor ?? label}
        </Text>
        <Text style={styles.sub}>{`${monthDay(expense.spentAt)} · ${label}`}</Text>
      </View>
      <Text style={styles.amount}>{`$${groupThousands(expense.amount)}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 17 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.ink3 },
  amount: { fontSize: 15, fontWeight: "800", color: colors.ink },
});
