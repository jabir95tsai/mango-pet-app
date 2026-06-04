/**
 * Expense card — 1:1 with apps/web/src/components/pets/pet-expense-card.tsx.
 * 42px category-tinted icon square + title (vendor | category) + optional AI
 * chip + 「MM/dd · 付款人 付」line + a right-aligned 「NT$ amount」(NT$ prefix
 * superscript-ish small, amount bold). Optional edit / trash column. Used in
 * the 概覽「最近開銷」row, matching web.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Expense, ExpenseCategory } from "@mango/shared-types";

import { CATEGORY_EMOJI } from "@/lib/expense-ui";
import { groupThousands } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors, radius, shadows } from "@/theme/theme";

const tC = scoped("Common");
const tExp = scoped("Expense");

type ToneSpec = { bg: string; fg: string };

const TONE: Record<ExpenseCategory, ToneSpec> = {
  food: { bg: colors.cookieTint, fg: colors.cookie },
  medical: { bg: colors.leafTint, fg: colors.leaf },
  grooming: { bg: colors.peachTint, fg: colors.cookie },
  toy: { bg: colors.brandTint, fg: colors.brandDeep },
  training: { bg: colors.leafTint, fg: colors.leaf },
  insurance: { bg: colors.bgAlt, fg: colors.ink2 },
  other: { bg: colors.bgAlt, fg: colors.ink2 },
};

function mmdd(ts: { toMillis?: () => number } | undefined): string {
  const millis = ts?.toMillis?.() ?? 0;
  if (!millis) return "";
  const d = new Date(millis);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

export function PetExpenseCard({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const tone = TONE[expense.category];

  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: tone.bg }]}>
        <Text style={[styles.iconText, { color: tone.fg }]}>
          {CATEGORY_EMOJI[expense.category] ?? "🧾"}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {expense.vendor || tExp(`categories.${expense.category}`)}
          </Text>
          {expense.source === "ai_scan" ? (
            <View style={styles.aiChip}>
              <Text style={styles.aiText}>✨ AI</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.metaLine} numberOfLines={1}>
          {mmdd(expense.spentAt)}
          {expense.payerName ? ` · ${expense.payerName} 付` : ""}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>
          <Text style={styles.amountUnit}>NT$ </Text>
          {groupThousands(expense.amount)}
        </Text>
        {onEdit || onDelete ? (
          <View style={styles.actionCol}>
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={tC("edit")}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              >
                <Text style={styles.iconBtnText}>✏️</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={tC("delete")}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              >
                <Text style={styles.iconBtnText}>🗑️</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flexShrink: 1, fontSize: 14.5, fontWeight: "700", letterSpacing: -0.1, color: colors.ink },
  aiChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, color: colors.brandDeep },
  metaLine: { fontSize: 11.5, color: colors.ink3 },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  amount: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3, color: colors.ink },
  amountUnit: { fontSize: 11, fontWeight: "600", color: colors.ink3 },
  actionCol: { flexDirection: "column" },
  iconBtn: { width: 28, height: 28, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 13 },
  pressed: { opacity: 0.6 },
});
