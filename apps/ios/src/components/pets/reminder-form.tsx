/**
 * Reminder add/edit form — 1:1 with apps/web/src/components/reminders/
 * reminder-form-dialog.tsx + the pets-page-content handlers:
 *  - field order: title → trigger time → repeat / notify-before → linked pet
 *    (Common.none + the family's pets) → description;
 *  - defaults for a new reminder: trigger now + 24 h (seconds zeroed), notify
 *    60 min before, linked to the active pet;
 *  - sheet title Common.edit when editing, Reminder.add when adding.
 *
 * Save semantics mirror web byte-for-byte:
 *  - create: petId = picked pet || the active pet (web `input.petId ??
 *    pet.petId`), description omitted when empty;
 *  - update: notified is reset ONLY when the schedule changed (trigger time or
 *    notify-before), so editing just the title can't re-send an already
 *    delivered push (web handleUpdateReminder `scheduleChanged`).
 * A failed save shows the error and keeps the sheet open.
 */
import { useState } from "react";
import {
  NOTIFY_BEFORE_MINUTES,
  type Pet,
  type Reminder,
  type ReminderRepeat,
} from "@mango/shared-types";

import { alertError } from "@/lib/confirm";
import { createReminder, updateReminder } from "@/lib/reminders-write";
import { t } from "@/lib/i18n";
import { DateField, FormSheet, SelectField, TextField } from "./form-sheet";

const REPEATS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly", "yearly"];

/** Web defaultTriggerLocal(): now + 24 h, seconds zeroed. */
function defaultTrigger(): Date {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d;
}

/** Minute precision, like web's datetime-local input. */
function toMinute(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  return out;
}

function errorMessage(err: unknown): string | undefined {
  return err instanceof Error && err.message ? err.message : undefined;
}

export function ReminderForm({
  familyId,
  uid,
  petId,
  pets,
  reminder,
  onClose,
  onSaved,
}: {
  familyId: string | null;
  uid: string;
  /** Default pet for a NEW reminder (the active pet; web defaultPetId). */
  petId: string;
  /** Linked-pet picker options (web `pets`). Hidden when empty / absent. */
  pets?: Pet[];
  reminder?: Reminder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!reminder;
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [description, setDescription] = useState(reminder?.description ?? "");
  const [linkedPetId, setLinkedPetId] = useState<string>(
    reminder ? (reminder.petId ?? "") : petId,
  );
  const [triggerAt, setTriggerAt] = useState<Date>(
    reminder
      ? (reminder.triggerAt as unknown as { toDate(): Date }).toDate()
      : defaultTrigger(),
  );
  const [repeat, setRepeat] = useState<ReminderRepeat>(reminder?.repeat ?? "none");
  const [notify, setNotify] = useState<string>(
    String(reminder?.notifyBeforeMinutes ?? 60),
  );
  const [saving, setSaving] = useState(false);

  const petOptions = (pets ?? []).map((p) => ({ value: p.petId, label: p.name }));
  // Editing a reminder linked to a pet outside the list still shows its link.
  if (linkedPetId && !petOptions.some((o) => o.value === linkedPetId)) {
    petOptions.unshift({ value: linkedPetId, label: "—" });
  }

  async function save() {
    if (!title.trim()) {
      alertError(t("Reminder.errors.titleRequired"));
      return;
    }
    if (Number.isNaN(triggerAt.getTime())) {
      alertError(t("Reminder.errors.invalidTime"));
      return;
    }
    setSaving(true);
    try {
      const notifyBeforeMinutes = parseInt(notify, 10) || 0;
      const desc = description.trim() || undefined;
      if (editing && reminder) {
        const scheduleChanged =
          (reminder.triggerAt as unknown as { toMillis(): number }).toMillis() !==
            triggerAt.getTime() || reminder.notifyBeforeMinutes !== notifyBeforeMinutes;
        await updateReminder(
          reminder.reminderId,
          {
            title: title.trim(),
            description: desc,
            petId: linkedPetId || undefined,
            triggerAt,
            repeat,
            notifyBeforeMinutes,
          },
          { resetNotification: scheduleChanged },
        );
      } else {
        await createReminder({
          familyId,
          createdByUid: uid,
          petId: linkedPetId || petId,
          title: title.trim(),
          description: desc,
          triggerAt,
          repeat,
          notifyBeforeMinutes,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alertError(errorMessage(err) ?? t("Reminder.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      visible
      title={editing ? t("Common.edit") : t("Reminder.add")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!title.trim()}
    >
      <TextField
        label={t("Reminder.fields.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("Reminder.placeholders.title")}
        autoFocus={!editing}
      />
      <DateField
        label={t("Reminder.fields.triggerAt")}
        value={triggerAt}
        onChange={(d) => setTriggerAt(toMinute(d))}
        mode="datetime"
      />
      <SelectField
        label={t("Reminder.fields.repeat")}
        value={repeat}
        onChange={setRepeat}
        options={REPEATS.map((r) => ({ value: r, label: t(`Reminder.repeat.${r}`) }))}
      />
      <SelectField
        label={t("Reminder.fields.notifyBefore")}
        value={notify}
        onChange={setNotify}
        options={NOTIFY_BEFORE_MINUTES.map((n) => ({
          value: String(n),
          label: t(`Reminder.notifyBefore.${n}`),
        }))}
      />
      {petOptions.length > 0 ? (
        <SelectField
          label={t("Reminder.fields.linkedPet")}
          value={linkedPetId}
          onChange={setLinkedPetId}
          options={[{ value: "", label: t("Common.none") }, ...petOptions]}
        />
      ) : null}
      <TextField
        label={t("Reminder.fields.description")}
        value={description}
        onChangeText={setDescription}
        multiline
      />
    </FormSheet>
  );
}
