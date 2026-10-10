/**
 * Pet header — 64px avatar + name (chevron when ≥2 pets) + meta chips
 * (species/breed · sex · age · weight) + edit pencil. Mirrors web pet-header:
 * - age via shared formatAge (zh-TW units)
 * - sex glyph ♂/♀ (hidden for unknown)
 * - species label falls back breed → speciesOther → localized species
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, Pencil } from "lucide-react-native";
import { formatAge } from "@mango/shared-business";
import type { Pet } from "@mango/shared-types";

import { scoped, t } from "@/lib/i18n";
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
          accessibilityLabel={multi ? t("Walks.page.petPicker.openLabel", { pet: pet.name }) : undefined}
        >
          <Text style={styles.name} numberOfLines={1}>
            {pet.name}
          </Text>
          {multi ? (
            // Static flip (no transition → nothing to gate for reduced motion)
            <View style={[styles.chevron, switcherOpen && styles.chevronOpen]}>
              <ChevronDown size={14} color={colors.ink2} strokeWidth={2.2} />
            </View>
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
        accessibilityLabel={t("Common.edit")}
      >
        <Pencil size={16} color={colors.ink2} strokeWidth={2} />
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
  chevron: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    backgroundColor: colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11.5, fontWeight: "600", color: colors.ink2, letterSpacing: 0.1 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
});
