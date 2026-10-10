/**
 * Reminders tab body — 1:1 with web pet-reminders-body: a summary row
 * ("本月 X 條 · 已完成 Y" + sort hint) above this pet's active reminders
 * (soonest first) rendered with the shared PetReminderCard; an empty card
 * (Bell disc + copy + brand-tint "新增提醒" pill) when there is nothing active
 * and nothing done this month.
 *
 * "Done this month" is derived from the reminders the screen already loads
 * (listRemindersForScope keeps done ones), so no extra query. Web only counts
 * the last 24 h in family mode — iOS counts the real calendar month (PM note).
 */
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Plus } from "lucide-react-native";
import { startOfMonth } from "@mango/shared-business";
import type { Reminder } from "@mango/shared-types";

import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";
import { PetReminderCard } from "./pet-reminder-card";
import { useReminderActions } from "./use-reminder-actions";

function ms(ts: unknown): number {
  return (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

export function PetRemindersBody({
  petId,
  petName,
  reminders,
  uid,
  onChanged,
  onEdit,
  onAdd,
}: {
  petId: string;
  petName?: string;
  reminders: Reminder[];
  uid: string;
  onChanged: () => void;
  onEdit: (reminder: Reminder) => void;
  /** Empty-state CTA (new reminder). */
  onAdd?: () => void;
}) {
  const { complete, remove } = useReminderActions(uid, onChanged);

  const { active, totalThisMonth, doneCount } = useMemo(() => {
    const monthStart = startOfMonth().getTime();
    const petActive = reminders
      .filter((r) => r.petId === petId && !r.done)
      .sort((a, b) => ms(a.triggerAt) - ms(b.triggerAt));
    const petDone = reminders.filter(
      (r) => r.petId === petId && r.done && ms(r.doneAt) >= monthStart,
    );
    // Web: reminders triggering this month + anything already done this
    // month, so completing one never shrinks the total mid-month.
    const total = new Set<string>();
    petActive.filter((r) => ms(r.triggerAt) >= monthStart).forEach((r) => total.add(r.reminderId));
    petDone.forEach((r) => total.add(r.reminderId));
    return { active: petActive, totalThisMonth: total.size, doneCount: petDone.length };
  }, [reminders, petId]);

  if (active.length === 0 && doneCount === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyDisc}>
          <Bell size={24} color={colors.brandDeep} strokeWidth={1.8} />
        </View>
        <Text style={styles.emptyText}>{t("PetsPage.reminders.empty")}</Text>
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAdd}
            style={({ pressed }) => [styles.addPill, pressed && styles.pressed]}
          >
            <Plus size={16} color={colors.brandDeep} strokeWidth={2.5} />
            <Text style={styles.addPillText}>{t("PetsPage.reminders.addCta")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t("PetsPage.reminders.summary", { total: totalThisMonth, done: doneCount })}
        </Text>
        <Text style={styles.sortHint}>{t("PetsPage.reminders.sortHint")}</Text>
      </View>
      {active.map((r) => (
        <PetReminderCard
          key={r.reminderId}
          reminder={r}
          petName={petName}
          onComplete={() => void complete(r)}
          onEdit={() => onEdit(r)}
          onDelete={() => void remove(r)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // web: flex flex-col gap-2.5 pt-2
  list: { gap: 10, paddingTop: spacing.sm },
  // web: flex items-baseline justify-between px-1 pb-1
  summary: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  summaryText: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  sortHint: { fontSize: 12, color: colors.ink3 },
  // web: rounded-[18px] border bg-card px-6 py-10 gap-3 shadow-card
  emptyCard: {
    marginTop: spacing.sm,
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
    ...shadows.card,
  },
  emptyDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  // web: h-9 rounded-full bg-brand-tint px-3 text-sm bold brand-deep gap-1
  addPill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingHorizontal: spacing.md,
  },
  addPillText: { fontSize: 14, fontWeight: "700", color: colors.brandDeep },
  pressed: { opacity: 0.85 },
});
