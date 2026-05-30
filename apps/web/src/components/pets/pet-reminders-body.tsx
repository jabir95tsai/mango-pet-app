"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bell, Plus } from "lucide-react";
import type { Pet, Reminder } from "@/lib/types";
import { PetReminderCard } from "./pet-reminder-card";

/**
 * 提醒 tab body — summary row ("本月 X 條 · 已完成 Y") + active reminders
 * sorted by triggerAt ascending. Pure-render; the page wires onComplete
 * / onDelete / onEdit + the dialog state.
 */
type Props = {
  pet: Pet;
  reminders: Reminder[];
  doneThisMonth: Reminder[];
  onComplete: (r: Reminder) => void;
  onEdit: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
  onAdd: () => void;
};

function startOfMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function PetRemindersBody({
  pet,
  reminders,
  doneThisMonth,
  onComplete,
  onEdit,
  onDelete,
  onAdd,
}: Props) {
  const tPP = useTranslations("PetsPage");

  const { active, totalThisMonth, doneCount } = useMemo(() => {
    const monthStart = startOfMonth();
    const petActive = reminders
      .filter((r) => r.petId === pet.petId && !r.done)
      .sort((a, b) => a.triggerAt.toMillis() - b.triggerAt.toMillis());
    const petDone = doneThisMonth.filter((r) => r.petId === pet.petId);
    // "Total this month" counts reminders triggering this month +
    // anything already done this month (so completed ones don't make
    // the bar shrink mid-month).
    const totalThis = new Set<string>();
    petActive
      .filter((r) => r.triggerAt.toMillis() >= monthStart)
      .forEach((r) => totalThis.add(r.reminderId));
    petDone.forEach((r) => totalThis.add(r.reminderId));
    return {
      active: petActive,
      totalThisMonth: totalThis.size,
      doneCount: petDone.length,
    };
  }, [reminders, doneThisMonth, pet.petId]);

  if (active.length === 0 && doneCount === 0) {
    return (
      <div className="pt-2">
        <EmptyReminders onAdd={onAdd} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 pt-2">
      <div className="flex items-baseline justify-between px-1 pb-1">
        <span className="text-xs font-semibold text-mango-ink-2">
          {tPP("reminders.summary", {
            total: totalThisMonth,
            done: doneCount,
          })}
        </span>
        <span className="text-xs text-mango-ink-3">
          {tPP("reminders.sortHint")}
        </span>
      </div>
      {active.map((r) => (
        <PetReminderCard
          key={r.reminderId}
          reminder={r}
          petName={pet.name}
          onComplete={() => onComplete(r)}
          onEdit={() => onEdit(r)}
          onDelete={() => onDelete(r)}
        />
      ))}
    </div>
  );
}

function EmptyReminders({ onAdd }: { onAdd: () => void }) {
  const tPP = useTranslations("PetsPage");
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-mango-hairline bg-mango-card px-6 py-10 text-center shadow-card">
      <div className="grid size-14 place-items-center rounded-full bg-mango-brand-tint text-mango-brand-deep">
        <Bell className="size-6" strokeWidth={1.8} />
      </div>
      <p className="text-sm text-mango-ink-2">{tPP("reminders.empty")}</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-9 items-center gap-1 rounded-full bg-mango-brand-tint px-3 text-sm font-bold text-mango-brand-deep transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        {tPP("reminders.addCta")}
      </button>
    </div>
  );
}
