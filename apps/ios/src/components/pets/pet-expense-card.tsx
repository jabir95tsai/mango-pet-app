/**
 * Expense card — 1:1 with apps/web/src/components/pets/pet-expense-card.tsx.
 * 42px category-tinted icon square (lucide icon per category) + title
 * (vendor | category) + optional ✦AI chip + "MM/dd · {payer} 付" line + a
 * right-aligned "NT$ amount". Optional edit (Pencil) / delete (Trash2) column
 * of 28pt buttons (hitSlop → 44pt). Used in the 概覽「最近開銷」row (read-only)
 * and the 開銷 tab list (with actions).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Pencil, Sparkles, Trash2 } from "lucide-react-native";
import type { Expense } from "@mango/shared-types";

import { CATEGORY_ICON, CATEGORY_TONE } from "@/lib/expense-ui";
import { groupThousands } from "@/lib/format";
import { t } from "@/lib/i18n";
import { colors, radius, shadows } from "@/theme/theme";

function mmdd(ts: { toMillis?: () => number } | undefined): string {
  const millis = ts?.toMillis?.() ?? 0;
  if (!millis) return "";
  const d = new Date(millis);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

// 28pt visual button → 44pt touch target.
const ACTION_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export function PetExpenseCard({
  expense,
  onEdit,
  onDelete,
  busy = false,
}: {
  expense: Expense;
  onEdit?: () => void;
  onDelete?: () => void;
  /** A write for this row is in flight (dims the card, disables actions). */
  busy?: boolean;
}) {
  const tone = CATEGORY_TONE[expense.category] ?? CATEGORY_TONE.other;
  const Icon = CATEGORY_ICON[expense.category] ?? CATEGORY_ICON.other;
  const date = mmdd(expense.spentAt);
  const meta = expense.payerName
    ? `${date} · ${t("PetsPage.expenses.paidBy", { name: expense.payerName })}`
    : date;

  return (
    <View style={[styles.card, busy && styles.busy]}>
      <View
        style={[styles.icon, { backgroundColor: tone.bg }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon size={18} color={tone.fg} strokeWidth={1.8} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {expense.vendor || t(`Expense.categories.${expense.category}`)}
          </Text>
          {expense.source === "ai_scan" ? (
            <View style={styles.aiChip}>
              <Sparkles size={9} color={colors.brandDeep} strokeWidth={2} />
              <Text style={styles.aiText}>AI</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.metaLine} numberOfLines={1}>
          {meta}
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
                disabled={busy}
                hitSlop={ACTION_SLOP}
                accessibilityRole="button"
                accessibilityLabel={t("Common.edit")}
                accessibilityState={{ disabled: busy }}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              >
                <Pencil size={14} color={colors.ink3} strokeWidth={2} />
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                disabled={busy}
                hitSlop={ACTION_SLOP}
                accessibilityRole="button"
                accessibilityLabel={t("Common.delete")}
                accessibilityState={{ disabled: busy }}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnDangerPressed]}
              >
                {({ pressed }) => (
                  <Trash2
                    size={14}
                    color={pressed ? colors.danger : colors.ink3}
                    strokeWidth={2}
                  />
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web rounded-[18px] border bg-card px-3.5 py-3.5 shadow-card, gap-3
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
  busy: { opacity: 0.55 },
  // web size-[42px] rounded-[14px]
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    flexShrink: 1,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.1,
    color: colors.ink,
  },
  // web inline-flex gap-0.5 rounded-full bg-brand-tint px-1.5 py-0.5 text-[10px] bold
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, color: colors.brandDeep },
  metaLine: { fontSize: 11.5, color: colors.ink3 },
  right: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  amount: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  amountUnit: { fontSize: 11, fontWeight: "600", color: colors.ink3 },
  actionCol: { flexDirection: "column" },
  // web grid size-7 rounded-lg text-ink-3
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPressed: { backgroundColor: colors.bgAlt },
  iconBtnDangerPressed: { backgroundColor: colors.peachTint },
});
