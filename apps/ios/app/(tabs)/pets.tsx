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
import type { Pet, Reminder } from "@mango/shared-types";

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
import { ExpenseForm } from "@/components/pets/expense-form";
import { HealthForm } from "@/components/pets/health-form";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");

type FormState =
  | { kind: "pet"; pet?: Pet }
  | { kind: "reminder"; reminder?: Reminder }
  | { kind: "expense" }
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
    if (activeTab === "expenses") setForm({ kind: "expense" });
    else if (activeTab === "health") setForm({ kind: "health" });
    else setForm({ kind: "reminder" }); // overview + reminders → new reminder
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
        <Text style={styles.h1}>{tPP("title.list")}</Text>

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
        <Text style={styles.fabPlus}>＋</Text>
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
      {form?.kind === "expense" && activePet ? (
        <ExpenseForm
          familyId={familyId}
          uid={uid}
          displayName={displayName}
          petId={activePet.petId}
          petName={activePet.name}
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
  h1: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  tabsWrap: { marginVertical: spacing.sm },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandDeep,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { opacity: 0.85 },
  fabPlus: { fontSize: 30, fontWeight: "800", color: colors.card, marginTop: -2 },
});
