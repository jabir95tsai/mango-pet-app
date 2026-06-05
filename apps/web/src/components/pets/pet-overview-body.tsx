"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Timestamp } from "firebase/firestore";
import type { Expense, Pet, Reminder, Walk } from "@/lib/types";
import { PetStatGrid } from "./pet-stat-grid";
import { PetsSectionHeader } from "./pets-section-header";
import { PetReminderCard } from "./pet-reminder-card";
import { PetExpenseCard } from "./pet-expense-card";

/**
 * 概覽 tab body — pure presentation. Compose StatGrid + "即將到期"
 * single reminder + "最近開銷" single expense. Empty placeholders when
 * the user has no data yet.
 *
 * All number formatting / locale handling happens here so child cards
 * stay simple — page only passes the raw arrays + the active pet.
 */
type Props = {
  pet: Pet;
  reminders: Reminder[];
  expenses: Expense[];
  walks: Walk[];
};

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dayDiffFromNow(t: Timestamp): { value: string; unit: string } {
  const ms = t.toMillis() - Date.now();
  if (ms < 0) {
    // Overdue. Mirror the future branches but with "前" (ago) units and NO
    // leading minus: "天前"/"小時前" already mean "ago", so the old
    // `value: "-${days}"` rendered the nonsensical "-1天前" the instant a
    // reminder came due (and showed days even when only hours overdue).
    const past = -ms;
    const hours = past / 3_600_000;
    if (hours < 24) {
      return { value: `${Math.max(1, Math.round(hours))}`, unit: "小時前" };
    }
    return { value: `${Math.ceil(past / 86_400_000)}`, unit: "天前" };
  }
  const hours = ms / 3_600_000;
  if (hours < 24) {
    return { value: `${Math.max(1, Math.round(hours))}`, unit: "小時後" };
  }
  return { value: `${Math.ceil(ms / 86_400_000)}`, unit: "天後" };
}

function monthSpend(expenses: Expense[], petId: string): number {
  const start = startOfMonth().getTime();
  return expenses
    .filter((e) => e.petId === petId && e.spentAt.toMillis() >= start)
    .reduce((s, e) => s + e.amount, 0);
}

function walkDaysThisMonth(walks: Walk[], petId: string): number {
  const start = startOfMonth().getTime();
  const days = new Set<number>();
  for (const w of walks) {
    if (w.petId !== petId) continue;
    const ms = w.startedAt.toMillis();
    if (ms < start) continue;
    days.add(Math.floor(ms / 86_400_000));
  }
  return days.size;
}

export function PetOverviewBody({ pet, reminders, expenses, walks }: Props) {
  const tPP = useTranslations("PetsPage");

  // Pet-scoped data
  const petReminders = reminders
    .filter((r) => r.petId === pet.petId && !r.done)
    .sort((a, b) => a.triggerAt.toMillis() - b.triggerAt.toMillis());
  const petExpenses = expenses
    .filter((e) => e.petId === pet.petId)
    .sort((a, b) => b.spentAt.toMillis() - a.spentAt.toMillis());

  const nextR = petReminders[0];
  const recentE = petExpenses[0];

  const stats = useMemo(() => {
    const spend = monthSpend(expenses, pet.petId);
    const days = walkDaysThisMonth(walks, pet.petId);
    return {
      nextReminder: nextR
        ? {
            ...dayDiffFromNow(nextR.triggerAt),
            sub: nextR.title,
          }
        : null,
      monthSpend: {
        value: spend.toLocaleString(),
        sub: tPP("stat.subThisMonth"),
      },
      weight:
        pet.weightKg != null
          ? {
              value: `${pet.weightKg}`,
              unit: "公斤",
              sub: tPP("stat.subRecent"),
            }
          : null,
      walkDays: {
        value: `${days}`,
        unit: "天 · 本月",
        sub: tPP("stat.subKeepGoing"),
      },
    };
  }, [expenses, walks, nextR, pet.weightKg, pet.petId, tPP]);

  return (
    <div className="flex flex-col">
      <PetStatGrid
        nextReminder={stats.nextReminder}
        monthSpend={stats.monthSpend}
        weight={stats.weight}
        walkDays={stats.walkDays}
      />

      <PetsSectionHeader title={tPP("overview.upcoming")} />
      {nextR ? (
        <PetReminderCard
          reminder={nextR}
          petName={pet.name}
          onComplete={() => {}}
          onDelete={() => {}}
        />
      ) : (
        <p className="rounded-[18px] border border-mango-hairline bg-mango-card px-4 py-5 text-center text-sm text-mango-ink-3 shadow-card">
          {tPP("overview.noReminder")}
        </p>
      )}

      <PetsSectionHeader title={tPP("overview.recentExpense")} />
      {recentE ? (
        <PetExpenseCard expense={recentE} />
      ) : (
        <p className="rounded-[18px] border border-mango-hairline bg-mango-card px-4 py-5 text-center text-sm text-mango-ink-3 shadow-card">
          {tPP("overview.noExpense")}
        </p>
      )}
    </div>
  );
}
