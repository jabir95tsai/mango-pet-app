/**
 * Pet switcher dropdown — list of pets (34px avatar + name + breed/weight +
 * check on active) with an "新增寵物" row at the bottom. Rendered inline under
 * the header (not a modal) when the header chevron is tapped and there are ≥2
 * pets. Mirrors web pet-switcher-dropdown.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import type { Pet } from "@mango/shared-types";

import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import { PetAvatar } from "./pet-avatar";

const tPP = scoped("PetsPage");
const tPet = scoped("Pet");

function subtitle(pet: Pet): string | null {
  const parts = [
    pet.breed ?? pet.speciesOther ?? tPet(`species.${pet.species}`),
    pet.weightKg != null ? `${pet.weightKg} ${tPP("kgUnit")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function PetSwitcher({
  pets,
  activePetId,
  onSelect,
  onAddPet,
}: {
  pets: Pet[];
  activePetId: string | null;
  onSelect: (petId: string) => void;
  onAddPet?: () => void;
}) {
  return (
    <View style={styles.card}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {pets.map((pet) => {
          const active = pet.petId === activePetId;
          const sub = subtitle(pet);
          return (
            <Pressable
              key={pet.petId}
              onPress={() => onSelect(pet.petId)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <PetAvatar name={pet.name} photoURL={pet.photoURL} size={34} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {pet.name}
                </Text>
                {sub ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
              </View>
              {active ? <Check size={16} color={colors.brandDeep} strokeWidth={2.5} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.divider} />
      <Pressable
        onPress={onAddPet}
        style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <View style={styles.addIcon}>
          <Text style={styles.addIconText}>＋</Text>
        </View>
        <Text style={styles.addText}>{tPP("switcher.addPet")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    shadowColor: colors.paw,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  scroll: { maxHeight: 240 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBody: { flex: 1, gap: 1 },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  rowSub: { fontSize: 12, color: colors.ink3 },
  check: { fontSize: 16, fontWeight: "800", color: colors.brandDeep },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  addIconText: { fontSize: 18, fontWeight: "800", color: colors.brandDeep },
  addText: { fontSize: 15, fontWeight: "700", color: colors.brandDeep },
  pressed: { opacity: 0.6 },
});
