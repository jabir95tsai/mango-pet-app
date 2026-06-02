/**
 * Pet header — 64px avatar + name (chevron when ≥2 pets) + meta chips
 * (species/breed · sex · age · weight) + edit pencil. Mirrors web pet-header:
 * - age via shared formatAge (zh-TW units)
 * - sex glyph ♂/♀ (hidden for unknown)
 * - species label falls back breed → speciesOther → localized species
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatAge } from "@mango/shared-business";
import type { Pet } from "@mango/shared-types";

import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import { PetAvatar } from "./pet-avatar";

const tPet = scoped("Pet");
const tPP = scoped("PetsPage");

function genderSym(gender?: Pet["gender"]): string | null {
  if (!gender || gender === "unknown") return null;
  return gender === "male" ? "♂" : "♀";
}

export function PetHeader({
  pet,
  multi,
  switcherOpen = false,
  onToggleSwitcher,
  onEdit,
}: {
  pet: Pet;
  multi: boolean;
  switcherOpen?: boolean;
  onToggleSwitcher?: () => void;
  onEdit?: () => void;
}) {
  const sexAge = [genderSym(pet.gender), formatAge(pet.birthday)]
    .filter(Boolean)
    .join(" · ");
  const speciesLabel =
    pet.breed ?? pet.speciesOther ?? tPet(`species.${pet.species}`);
  const kg =
    pet.weightKg != null ? `${pet.weightKg} ${tPP("kgUnit")}` : null;
  const chips = [speciesLabel, sexAge, kg].filter(
    (s): s is string => !!s && s.length > 0,
  );

  return (
    <View style={styles.row}>
      <PetAvatar name={pet.name} photoURL={pet.photoURL} size={64} />
      <View style={styles.body}>
        <Pressable
          disabled={!multi}
          onPress={onToggleSwitcher}
          hitSlop={6}
          style={styles.nameRow}
          accessibilityRole={multi ? "button" : undefined}
          accessibilityState={multi ? { expanded: switcherOpen } : undefined}
        >
          <Text style={styles.name} numberOfLines={1}>
            {pet.name}
          </Text>
          {multi ? (
            <Text style={[styles.chevron, switcherOpen && styles.chevronOpen]}>
              ⌄
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.chips}>
          {chips.map((c, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={8}
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={tPet("petDetail")}
      >
        <Text style={styles.editIcon}>✎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: { flex: 1, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  chevron: { fontSize: 18, fontWeight: "800", color: colors.ink3, marginTop: -4 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: colors.cardSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  editIcon: { fontSize: 17, color: colors.ink2 },
  pressed: { opacity: 0.7 },
});
