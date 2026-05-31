/**
 * Active-pet pill + multi-pet picker sheet. Single pet → static pill. Multiple
 * pets → tappable pill opening a bottom sheet listing each pet with its daily
 * goal chip; selecting switches the dial's goal. Mirrors web pet-picker-dropdown
 * (per-pet-walk-goal). Selection is in-memory for P1a (persistence = follow-up).
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPetWalkGoalMinutes } from "@mango/shared-business";
import type { Pet } from "@mango/shared-types";

import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  activePet: Pet;
  pets: Pet[];
  hasMultiplePets: boolean;
  onSelect: (petId: string) => void;
};

export function PetPill({ activePet, pets, hasMultiplePets, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole={hasMultiplePets ? "button" : "text"}
        accessibilityLabel={
          hasMultiplePets ? `切換寵物，目前 ${activePet.name}` : activePet.name
        }
        disabled={!hasMultiplePets}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🐶</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {activePet.name}
        </Text>
        {hasMultiplePets ? <Text style={styles.chevron}>⌄</Text> : null}
      </Pressable>

      {hasMultiplePets ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <SafeAreaView edges={["bottom"]} style={styles.sheetWrap}>
              <Pressable style={styles.sheet}>
                <Text style={styles.sheetTitle}>選擇寵物</Text>
                {pets.map((p) => {
                  const goal = getPetWalkGoalMinutes(p);
                  const selected = p.petId === activePet.petId;
                  return (
                    <Pressable
                      key={p.petId}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        onSelect(p.petId);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        selected && styles.rowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarEmoji}>🐶</Text>
                      </View>
                      <Text style={styles.rowName}>{p.name}</Text>
                      <View style={styles.goalChip}>
                        <Text style={styles.goalChipText}>{`${goal} 分`}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 14 },
  name: { fontSize: 13, fontWeight: "700", color: colors.ink, maxWidth: 110 },
  chevron: { fontSize: 14, color: colors.ink3, marginTop: -4 },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheetWrap: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheet: { padding: spacing.lg, gap: spacing.xs },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowSelected: { backgroundColor: colors.brandTint },
  rowName: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  goalChip: {
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  goalChipText: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
});
