"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  Expense,
  ExpenseInput,
  ExtractedReceipt,
  HealthRecord,
  HealthRecordInput,
  Pet,
  PetInput,
  Reminder,
  ReminderInput,
  Walk,
} from "@/lib/types";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PetFormDialog } from "@/components/pets/pet-form-dialog";
import { ReminderFormDialog } from "@/components/reminders/reminder-form-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ReceiptScanner } from "@/components/expenses/receipt-scanner";
import { HealthRecordFormDialog } from "@/components/health/health-record-form-dialog";
import {
  createPet,
  deletePet,
  updatePet,
} from "@/lib/firebase/pets";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listPersonalReminders,
  listRecentlyCompletedReminders,
  listReminders,
  updateReminder,
} from "@/lib/firebase/reminders";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  listPersonalExpenses,
  updateExpense,
} from "@/lib/firebase/expenses";
import {
  createRecord,
  deleteRecord,
  listRecords,
  listWeightSeries,
} from "@/lib/firebase/health-records";
import { listPersonalWalks, listWalks } from "@/lib/firebase/walks";
import { PetsTopBar } from "./pets-top-bar";
import { PetHeader } from "./pet-header";
import { PetSwitcherDropdown } from "./pet-switcher-dropdown";
import { PetTabs } from "./pet-tabs";
import { PetOverviewBody } from "./pet-overview-body";
import { PetRemindersBody } from "./pet-reminders-body";
import { PetExpensesBody } from "./pet-expenses-body";
import { PetHealthBody } from "./pet-health-body";
import { PetFloatingAdd } from "./pet-floating-add";
import { usePetTab } from "./use-pet-tab";

/**
 * Shared content for `/app/pets` (list mode) and `/app/pets/[petId]`
 * (detail mode). Owns pet refresh, per-pet data fetch (reminders /
 * expenses / records / weights / walks), and every form dialog so the
 * tab body components stay pure-render.
 *
 * Mode difference is just label + switcher behavior:
 *   - list  → title "我的寵物", switcher swaps in-place (no nav)
 *   - detail → title "寵物資料", switcher navigates to /app/pets/[id]
 *
 * Both modes scope tabs via `?tab=...` (usePetTab) so deep links land
 * on the right body and back-button preserves context.
 */
type Mode = "list" | "detail";

type Props = {
  mode: Mode;
  pets: Pet[];
  initialPetId: string;
  /** Triggered after add/delete of pets so the caller can refresh the
   *  pets list. Detail mode also uses this to navigate away when the
   *  current pet is deleted. */
  onPetsChanged: () => Promise<void> | void;
};

