"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import type { Pet, Reminder, ReminderInput, ReminderRepeat } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  defaultPetId?: string;
  initial?: Reminder;
  onSubmit: (input: ReminderInput) => Promise<void>;
};

const REPEATS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly", "yearly"];
const NOTIFY_OPTIONS = [0, 15, 60, 1440, 10080] as const;

function defaultTriggerLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() - off);
  return d.toISOString().slice(0, 16);
}

function dateToLocalInput(date: Date): string {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() - off);
  return d.toISOString().slice(0, 16);
}

export function ReminderFormDialog({
  open,
  onClose,
  pets,
  defaultPetId,
  initial,
  onSubmit,
}: Props) {
  const tR = useTranslations("Reminder");
  const tC = useTranslations("Common");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [petId, setPetId] = useState<string>("");
  const [triggerAt, setTriggerAt] = useState(defaultTriggerLocal());
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const [notifyBefore, setNotifyBefore] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setPetId(initial.petId ?? "");
      setTriggerAt(dateToLocalInput(new Date(initial.triggerAt.toMillis())));
      setRepeat(initial.repeat);
      setNotifyBefore(initial.notifyBeforeMinutes);
    } else {
      setTitle("");
      setDescription("");
      setPetId(defaultPetId ?? "");
      setTriggerAt(defaultTriggerLocal());
      setRepeat("none");
      setNotifyBefore(60);
    }
    setError(null);
  }, [open, defaultPetId, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        petId: petId || undefined,
        triggerAt: new Date(triggerAt),
        repeat,
        notifyBeforeMinutes: notifyBefore,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? tC("edit") : tR("add")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>{tR("fields.title")}</FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="疫苗追加 / 餵藥..."
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tR("fields.triggerAt")}</FieldLabel>
          <Input
            type="datetime-local"
            value={triggerAt}
            onChange={(e) => setTriggerAt(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.repeat")}</FieldLabel>
            <Select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
            >
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {tR(`repeat.${r}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.notifyBefore")}</FieldLabel>
            <Select
              value={notifyBefore}
              onChange={(e) => setNotifyBefore(Number(e.target.value))}
            >
              {NOTIFY_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {tR(`notifyBefore.${n}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {pets.length > 0 && (
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.linkedPet")}</FieldLabel>
            <Select value={petId} onChange={(e) => setPetId(e.target.value)}>
              <option value="">{tC("none")}</option>
              {pets.map((p) => (
                <option key={p.petId} value={p.petId}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <FieldLabel>{tR("fields.description")}</FieldLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "..." : tC("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
