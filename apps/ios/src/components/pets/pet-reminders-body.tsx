/**
 * Reminders tab body — active reminders for this pet (sorted soonest-first),
 * each with a 完成 (complete) action, tap-to-edit, and long-press delete.
 * Complete/delete write directly via the reminders-write layer; edit/add open
 * the form (owned by the screen). Mirrors web pet-reminders-body.
 */
import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { dayDiffFromNow } from "@mango/shared-business";
import type { Reminder } from "@mango/shared-types";

import { completeReminder, deleteReminder } from "@/lib/reminders-write";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");
const tRem = scoped("Reminder");
const tC = scoped("Common");

function ms(ts: { toMillis?: () => number } | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

export function PetRemindersBody({
  petId,
  reminders,
  uid,
  onChanged,
  onEdit,
}: {
  petId: string;
  reminders: Reminder[];
  uid: string;
  onChanged: () => void;
  onEdit: (reminder: Reminder) => void;
}) {
  const list = useMemo(
    () =>
      reminders
        .filter((r) => r.petId === petId && !r.done)
        .sort((a, b) => ms(a.triggerAt) - ms(b.triggerAt)),
    [reminders, petId],
  );

  async function complete(r: Reminder) {
    try {
      await completeReminder(r, uid);
      onChanged();
    } catch {
      Alert.alert(tRem("errors.saveFailed"));
    }
  }

  function confirmDelete(r: Reminder) {
    Alert.alert(r.title, "", [
      { text: tC("cancel"), style: "cancel" },
      {
        text: tC("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReminder(r.reminderId);
            onChanged();
          } catch {
            Alert.alert(tRem("errors.saveFailed"));
          }
        },
      },
    ]);
  }

  if (list.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyEmoji}>🔔</Text>
        <Text style={styles.emptyText}>{tPP("reminders.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {list.map((r) => {
        const diff = dayDiffFromNow(r.triggerAt);
        const overdue = ms(r.triggerAt) < Date.now();
        return (
          <Pressable
            key={r.reminderId}
            onPress={() => onEdit(r)}
            onLongPress={() => confirmDelete(r)}
            style={styles.card}
            accessibilityRole="button"
          >
            <View style={[styles.icon, { backgroundColor: colors.bellTint }]}>
              <Text style={styles.iconText}>🔔</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {r.title}
              </Text>
              <View style={styles.subRow}>
                {r.repeat !== "none" ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tRem(`repeat.${r.repeat}`)}</Text>
                  </View>
                ) : null}
                <Text style={[styles.sub, overdue && styles.overdue]}>
                  {`${diff.value} ${diff.unit}`}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => complete(r)}
              hitSlop={8}
              style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={tRem("markDone")}
            >
              <Text style={styles.doneText}>{tRem("markDone")}</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
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
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sub: { fontSize: 12, color: colors.ink3 },
  overdue: { color: colors.cookie, fontWeight: "700" },
  badge: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.brandDeep },
  doneBtn: {
    backgroundColor: colors.leafTint,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneText: { fontSize: 13, fontWeight: "800", color: colors.leaf },
  pressed: { opacity: 0.7 },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.ink3 },
});
