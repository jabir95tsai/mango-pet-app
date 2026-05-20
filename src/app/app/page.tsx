"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, PawPrint, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Avatar } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ReminderCard } from "@/components/reminders/reminder-card";
import { ReminderFormDialog } from "@/components/reminders/reminder-form-dialog";
import { listPets } from "@/lib/firebase/pets";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listOverdueReminders,
  listUpcomingReminders,
} from "@/lib/firebase/reminders";
import type { Pet, Reminder, ReminderInput } from "@/lib/types";

export default function AppHome() {
  const tApp = useTranslations("App");
  const tNav = useTranslations("Nav");
  const tR = useTranslations("Reminder");
  const tPet = useTranslations("Pet");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();

  const [pets, setPets] = useState<Pet[]>([]);
  const [upcoming, setUpcoming] = useState<Reminder[]>([]);
  const [overdue, setOverdue] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingReminder, setAddingReminder] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [petList, up, ov] = await Promise.all([
        listPets(user.uid),
        listUpcomingReminders(user.uid),
        listOverdueReminders(user.uid),
      ]);
      setPets(petList);
      setUpcoming(up);
      setOverdue(ov);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function petById(id?: string) {
    return id ? pets.find((p) => p.petId === id) : undefined;
  }

  async function handleAddReminder(input: ReminderInput) {
    if (!user) return;
    await createReminder(user.uid, input);
    await refresh();
  }

  async function handleCompleteReminder(reminder: Reminder) {
    if (!user) return;
    await completeReminder(user.uid, reminder);
    await refresh();
  }

  async function handleDeleteReminder(reminder: Reminder) {
    if (!user) return;
    const ok = await askConfirm({
      title: tC("delete"),
      message: reminder.title,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteReminder(user.uid, reminder.reminderId);
    await refresh();
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">{tC("loading")}</p>;
  }

  return (
    <>
      <RouteHeader title={`🥭 ${tApp("name")}`} subtitle={tApp("tagline")} />

      <section className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {tNav("pets")}
          </h2>
          <Link
            href="/app/pets"
            className="text-xs text-amber-600 hover:underline"
          >
            {tC("edit")} →
          </Link>
        </div>
        {pets.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title={tPet("noPets")}
            description="新增第一隻寵物開始紀錄。"
            action={
              <Link href="/app/pets">
                <Button size="sm">
                  <Plus className="size-4" />
                  {tPet("addPet")}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {pets.map((p) => (
              <Link
                key={p.petId}
                href={`/app/pets/${p.petId}`}
                className="shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <Avatar
                  src={p.photoURL}
                  name={p.name}
                  size={64}
                  className="ring-2 ring-transparent group-hover:ring-amber-400"
                />
                <span className="text-xs font-medium max-w-[64px] truncate">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {tR("title")}
          </h2>
          <Button size="sm" onClick={() => setAddingReminder(true)}>
            <Plus className="size-4" />
            {tR("add")}
          </Button>
        </div>

        {overdue.length === 0 && upcoming.length === 0 ? (
          <EmptyState icon={Bell} title={tR("noReminders")} />
        ) : (
          <div className="flex flex-col gap-3">
            {overdue.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-wider text-red-600 font-semibold">
                  {tR("overdue")}
                </p>
                {overdue.map((r) => (
                  <ReminderCard
                    key={r.reminderId}
                    reminder={r}
                    pet={petById(r.petId)}
                    onComplete={() => handleCompleteReminder(r)}
                    onDelete={() => handleDeleteReminder(r)}
                  />
                ))}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-wider text-amber-600 font-semibold mt-2">
                  {tR("upcoming")}
                </p>
                {upcoming.map((r) => (
                  <ReminderCard
                    key={r.reminderId}
                    reminder={r}
                    pet={petById(r.petId)}
                    onComplete={() => handleCompleteReminder(r)}
                    onDelete={() => handleDeleteReminder(r)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <ReminderFormDialog
        open={addingReminder}
        onClose={() => setAddingReminder(false)}
        pets={pets}
        onSubmit={handleAddReminder}
      />
    </>
  );
}
