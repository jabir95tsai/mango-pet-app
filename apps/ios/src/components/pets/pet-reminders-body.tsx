/**
 * Reminders tab body — active reminders for this pet (soonest-first), each
 * rendered via the shared PetReminderCard (icon square + repeat/due chips +
 * check / edit / trash actions), 1:1 with web pet-reminders-body. Complete /
 * delete write directly via the reminders-write layer; edit opens the form
 * (owned by the screen).
 */
import { useMemo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { Reminder } from "@mango/shared-types";

import { completeReminder, deleteReminder } from "@/lib/reminders-write";
import { scoped } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { PetReminderCard } from "./pet-reminder-card";

const tPP = scoped("PetsPage");
const tRem = scoped("Reminder");
const tC = scoped("Common");

function ms(ts: { toMillis?: () => number } | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

export function PetRemindersBody({
  petId,
  petName,
  reminders,
  uid,
  onChanged,
  onEdit,
}: {
  petId: string;
  petName?: string;
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
      {list.map((r) => (
        <PetReminderCard
          key={r.reminderId}
          reminder={r}
          petName={petName}
          onComplete={() => complete(r)}
          onEdit={() => onEdit(r)}
          onDelete={() => confirmDelete(r)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.ink3 },
});
