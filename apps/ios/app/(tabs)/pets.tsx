/**
 * Pets tab — iOS parity of apps/web/src/app/app/pets/page.tsx (P2a shell):
 * list/switcher/header + hand-rolled 4-tab pill bar + Overview tab. The
 * reminders / expenses / health tab bodies are placeholders here and land in
 * P2b (charts) / P2c (forms) / P2d (camera). Pet add/edit forms are P2c.
 *
 * Data: usePetsData (one-shot + pull-to-refresh, personal/family scope). All
 * copy goes through the shared i18n catalog (@/lib/i18n).
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { usePetsData } from "@/lib/use-pets-data";
import { scoped } from "@/lib/i18n";
import { PetHeader } from "@/components/pets/pet-header";
import { PetSwitcher } from "@/components/pets/pet-switcher";
import { PetTabs, type PetTabKey } from "@/components/pets/pet-tabs";
import { PetOverviewBody } from "@/components/pets/pet-overview-body";
import { PetsEmptyState } from "@/components/pets/pets-empty-state";
import { colors, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");

export default function PetsScreen() {
  const insets = useSafeAreaInsets();
  const data = usePetsData();
  const [activeTab, setActiveTab] = useState<PetTabKey>("overview");
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const {
    loading,
    refreshing,
    pets,
    reminders,
    expenses,
    walks,
    activePet,
    hasMultiplePets,
    selectPet,
    refresh,
  } = data;

  // TODO(P2c): replace with the real PetFormModal (add / edit). Stubbed so the
  // affordances are live without dead buttons during the shell phase.
  function comingInP2c() {
    Alert.alert(tPP("switcher.addPet"), "表單即將推出（P2c）");
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

  // 0 pets → empty state, no tabs (same gate as web).
  if (pets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <PetsEmptyState onAddPet={comingInP2c} />
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
              onEdit={comingInP2c}
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
                  comingInP2c();
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
            ) : (
              <TabPlaceholder tab={activeTab} />
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Interim body for the not-yet-built tabs (P2b reminders/expenses charts +
 *  lists, P2c forms, P2d camera). Replaced sub-phase by sub-phase. */
function TabPlaceholder({ tab }: { tab: PetTabKey }) {
  const emptyKey =
    tab === "reminders"
      ? "reminders.empty"
      : tab === "expenses"
        ? "expenses.empty"
        : "health.empty";
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{tPP(emptyKey)}</Text>
    </View>
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
  placeholder: { paddingVertical: spacing.xxl, alignItems: "center" },
  placeholderText: { fontSize: 13, color: colors.ink3 },
});
