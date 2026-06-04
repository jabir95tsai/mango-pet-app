/**
 * Pets tab — iOS parity of apps/web/src/app/app/pets/page.tsx. Shell (list/
 * switcher/header + 4-tab pill) + all four tab bodies (overview / reminders /
 * expenses / health) + per-tab "+" FAB that opens the matching form. Pet
 * add/edit via the header pencil, switcher, and empty-state CTA.
 *
 * Data: usePetsData (one-shot + pull-to-refresh, personal/family scope). Writes
 * go directly to Firestore (forms own the write calls); a save refreshes the
 * list. All copy via the shared i18n catalog (@/lib/i18n).
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { fromLocalDateInput } from "@mango/shared-business";
import type {
  ExpenseSource,
  ExtractedReceipt,
  Pet,
  Reminder,
} from "@mango/shared-types";

import { usePetsData } from "@/lib/use-pets-data";
import { useAuth } from "@/state/auth-context";
import { scoped } from "@/lib/i18n";
import { PetHeader } from "@/components/pets/pet-header";
import { PetSwitcher } from "@/components/pets/pet-switcher";
import { PetTabs, type PetTabKey } from "@/components/pets/pet-tabs";
import { PetOverviewBody } from "@/components/pets/pet-overview-body";
import { PetRemindersBody } from "@/components/pets/pet-reminders-body";
import { PetExpensesBody } from "@/components/pets/pet-expenses-body";
import { PetHealthBody } from "@/components/pets/pet-health-body";
import { PetsEmptyState } from "@/components/pets/pets-empty-state";
import { PetForm } from "@/components/pets/pet-form";
import { ReminderForm } from "@/components/pets/reminder-form";
import { ExpenseForm, type ExpenseFormInitial } from "@/components/pets/expense-form";
import { HealthForm } from "@/components/pets/health-form";
import { ReceiptScanner } from "@/components/pets/receipt-scanner";
import { LinearGradient } from "expo-linear-gradient";
import { colors, mangoGradient, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");

type FormState =
  | { kind: "pet"; pet?: Pet }
  | { kind: "reminder"; reminder?: Reminder }
  | {
      kind: "expense";
      initial?: ExpenseFormInitial;
      source?: ExpenseSource;
      items?: string[];
    }
  | { kind: "scanner" }
  | { kind: "health" }
  | null;

export default function PetsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const data = usePetsData();
  const [activeTab, setActiveTab] = useState<PetTabKey>("overview");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [healthKey, setHealthKey] = useState(0);

  const uid = user?.uid ?? "";
  const displayName = user?.displayName ?? undefined;

  const {
    loading,
    refreshing,
    pets,
    reminders,
    expenses,
    walks,
    familyId,
    activePet,
    hasMultiplePets,
    selectPet,
    refresh,
  } = data;

  function closeForm() {
    setForm(null);
  }
  function afterSave() {
    refresh();
    setHealthKey((k) => k + 1);
  }
  function openTabFab() {
    // Expenses FAB is camera-first (拍收據); manual entry is the in-scanner
    // fallback. Other tabs open their form directly.
    if (activeTab === "expenses") setForm({ kind: "scanner" });
    else if (activeTab === "health") setForm({ kind: "health" });
    else setForm({ kind: "reminder" }); // overview + reminders → new reminder
  }

  /** AI receipt → expense-form prefill (spentAt string → local Date). */
  function onReceiptExtracted(receipt: ExtractedReceipt) {
    setForm({
      kind: "expense",
      source: "ai_scan",
      items: receipt.items,
      initial: {
        amount: receipt.amount,
        vendor: receipt.vendor,
        category: receipt.category,
        spentAt: receipt.spentAt ? fromLocalDateInput(receipt.spentAt) : undefined,
      },
    });
  }

  // Initial load → spinner.
  if (loading && pets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  // 0 pets → empty state, no tabs.
  if (pets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <PetsEmptyState onAddPet={() => setForm({ kind: "pet" })} />
        {form?.kind === "pet" ? (
          <PetForm
            familyId={familyId}
            uid={uid}
            pet={form.pet}
            onClose={closeForm}
            onSaved={afterSave}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.brand}
          />
        }
      >
        {/* Title row — h1 + brand-tint「＋寵物」pill (web PetsTopBar). */}
        <View style={styles.topBar}>
          <Text style={styles.h1}>{tPP("title.list")}</Text>
          <Pressable
            onPress={() => setForm({ kind: "pet" })}
            accessibilityRole="button"
            accessibilityLabel={tPP("addPet")}
            style={({ pressed }) => [styles.addPetBtn, pressed && styles.addPetPressed]}
          >
            <Text style={styles.addPetText}>＋ {tPP("addPet")}</Text>
          </Pressable>
        </View>

        {activePet ? (
          <>
            <PetHeader
              pet={activePet}
              multi={hasMultiplePets}
              switcherOpen={switcherOpen}
              onToggleSwitcher={() => setSwitcherOpen((v) => !v)}
              onEdit={() => setForm({ kind: "pet", pet: activePet })}
            />

            {switcherOpen && hasMultiplePets ? (
              <PetSwitcher
                pets={pets}
                activePetId={activePet.petId}
                onSelect={(petId) => {
                  selectPet(petId);
                  setSwitcherOpen(false);
                }}
                onAddPet={() => {
                  setSwitcherOpen(false);
                  setForm({ kind: "pet" });
                }}
              />
            ) : null}

            <View style={styles.tabsWrap}>
              <PetTabs active={activeTab} onChange={setActiveTab} />
            </View>

            {activeTab === "overview" ? (
              <PetOverviewBody
                pet={activePet}
                reminders={reminders}
                expenses={expenses}
                walks={walks}
              />
            ) : activeTab === "reminders" ? (
              <PetRemindersBody
                petId={activePet.petId}
                petName={activePet.name}
                reminders={reminders}
                uid={uid}
                onChanged={refresh}
                onEdit={(reminder) => setForm({ kind: "reminder", reminder })}
              />
            ) : activeTab === "expenses" ? (
              <PetExpensesBody petId={activePet.petId} expenses={expenses} />
            ) : (
              <PetHealthBody petId={activePet.petId} reloadKey={healthKey} />
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Per-tab add FAB */}
      <Pressable
        onPress={openTabFab}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 76 },
          pressed && styles.fabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={tPP(`fab.${activeTab}`)}
      >
        <LinearGradient
          colors={mangoGradient.colors}
          locations={mangoGradient.locations}
          start={mangoGradient.start}
          end={mangoGradient.end}
          style={styles.fabFill}
        >
          <Text style={styles.fabPlus}>＋</Text>
        </LinearGradient>
      </Pressable>

      {/* Forms (mounted only while open → fresh state per open) */}
      {form?.kind === "pet" ? (
        <PetForm
          familyId={familyId}
          uid={uid}
          pet={form.pet}
          onClose={closeForm}
          onSaved={afterSave}
        />
      ) : null}
      {form?.kind === "reminder" && activePet ? (
        <ReminderForm
          familyId={familyId}
          uid={uid}
          petId={activePet.petId}
          reminder={form.reminder}
          onClose={closeForm}
          onSaved={afterSave}
        />
      ) : null}
      {form?.kind === "scanner" && activePet ? (
        <ReceiptScanner
          onClose={closeForm}
          onExtracted={onReceiptExtracted}
          onManual={() => setForm({ kind: "expense", source: "manual" })}
        />
      ) : null}
      {form?.kind === "expense" && activePet ? (
        <ExpenseForm
          familyId={familyId}
          uid={uid}
          displayName={displayName}
          petId={activePet.petId}
          petName={activePet.name}
          initial={form.initial}
          source={form.source}
          items={form.items}
          onClose={closeForm}
          onSaved={afterSave}
        />
      ) : null}
      {form?.kind === "health" && activePet ? (
        <HealthForm
          petId={activePet.petId}
          uid={uid}
          onClose={closeForm}
          onSaved={afterSave}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  h1: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  addPetBtn: {
    height: 34,
    flexShrink: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addPetText: { fontSize: 14, fontWeight: "700", color: colors.brandDeep },
  addPetPressed: { opacity: 0.85 },
  tabsWrap: { marginVertical: spacing.sm },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: colors.brand,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  fabFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  fabPressed: { opacity: 0.95 },
  fabPlus: { fontSize: 30, fontWeight: "800", color: "#ffffff", marginTop: -2 },
});
