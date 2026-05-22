"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Bell, Pencil, Plus, PawPrint } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PetFormDialog } from "@/components/pets/pet-form-dialog";
import { HealthRecordFormDialog } from "@/components/health/health-record-form-dialog";
import { HealthRecordCard } from "@/components/health/health-record-card";
import { WeightChart } from "@/components/health/weight-chart";
import { ReminderFormDialog } from "@/components/reminders/reminder-form-dialog";
import { ReminderCard } from "@/components/reminders/reminder-card";
import { getPet, updatePet } from "@/lib/firebase/pets";
import {
  createRecord,
  deleteRecord,
  listRecords,
  listWeightSeries,
} from "@/lib/firebase/health-records";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listRecentlyCompletedReminders,
  listReminders,
  updateReminder,
} from "@/lib/firebase/reminders";
import { listFamilyMembers } from "@/lib/firebase/families";
import type {
  FamilyMember,
  HealthRecord,
  HealthRecordInput,
  HealthRecordType,
  Pet,
  PetInput,
  Reminder,
  ReminderInput,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "health" | "reminders";
type TypeFilter = HealthRecordType | "all";
const FILTER_TYPES: TypeFilter[] = ["all", "weight", "feeding", "vaccine", "vet", "medication"];

export default function PetDetailPage() {
  const router = useRouter();
  const params = useParams<{ petId: string }>();
  const petId = params.petId;
  const { user } = useAuth();
  const { family } = useFamily();

  const tH = useTranslations("Health");
  const tR = useTranslations("Reminder");
  const tC = useTranslations("Common");
  const tPet = useTranslations("Pet");
  const askConfirm = useConfirm();

  const [pet, setPet] = useState<Pet | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [weights, setWeights] = useState<{ date: number; kg: number }[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todayDone, setTodayDone] = useState<Reminder[]>([]);
  const [membersById, setMembersById] = useState<Map<string, FamilyMember>>(
    () => new Map(),
  );
  const [tab, setTab] = useState<Tab>("health");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);

  const [editingPet, setEditingPet] = useState(false);
  const [addingRecord, setAddingRecord] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const refresh = useCallback(async () => {
    if (!family) return;
    try {
      // allSettled so one slow query doesn't blank the whole page.
      const [petR, recsR, wR, remR, doneR, membersR] = await Promise.allSettled([
        getPet(petId),
        listRecords(petId),
        listWeightSeries(petId),
        listReminders(family.familyId, { petId }),
        listRecentlyCompletedReminders(family.familyId, { petId }),
        listFamilyMembers(family),
      ]);
      setPet(petR.status === "fulfilled" ? petR.value : null);
      setRecords(recsR.status === "fulfilled" ? recsR.value : []);
      setWeights(wR.status === "fulfilled" ? wR.value : []);
      setReminders(remR.status === "fulfilled" ? remR.value : []);
      setTodayDone(doneR.status === "fulfilled" ? doneR.value : []);
      setMembersById(
        membersR.status === "fulfilled"
          ? new Map(membersR.value.map((m) => [m.uid, m]))
          : new Map(),
      );
    } finally {
      setLoading(false);
    }
  }, [family, petId]);

  const refreshReminders = useCallback(async () => {
    if (!family) return;
    const [remR, doneR] = await Promise.allSettled([
      listReminders(family.familyId, { petId }),
      listRecentlyCompletedReminders(family.familyId, { petId }),
    ]);
    setReminders(remR.status === "fulfilled" ? remR.value : []);
    setTodayDone(doneR.status === "fulfilled" ? doneR.value : []);
  }, [family, petId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handlePetUpdate(input: PetInput, avatar?: File) {
    if (!user) return;
    await updatePet(petId, input, user.uid, avatar);
    await refresh();
  }

  async function handleAddRecord(input: HealthRecordInput) {
    if (!user) return;
    await createRecord(petId, user.uid, input);
    await refresh();
  }

  async function handleDeleteRecord(record: HealthRecord) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: tH(`types.${record.type}`),
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteRecord(petId, record.recordId);
    await refresh();
  }

  async function handleAddReminder(input: ReminderInput) {
    if (!user || !family) return;
    await createReminder({
      ...input,
      petId,
      familyId: family.familyId,
      createdByUid: user.uid,
    });
    await refreshReminders();
  }

  async function handleUpdateReminder(input: ReminderInput) {
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
    await refreshReminders();
  }

  async function handleCompleteReminder(reminder: Reminder) {
    if (!user) return;
    try {
      await completeReminder(reminder, user.uid);
    } catch (err) {
      console.error("[completeReminder] failed:", err);
      await askConfirm({
        title: "標記完成失敗",
        message: err instanceof Error ? err.message : "未知錯誤",
        confirmText: "知道了",
        cancelText: tC("cancel"),
      });
      return;
    }
    await refreshReminders();
  }

  async function handleDeleteReminder(reminder: Reminder) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: reminder.title,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteReminder(reminder.reminderId);
    await refreshReminders();
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">{tC("loading")}</p>;
  }

  if (!pet) {
    return (
      <EmptyState
        icon={PawPrint}
        title={tPet("notFound")}
        action={
          <Button variant="secondary" onClick={() => router.push("/app/pets")}>
            <ArrowLeft className="size-4" />
            {tC("back")}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => router.push("/app/pets")}
          className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label={tC("back")}
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      <header className="mb-6 flex items-center gap-4 rounded-lg border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
        <Avatar src={pet.photoURL} name={pet.name} size={80} />
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold">{pet.name}</h1>
          <div className="text-sm text-zinc-500 flex gap-2 flex-wrap mt-1">
            <span>{tPet(`species.${pet.species}`)}</span>
            {pet.breed && <span>· {pet.breed}</span>}
            {pet.weightKg != null && <span>· {pet.weightKg} kg</span>}
          </div>
          {pet.bio && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{pet.bio}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditingPet(true)}
          className="self-start rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label={tC("edit")}
        >
          <Pencil className="size-4" />
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "health", label: tH("title") },
            { value: "reminders", label: tR("title") },
          ]}
        />
        {tab === "health" ? (
          <Button onClick={() => setAddingRecord(true)} size="sm">
            <Plus className="size-4" />
            {tH("addRecord")}
          </Button>
        ) : (
          <Button onClick={() => setAddingReminder(true)} size="sm">
            <Plus className="size-4" />
            {tR("add")}
          </Button>
        )}
      </div>

      {tab === "health" ? (
        <div className="flex flex-col gap-4">
          <WeightChart data={weights} />

          {records.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {FILTER_TYPES.map((t) => {
                const active = typeFilter === t;
                const label = t === "all" ? tC("none") : tH(`types.${t}`);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    aria-pressed={active}
                    className={cn(
                      "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
                    )}
                  >
                    {t === "all" ? "全部" : label}
                  </button>
                );
              })}
            </div>
          )}

          {records.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title={tH("noRecords")}
              description="新增第一筆健康紀錄"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {records
                .filter((r) => typeFilter === "all" || r.type === typeFilter)
                .map((r) => (
                  <HealthRecordCard
                    key={r.recordId}
                    record={r}
                    onDelete={() => handleDeleteRecord(r)}
                  />
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reminders.length === 0 && todayDone.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={tR("noReminders")}
              description="新增第一個提醒"
            />
          ) : (
            <>
              {reminders.map((r) => (
                <ReminderCard
                  key={r.reminderId}
                  reminder={r}
                  pet={pet}
                  members={membersById}
                  onComplete={() => handleCompleteReminder(r)}
                  onDelete={() => handleDeleteReminder(r)}
                  onEdit={() => setEditingReminder(r)}
                />
              ))}
              {todayDone.length > 0 && (
                <>
                  <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {tR("todayDone")}
                  </p>
                  {todayDone.map((r) => (
                    <ReminderCard
                      key={r.reminderId}
                      reminder={r}
                      pet={pet}
                      members={membersById}
                      onComplete={() => handleCompleteReminder(r)}
                      onDelete={() => handleDeleteReminder(r)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      <PetFormDialog
        open={editingPet}
        onClose={() => setEditingPet(false)}
        initial={pet}
        onSubmit={handlePetUpdate}
      />
      <HealthRecordFormDialog
        open={addingRecord}
        onClose={() => setAddingRecord(false)}
        onSubmit={handleAddRecord}
      />
      <ReminderFormDialog
        open={addingReminder}
        onClose={() => setAddingReminder(false)}
        pets={pet ? [pet] : []}
        defaultPetId={petId}
        onSubmit={handleAddReminder}
      />
      <ReminderFormDialog
        open={editingReminder !== null}
        onClose={() => setEditingReminder(null)}
        pets={pet ? [pet] : []}
        initial={editingReminder ?? undefined}
        onSubmit={handleUpdateReminder}
      />
    </>
  );
}
