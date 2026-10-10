/**
 * Reminder complete / delete — shared by the reminders tab and the overview
 * "upcoming" card so both are actionable (web pets-page-content
 * handleCompleteReminder / handleDeleteReminder: confirm with the reminder
 * title, then refresh). Writes go straight to Firestore (reminders-write).
 */
import { useCallback } from "react";
import type { Reminder } from "@mango/shared-types";

import { alertError, confirm } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { completeReminder, deleteReminder } from "@/lib/reminders-write";

export function useReminderActions(uid: string, onChanged: () => void) {
  const complete = useCallback(
    async (r: Reminder) => {
      try {
        await completeReminder(r, uid);
        onChanged();
      } catch {
        alertError(t("Reminder.errors.saveFailed"));
      }
    },
    [uid, onChanged],
  );

  const remove = useCallback(
    async (r: Reminder) => {
      const ok = await confirm({
        title: t("Common.delete"),
        message: r.title,
        confirmLabel: t("Common.delete"),
        cancelLabel: t("Common.cancel"),
        destructive: true,
      });
      if (!ok) return;
      try {
        await deleteReminder(r.reminderId);
        onChanged();
      } catch {
        alertError(t("Reminder.errors.saveFailed"));
      }
    },
    [onChanged],
  );

  return { complete, remove };
}
