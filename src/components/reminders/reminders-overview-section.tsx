"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ReminderCard } from "./reminder-card";
import { ReminderFormDialog } from "./reminder-form-dialog";
import { listFamilyMembers } from "@/lib/firebase/families";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listOverdueReminders,
  listPersonalOverdueReminders,
  listPersonalUpcomingReminders,
  listRecentlyCompletedReminders,
  listUpcomingReminders,
  updateReminder,
} from "@/lib/firebase/reminders";
import type {
  FamilyMember,
  Pet,
  Reminder,
  ReminderInput,
} from "@/lib/types";

type Props = {
  pets: Pet[];
};

/**
 * All-pets reminder overview — overdue / upcoming / today-done grouped
 * lists with add + complete + delete + edit hooked up. Lives at the top
 * of `/app/pets` (moved here from the home page per spec
 * docs/features/reminders-to-pets-page.md). The home page no longer
 * surfaces reminders.
 *
 * Owns its own fetch so the parent page only has to pass pets — keeping
 * pets/page.tsx's existing useEffect (pets-only) untouched, in line with
 * the UI/UX rule against modifying page-level data fetching.
 */
export function RemindersOverviewSection({ pets }: Props) {
  const tR = useTranslations("Reminder");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family } = useFamily();

  const [upcoming, setUpcoming] = useState<Reminder[]>([]);
  const [overdue, setOverdue] = useState<Reminder[]>([]);
  const [todayDone, setTodayDone] = useState<Reminder[]>([]);
  const [membersById, setMembersById] = useState<Map<string, FamilyMember>>(
    () => new Map(),
  );
  const [addingReminder, setAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    // Mirror the old /app home logic 1:1 — personal-mode skips done
    // attribution + members lookup (single-owner attribution reads
    // awkwardly), family-mode fetches all four streams in parallel.
    const [upR, ovR, doneR, membersR] = await Promise.allSettled([
      family
        ? listUpcomingReminders(family.familyId)
        : listPersonalUpcomingReminders(user.uid),
      family
        ? listOverdueReminders(family.familyId)
        : listPersonalOverdueReminders(user.uid),
      family
        ? listRecentlyCompletedReminders(family.familyId)
        : Promise.resolve([] as Reminder[]),
      family
        ? listFamilyMembers(family)
        : Promise.resolve([] as FamilyMember[]),
    ]);
    setUpcoming(upR.status === "fulfilled" ? upR.value : []);
    setOverdue(ovR.status === "fulfilled" ? ovR.value : []);
    setTodayDone(doneR.status === "fulfilled" ? doneR.value : []);
    setMembersById(
      membersR.status === "fulfilled"
        ? new Map(membersR.value.map((m) => [m.uid, m]))
        : new Map(),
    );
  }, [user, family]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function petById(id?: string): Pet | undefined {
    return id ? pets.find((p) => p.petId === id) : undefined;
  }

  async function handleAdd(input: ReminderInput) {
    if (!user) return;
    await createReminder({
      ...input,
      familyId: family?.familyId ?? null,
      createdByUid: user.uid,
    });
    await refresh();
  }

  async function handleUpdate(input: ReminderInput) {
    if (!editingReminder) return;
    const scheduleChanged =
      editingReminder.triggerAt.toMillis() !== input.triggerAt.getTime() ||
      editingReminder.notifyBeforeMinutes !== input.notifyBeforeMinutes;
    await updateReminder(
      editingReminder.reminderId,
      {
        title: input.title,
        description: input.description,
        petId: input.petId,
        triggerAt: input.triggerAt,
        repeat: input.repeat,
        notifyBeforeMinutes: input.notifyBeforeMinutes,
      },
      { resetNotification: scheduleChanged },
    );
    setEditingReminder(null);
    await refresh();
  }

  async function handleComplete(reminder: Reminder) {
    if (!user) return;
    try {
      await completeReminder(reminder, user.uid);
    } catch (err) {
      console.error("[completeReminder] failed:", err);
      // Surface to user so silent permission denials don't look like
      // "button doesn't work".
      await askConfirm({
        title: "標記完成失敗",
        message: err instanceof Error ? err.message : "未知錯誤",
        confirmText: "知道了",
        cancelText: tC("cancel"),
      });
      return;
    }
    await refresh();
  }

  async function handleDelete(reminder: Reminder) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: reminder.title,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteReminder(reminder.reminderId);
    await refresh();
  }

  // Spec edge case: no pets → hide section entirely (without a pet you
  // cannot create a reminder). Pets page's own empty state guides users
  // to add their first pet.
  if (pets.length === 0) return null;

  const hasAny =
    overdue.length > 0 || upcoming.length > 0 || todayDone.length > 0;

  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          {tR("title")}
        </h2>
        <Button size="sm" onClick={() => setAddingReminder(true)}>
          <Plus className="size-4" />
          {tR("add")}
        </Button>
      </div>

      {!hasAny ? (
        <EmptyState
          icon={Bell}
          title={tR("noReminders")}
          action={
            <Button size="sm" onClick={() => setAddingReminder(true)}>
              <Plus className="size-4" />
              {tR("add")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {overdue.length > 0 && (
            <>
              <p className="text-xs font-semibold text-red-600">
                {tR("overdue")}
              </p>
              {overdue.map((r) => (
                <ReminderCard
                  key={r.reminderId}
                  reminder={r}
                  pet={petById(r.petId)}
                  members={membersById}
                  onComplete={() => handleComplete(r)}
                  onDelete={() => handleDelete(r)}
                  onEdit={() => setEditingReminder(r)}
                />
              ))}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {tR("upcoming")}
              </p>
              {upcoming.map((r) => (
                <ReminderCard
                  key={r.reminderId}
                  reminder={r}
                  pet={petById(r.petId)}
                  members={membersById}
                  onComplete={() => handleComplete(r)}
                  onDelete={() => handleDelete(r)}
                  onEdit={() => setEditingReminder(r)}
                />
              ))}
            </>
          )}
          {todayDone.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {tR("todayDone")}
              </p>
              {todayDone.map((r) => (
                <ReminderCard
                  key={r.reminderId}
                  reminder={r}
                  pet={petById(r.petId)}
                  members={membersById}
                  onComplete={() => handleComplete(r)}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </>
          )}
        </div>
      )}

      <ReminderFormDialog
        open={addingReminder}
        onClose={() => setAddingReminder(false)}
        pets={pets}
        onSubmit={handleAdd}
      />

      <ReminderFormDialog
        open={editingReminder !== null}
        onClose={() => setEditingReminder(null)}
        pets={pets}
        initial={editingReminder ?? undefined}
        onSubmit={handleUpdate}
      />
    </section>
  );
}
