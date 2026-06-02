/**
 * Reminder add/edit form — title + description + trigger datetime (community
 * DateTimePicker) + repeat + notifyBefore. Writes directly to Firestore via
 * the reminders-write layer (createReminder / updateReminder). Mounted only
 * while open (fresh state per open). Mirrors web reminder-form-dialog.
 */
import { useState } from "react";
import { Alert } from "react-native";
import {
  NOTIFY_BEFORE_MINUTES,
  type Reminder,
  type ReminderRepeat,
} from "@mango/shared-types";

import { createReminder, updateReminder } from "@/lib/reminders-write";
import { scoped } from "@/lib/i18n";
import { FormSheet, DateField, SelectField, TextField } from "./form-sheet";

const tRem = scoped("Reminder");

const REPEATS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly", "yearly"];

function defaultTrigger(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function ReminderForm({
  familyId,
  uid,
  petId,
  reminder,
  onClose,
  onSaved,
}: {
  familyId: string | null;
  uid: string;
  petId: string;
  reminder?: Reminder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!reminder;
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [description, setDescription] = useState(reminder?.description ?? "");
  const [triggerAt, setTriggerAt] = useState<Date>(
    reminder
      ? (reminder.triggerAt as unknown as { toDate(): Date }).toDate()
      : defaultTrigger(),
  );
  const [repeat, setRepeat] = useState<ReminderRepeat>(reminder?.repeat ?? "none");
  const [notify, setNotify] = useState<string>(
    String(reminder?.notifyBeforeMinutes ?? 0),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      Alert.alert(tRem("errors.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const notifyBeforeMinutes = parseInt(notify, 10) || 0;
      if (editing && reminder) {
        await updateReminder(
          reminder.reminderId,
          {
            petId,
            title: title.trim(),
            description: description.trim(),
            triggerAt,
            repeat,
            notifyBeforeMinutes,
          },
          { resetNotification: true },
        );
      } else {
        await createReminder({
          familyId,
          createdByUid: uid,
          petId,
          title: title.trim(),
          description: description.trim(),
          triggerAt,
          repeat,
          notifyBeforeMinutes,
        });
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert(tRem("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      visible
      title={editing ? tRem("title") : tRem("add")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!title.trim()}
    >
      <TextField
        label={tRem("fields.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={tRem("placeholders.title")}
        autoFocus={!editing}
      />
      <TextField
        label={tRem("fields.description")}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <DateField
        label={tRem("fields.triggerAt")}
        value={triggerAt}
        onChange={setTriggerAt}
        mode="datetime"
      />
      <SelectField
        label={tRem("fields.repeat")}
        value={repeat}
        onChange={setRepeat}
        options={REPEATS.map((r) => ({ value: r, label: tRem(`repeat.${r}`) }))}
      />
      <SelectField
        label={tRem("fields.notifyBefore")}
        value={notify}
        onChange={setNotify}
        options={NOTIFY_BEFORE_MINUTES.map((n) => ({
          value: String(n),
          label: tRem(`notifyBefore.${n}`),
        }))}
      />
    </FormSheet>
  );
}