export function PetsPageContent({
  mode,
  pets,
  initialPetId,
  onPetsChanged,
}: Props) {
  const tPP = useTranslations("PetsPage");
  const tC = useTranslations("Common");
  const router = useRouter();
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family } = useFamily();

  const [selectedPetId, setSelectedPetId] = useState(initialPetId);
  // Active pet is derived: prefer the user's local selection (when it
  // still resolves to a real pet — e.g. pets list refreshed after a
  // delete), else fall back to the first pet so we never render with
  // a null active pet.
  const pet =
    pets.find((p) => p.petId === selectedPetId) ?? pets[0];
  const currentPetId = pet?.petId;

  const { tab, setTab } = usePetTab("overview");

  // ── Per-pet data ────────────────────────────────────────────────
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todayDone, setTodayDone] = useState<Reminder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [weights, setWeights] = useState<{ date: number; kg: number }[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);

  const refreshData = useCallback(async () => {
    if (!user || !pet) return;
    const [remR, doneR, exR, recsR, wR, walksR] = await Promise.allSettled([
      family
        ? listReminders(family.familyId)
        : listPersonalReminders(user.uid),
      family
        ? listRecentlyCompletedReminders(family.familyId)
        : Promise.resolve([] as Reminder[]),
      family
        ? listExpenses(family.familyId, { max: 200 })
        : listPersonalExpenses(user.uid, { max: 200 }),
      listRecords(pet.petId),
      listWeightSeries(pet.petId),
      family
        ? listWalks(family.familyId, 200)
        : listPersonalWalks(user.uid, 200),
    ]);
    setReminders(remR.status === "fulfilled" ? remR.value : []);
    setTodayDone(doneR.status === "fulfilled" ? doneR.value : []);
    setExpenses(exR.status === "fulfilled" ? exR.value : []);
    setRecords(recsR.status === "fulfilled" ? recsR.value : []);
    setWeights(wR.status === "fulfilled" ? wR.value : []);
    setWalks(walksR.status === "fulfilled" ? walksR.value : []);
  }, [user, family, pet]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ── Dialog state ────────────────────────────────────────────────
  const [editingPet, setEditingPet] = useState(false);
  const [addingPet, setAddingPet] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [addingRecord, setAddingRecord] = useState(false);

  // ── Camera-first scanner flow (spec expenses-into-pets-page D2) ─
  // FAB on expenses tab triggers a hidden capture="environment" input
  // → file picked → ReceiptScanner opens with the file pre-loaded
  // (skips its 拍照/從相簿選 intro) → AI scan → ExpenseFormDialog
  // pre-fills + defaults to the active pet.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerInitialFile, setScannerInitialFile] = useState<File | null>(
    null,
  );
  const [expensePrefill, setExpensePrefill] = useState<ExtractedReceipt | null>(
    null,
  );
  const scannerFileInputRef = useRef<HTMLInputElement | null>(null);

  const [switcherOpen, setSwitcherOpen] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────
  async function handleAddPet(input: PetInput, avatar?: File) {
    if (!user) return;
    await createPet(family?.familyId ?? null, user.uid, input, avatar);
    setAddingPet(false);
    await onPetsChanged();
  }

  async function handleUpdatePet(input: PetInput, avatar?: File) {
    if (!user || !pet) return;
    await updatePet(pet.petId, input, user.uid, avatar);
    setEditingPet(false);
    await onPetsChanged();
  }

  async function handleSelectPet(p: Pet) {
    setSwitcherOpen(false);
    if (mode === "detail") {
      // Preserve current tab in URL.
      const qs = new URLSearchParams();
      if (tab !== "overview") qs.set("tab", tab);
      const url = qs.toString()
        ? `/app/pets/${p.petId}?${qs.toString()}`
        : `/app/pets/${p.petId}`;
      router.push(url);
    } else {
      setSelectedPetId(p.petId);
    }
  }

  async function handleCompleteReminder(r: Reminder) {
    if (!user) return;
    try {
      await completeReminder(r, user.uid);
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
    await refreshData();
  }

  async function handleAddReminder(input: ReminderInput) {
    if (!user) return;
    await createReminder({
      ...input,
      petId: input.petId ?? pet?.petId,
      familyId: family?.familyId ?? null,
      createdByUid: user.uid,
    });
    setAddingReminder(false);
    await refreshData();
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
    await refreshData();
  }

  async function handleDeleteReminder(r: Reminder) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: r.title,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteReminder(r.reminderId);
    await refreshData();
  }

  async function handleAddExpense(input: ExpenseInput) {
    if (!user) return;
    await createExpense({
      ...input,
      familyId: family?.familyId ?? null,
      payerUid: user.uid,
      payerName: user.displayName ?? undefined,
    });
    setAddingExpense(false);
    await refreshData();
  }

  async function handleUpdateExpense(input: ExpenseInput) {
    if (!editingExpense) return;
    await updateExpense(editingExpense.expenseId, input);
    setEditingExpense(undefined);
    await refreshData();
  }

  async function handleDeleteExpense(e: Expense) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: `${e.vendor ?? ""} · NT$ ${e.amount.toLocaleString()}`,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteExpense(e.expenseId);
    await refreshData();
  }

  async function handleAddRecord(input: HealthRecordInput) {
    if (!user || !pet) return;
    await createRecord(pet.petId, user.uid, input);
    setAddingRecord(false);
    await refreshData();
  }

  async function handleDeleteRecord(r: HealthRecord) {
    if (!pet) return;
    const ok = await askConfirm({
      title: tC("delete"),
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteRecord(pet.petId, r.recordId);
    await refreshData();
  }

  async function handleDeletePet() {
    if (!pet) return;
    const ok = await askConfirm({
      title: `${tC("delete")}: ${pet.name}`,
      message:
        "刪除後相關的健康紀錄與貼文照片仍會保留，但寵物本身會被移除。",
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deletePet(pet.petId);
    if (mode === "detail") {
      router.push("/app/pets");
    } else {
      await onPetsChanged();
    }
  }

  // ── FAB target — tab decides which form opens ───────────────────
  function handleFab() {
    if (tab === "expenses") {
      // Camera-first per spec D2: trigger hidden capture input
      // directly. iOS Safari opens the back camera; desktop falls
      // back to a normal file picker. Manual entry stays one tap
      // away via the link inside ReceiptScanner.
      setExpensePrefill(null);
      setScannerInitialFile(null);
      scannerFileInputRef.current?.click();
    } else if (tab === "health") setAddingRecord(true);
    else setAddingReminder(true);
  }

  function handleScannerFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) {
      // User dismissed the OS camera sheet — fall into ReceiptScanner's
      // intro view so they can choose "從相簿選" or 手動輸入 instead
      // of stranding them with no follow-up. Spec calls out this
      // fallback path explicitly.
      setScannerInitialFile(null);
      setScannerOpen(true);
      return;
    }
    setScannerInitialFile(file);
    setScannerOpen(true);
  }

  function handleScannerManualEntry() {
    setScannerOpen(false);
    setScannerInitialFile(null);
    setExpensePrefill(null);
    setAddingExpense(true);
  }

  function handleExtracted(data: ExtractedReceipt) {
    // Scanner finished — close it and open the form with AI prefill.
    // defaultPetId on the form falls back to the active pet so the
    // pet-picker doesn't surprise-swap to pets[0].
    setExpensePrefill(data);
    setAddingExpense(true);
  }

  // Reset prefill when the expense dialog closes so the next manual
  // "add expense" doesn't accidentally inherit AI-extracted values.
  function handleAddExpenseClose() {
    setAddingExpense(false);
    setExpensePrefill(null);
  }

  if (!pet) return null;

  const title = mode === "detail" ? tPP("title.detail") : tPP("title.list");
  const multi = pets.length >= 2;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <PetsTopBar
          title={title}
          addLabel={tPP("addPet")}
          onAdd={() => setAddingPet(true)}
        />

        <div className="relative">
          <PetHeader
            pet={pet}
            multi={multi}
            dropdownOpen={switcherOpen}
            onToggleSwitcher={() => setSwitcherOpen((v) => !v)}
            onEdit={() => setEditingPet(true)}
          />
          {switcherOpen && multi && (
            <PetSwitcherDropdown
              pets={pets}
              currentPetId={pet.petId}
              onSelect={handleSelectPet}
              onAddPet={() => {
                setSwitcherOpen(false);
                setAddingPet(true);
              }}
              onClose={() => setSwitcherOpen(false)}
            />
          )}
        </div>

        <PetTabs active={tab} onChange={setTab} />

        <div className="pb-32">
          {tab === "overview" && (
            <PetOverviewBody
              pet={pet}
              reminders={reminders}
              expenses={expenses}
              walks={walks}
            />
          )}
          {tab === "reminders" && (
            <PetRemindersBody
              pet={pet}
              reminders={reminders}
              doneThisMonth={todayDone}
              onComplete={handleCompleteReminder}
              onEdit={(r) => setEditingReminder(r)}
              onDelete={handleDeleteReminder}
              onAdd={() => setAddingReminder(true)}
            />
          )}
          {tab === "expenses" && (
            <PetExpensesBody
              pet={pet}
              expenses={expenses}
              onEdit={(e) => setEditingExpense(e)}
              onDelete={handleDeleteExpense}
              onAdd={() => setAddingExpense(true)}
            />
          )}
          {tab === "health" && (
            <PetHealthBody
              pet={pet}
              records={records}
              weights={weights}
              onDelete={handleDeleteRecord}
              onAdd={() => setAddingRecord(true)}
            />
          )}

          {/* Detail-only: pet delete sits at the bottom so list mode
              doesn't show a per-pet destructive action in a multi-pet
              context (use the pet-edit dialog → delete-from-form path
              there). */}
          {mode === "detail" && (
            <button
              type="button"
              onClick={handleDeletePet}
              className="mt-8 w-full rounded-xl border border-mango-hairline bg-mango-card px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:hover:bg-red-950"
            >
              {tC("delete")} {pet.name}
            </button>
          )}
        </div>
      </div>

      <PetFloatingAdd
        tab={tab}
        ariaLabel={tPP(`fab.${tab}`)}
        onClick={handleFab}
      />

      {/* Dialogs */}
      <PetFormDialog
        open={addingPet}
        onClose={() => setAddingPet(false)}
        onSubmit={handleAddPet}
      />
      <PetFormDialog
        open={editingPet}
        onClose={() => setEditingPet(false)}
        initial={pet}
        onSubmit={handleUpdatePet}
      />
      <ReminderFormDialog
        open={addingReminder}
        onClose={() => setAddingReminder(false)}
        pets={pets}
        defaultPetId={pet.petId}
        onSubmit={handleAddReminder}
      />
      <ReminderFormDialog
        open={editingReminder !== null}
        onClose={() => setEditingReminder(null)}
        pets={pets}
        initial={editingReminder ?? undefined}
        onSubmit={handleUpdateReminder}
      />
      <ExpenseFormDialog
        open={addingExpense}
        onClose={handleAddExpenseClose}
        pets={pets}
        prefill={expensePrefill}
        defaultPetId={pet.petId}
        onSubmit={handleAddExpense}
      />
      <ExpenseFormDialog
        open={editingExpense !== undefined}
        onClose={() => setEditingExpense(undefined)}
        pets={pets}
        initial={editingExpense}
        onSubmit={handleUpdateExpense}
      />
      <HealthRecordFormDialog
        open={addingRecord}
        onClose={() => setAddingRecord(false)}
        onSubmit={handleAddRecord}
      />

      {/* Camera-first scanner flow (spec D2). Hidden input lives here
          (not inside the scanner) so the FAB can trigger native iOS
          camera *before* the scanner dialog opens — going straight
          to the preview / scan view with the captured file. */}
      <input
        ref={scannerFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={handleScannerFilePicked}
        aria-hidden="true"
      />
      <ReceiptScanner
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScannerInitialFile(null);
        }}
        onExtracted={(data) => {
          setScannerOpen(false);
          setScannerInitialFile(null);
          handleExtracted(data);
        }}
        initialFile={scannerInitialFile}
        defaultPetId={pet.petId}
        onManualEntry={handleScannerManualEntry}
      />
    </div>
  );
}
