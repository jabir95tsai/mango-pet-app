/**
 * Pets tab — iOS parity of apps/web/src/app/app/pets/page.tsx. Shell (top bar
 * + pet header with a floating switcher + sticky 4-tab pill) + all four tab
 * bodies (overview / reminders / expenses / health) + per-tab "+" FAB that
 * opens the matching form. Pet add/edit/delete via the header pencil, the
 * switcher, the top-bar pill and the empty-state CTA.
 *
 * Data: usePetsData (family-scoped, refetch on focus when stale, pull-to-
 * refresh). A failed first load shows an error + retry, never the add-first-
 * pet state. Writes go directly to Firestore (forms own the write calls) and
 * gate on `scopeReady`; a save reloads here and marks other tabs stale.
 *
 * Layout: the bottom tab bar is in-flow (the screen ends at its top edge), so
 * the FAB sits 20pt above it — the raised centre disc only overlaps the
 * middle of the bar, never the right-aligned FAB.
 */
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, Plus } from "lucide-react-native";
import { fromLocalDateInput } from "@mango/shared-business";
import type {
  Expense,
  ExpenseSource,
  ExtractedReceipt,
  Pet,
  Reminder,
} from "@mango/shared-types";

import { usePetsData } from "@/lib/use-pets-data";
import { useAuth } from "@/state/auth-context";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { colors, mangoGradient, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

type FormState =
  | { kind: "pet"; pet?: Pet }
  | { kind: "reminder"; reminder?: Reminder }
  | {
      kind: "expense";
      expense?: Expense;
      initial?: ExpenseFormInitial;
      source?: ExpenseSource;
      items?: string[];
    }
  | { kind: "scanner" }
  | { kind: "health" }
  | null;

/** Index of the tabs wrapper among the ScrollView children (sticky). */
const STICKY_TABS_INDEX = 2;

export default function PetsScreen() {
  const { user } = useAuth();
  const data = usePetsData();
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<PetTabKey>("overview");
  const [switcherAnchor, setSwitcherAnchor] = useState<{ x: number; y: number } | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [healthKey, setHealthKey] = useState(0);
  const headerRef = useRef<View>(null);

  const uid = user?.uid ?? "";
  const displayName = user?.displayName ?? undefined;

  const {
    loading,
    refreshing,
    petsUnknown,
    pets,
    reminders,
    expenses,
    walks,
    familyId,
    activePet,
    hasMultiplePets,
    selectPet,
    refresh,
    reloadAfterWrite,
    scopeReady,
  } = data;

  const afterSave = useCallback(() => {
    // Reload here + mark Home/Walks stale so they refetch on focus.
    void reloadAfterWrite();
  }, [reloadAfterWrite]);

  function closeForm() {
    setForm(null);
  }
  /** Never open a write form while the family scope is unknown (R08). */
  function openForm(next: Exclude<FormState, null>) {
    if (!scopeReady) {
      void refresh();
      return;
    }
    setForm(next);
  }
  function afterHealthSave() {
    void reloadAfterWrite(); // weight records sync pet.weightKg
    setHealthKey((k) => k + 1);
  }
  function onPullRefresh() {
    void refresh();
    setHealthKey((k) => k + 1); // health records reload silently too
  }
  function openTabFab() {
    // Expenses FAB is camera-first (拍收據); manual entry is the in-scanner
    // fallback. Other tabs open their form directly.
    if (activeTab === "expenses") openForm({ kind: "scanner" });
    else if (activeTab === "health") openForm({ kind: "health" });
    else openForm({ kind: "reminder" }); // overview + reminders → new reminder
  }
  function toggleSwitcher() {
    if (switcherAnchor) {
      setSwitcherAnchor(null);
      return;
    }
    // Web: absolute left-0, top = header bottom + 4 — measured in window
    // coordinates so the panel floats over the (sticky) tabs.
    headerRef.current?.measureInWindow((x, y, _w, h) => setSwitcherAnchor({ x, y: y + h + 4 }));
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

  const petForm =
    form?.kind === "pet" ? (
      <PetForm
        familyId={familyId}
        uid={uid}
        pet={form.pet}
        onClose={closeForm}
        onSaved={afterSave}
        // usePetsData falls back to the primary pet once the deleted one is gone.
        onDeleted={() => setSwitcherAnchor(null)}
      />
    ) : null;

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

  // Pets could not be read → error + retry (never the 0-pet hero). A failed
  // reminders / expenses / walks read alone does not count.
  if (petsUnknown && pets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.errorWrap}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={colors.brand} />
          }
        >
          <EmptyState
            icon={AlertCircle}
            title={t("Error.title")}
            action={{ label: t("Error.retry"), onPress: () => void refresh() }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 0 pets → empty state, no tabs.
  if (pets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <PetsEmptyState onAddPet={() => openForm({ kind: "pet" })} />
        {petForm}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[STICKY_TABS_INDEX]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={colors.brand} />
        }
      >
        {/* [0] Title row — h1 + brand-tint「＋ 新增寵物」pill (web PetsTopBar). */}
        <View style={styles.topBar}>
          <Text style={styles.h1} accessibilityRole="header">
            {t("PetsPage.title.list")}
          </Text>
          <Pressable
            onPress={() => openForm({ kind: "pet" })}
            accessibilityRole="button"
            accessibilityLabel={t("PetsPage.addPet")}
            style={({ pressed }) => [styles.addPetBtn, pressed && styles.addPetPressed]}
          >
            <Plus size={16} color={colors.brandDeep} strokeWidth={2.5} />
            <Text style={styles.addPetText}>{t("PetsPage.addPet")}</Text>
          </Pressable>
        </View>

        {/* [1] Pet header (the switcher floats under it) */}
        <View ref={headerRef} collapsable={false}>
          {activePet ? (
            <PetHeader
              pet={activePet}
              multi={hasMultiplePets}
              switcherOpen={switcherAnchor !== null}
              onToggleSwitcher={toggleSwitcher}
              onEdit={() => openForm({ kind: "pet", pet: activePet })}
            />
          ) : null}
        </View>

        {/* [2] Sticky tab pill bar */}
        <View style={styles.tabsWrap}>
          <PetTabs active={activeTab} onChange={setActiveTab} />
        </View>

        {/* [3] Active tab body */}
        <View>
          {activePet ? (
            activeTab === "overview" ? (
              <PetOverviewBody
                pet={activePet}
                reminders={reminders}
                expenses={expenses}
                walks={walks}
                uid={uid}
                onChanged={afterSave}
                onEditReminder={(reminder) => openForm({ kind: "reminder", reminder })}
              />
            ) : activeTab === "reminders" ? (
              <PetRemindersBody
                petId={activePet.petId}
                petName={activePet.name}
                reminders={reminders}
                uid={uid}
                onChanged={afterSave}
                onEdit={(reminder) => openForm({ kind: "reminder", reminder })}
                onAdd={() => openForm({ kind: "reminder" })}
              />
            ) : activeTab === "expenses" ? (
              <PetExpensesBody
                petId={activePet.petId}
                expenses={expenses}
                onEdit={(expense) => openForm({ kind: "expense", expense })}
                onAdd={() => openForm({ kind: "expense", source: "manual" })}
                onChanged={afterSave}
              />
            ) : (
              <PetHealthBody
                petId={activePet.petId}
                reloadKey={healthKey}
                petWeightKg={activePet.weightKg ?? null}
                onAdd={() => openForm({ kind: "health" })}
                onChanged={afterSave}
              />
            )
          ) : null}
        </View>
      </ScrollView>

      {/* Per-tab add FAB (web: 56pt, right-5, Plus 22) */}
      <Pressable
        onPress={openTabFab}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={t(`PetsPage.fab.${activeTab}`)}
      >
        <LinearGradient
          colors={mangoGradient.colors}
          locations={mangoGradient.locations}
          start={mangoGradient.start}
          end={mangoGradient.end}
          style={styles.fabFill}
        >
          <Plus size={22} color="#ffffff" strokeWidth={2.5} />
        </LinearGradient>
      </Pressable>

      {/* Floating pet switcher — outside taps close it (web click-outside). */}
      {hasMultiplePets && activePet ? (
        <Modal
          visible={switcherAnchor !== null}
          transparent
          animationType={reduceMotion ? "none" : "fade"}
          onRequestClose={() => setSwitcherAnchor(null)}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSwitcherAnchor(null)}
            accessibilityRole="button"
            accessibilityLabel={t("Common.close")}
          />
          {switcherAnchor ? (
            <PetSwitcher
              pets={pets}
              activePetId={activePet.petId}
              style={[styles.switcher, { left: switcherAnchor.x, top: switcherAnchor.y }]}
              onSelect={(petId) => {
                selectPet(petId);
                setSwitcherAnchor(null);
              }}
              onAddPet={() => {
                setSwitcherAnchor(null);
                openForm({ kind: "pet" });
              }}
            />
          ) : null}
        </Modal>
      ) : null}

      {/* Forms (mounted only while open → fresh state per open) */}
      {petForm}
      {form?.kind === "reminder" && activePet ? (
        <ReminderForm
          familyId={familyId}
          uid={uid}
          petId={activePet.petId}
          pets={pets}
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
          pets={pets}
          expense={form.expense}
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
          onSaved={afterHealthSave}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorWrap: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  // Bottom pad clears the FAB: 56 + 20 + 20.
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 96,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
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
  // web: h-[34px] rounded-full bg-brand-tint pl-2 pr-3 gap-1 Plus 16
  addPetBtn: {
    height: 34,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  addPetText: { fontSize: 14, fontWeight: "700", color: colors.brandDeep },
  addPetPressed: { opacity: 0.85 },
  // Sticky: opaque bg so cards scroll underneath (web pt-3.5 pb-2.5).
  tabsWrap: { backgroundColor: colors.bg, paddingTop: 14, paddingBottom: 10 },
  switcher: { position: "absolute" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
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
});
