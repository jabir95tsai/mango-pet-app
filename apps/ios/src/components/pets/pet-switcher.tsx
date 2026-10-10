/**
 * Pet switcher dropdown — list of pets (34px avatar + name + breed/weight +
 * check on active) with an "新增寵物" row at the bottom. A floating 240pt
 * panel (radius 18, padding 6, hairline, elevated shadow) the screen anchors
 * under the header — it overlays the tabs instead of pushing them down; the
 * screen also renders the outside-tap backdrop. Mirrors web
 * pet-switcher-dropdown (active row brand-tint, radius 12).
 */
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Check, Plus } from "lucide-react-native";
import type { Pet } from "@mango/shared-types";

import { scoped } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";
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
  style,
}: {
  pets: Pet[];
  activePetId: string | null;
  onSelect: (petId: string) => void;
  onAddPet?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]} accessibilityViewIsModal>
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
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && !active && styles.rowPressed,
              ]}
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
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
      >
        <View style={styles.addIcon}>
          <Plus size={18} color={colors.brandDeep} strokeWidth={2.5} />
        </View>
        <Text style={styles.addText}>{tPP("switcher.addPet")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: absolute w-60 rounded-[18px] border bg-card p-1.5 shadow-elevated
  card: {
    width: 240,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 6,
    ...shadows.elevated,
  },
  scroll: { maxHeight: 240 },
  // web: gap-2.5 rounded-xl p-2
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
  },
  rowActive: { backgroundColor: colors.brandTint },
  rowPressed: { backgroundColor: colors.bgAlt },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowSub: { fontSize: 11, color: colors.ink3 },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 4, marginHorizontal: 4 },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontSize: 14, fontWeight: "700", color: colors.brandDeep },
});
