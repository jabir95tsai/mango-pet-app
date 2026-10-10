/**
 * Active-pet pill + picker — 1:1 with the web walks page pill
 * (apps/web/src/app/app/walks/page.tsx) and pet-picker-dropdown.tsx.
 *
 * Single pet → static pill. Multiple pets → the pill (ChevronDown, flipped
 * while open) opens a floating 256pt panel anchored under it (card, radius 18,
 * padding 6, hairline, elevated shadow). Rows: 34pt pet avatar, name 14/700,
 * goal chip (active: white + brand-deep, else bg-alt + ink-2), Check on the
 * active row (brand-tint, radius 12). A hairline divider and a "manage pets"
 * row (Settings tile) route to the Pets tab. Tapping outside closes it.
 * The selection itself is persisted by useWalksData (web localStorage key).
 */
import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown, Settings } from "lucide-react-native";
import { getPetWalkGoalMinutes } from "@mango/shared-business";
import type { Pet } from "@mango/shared-types";

import { Avatar } from "@/components/ui/Avatar";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const PANEL_W = 256;

type Props = {
  activePet: Pet;
  pets: Pet[];
  hasMultiplePets: boolean;
  onSelect: (petId: string) => void;
};

export function PetPill({ activePet, pets, hasMultiplePets, onSelect }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { width: winW } = useWindowDimensions();
  const pillRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const open = anchor !== null;

  function openPanel() {
    pillRef.current?.measureInWindow((x, y, _w, h) => {
      // Keep the panel on screen (web: absolute left-0 under the pill).
      const left = Math.max(spacing.sm, Math.min(x, winW - PANEL_W - spacing.sm));
      setAnchor({ x: left, y: y + h + 4 });
    });
  }

  const close = () => setAnchor(null);

  return (
    <>
      <Pressable
        ref={pillRef}
        accessibilityRole={hasMultiplePets ? "button" : "text"}
        accessibilityLabel={
          hasMultiplePets
            ? t("Walks.page.petPicker.openLabel", { pet: activePet.name })
            : activePet.name
        }
        accessibilityState={hasMultiplePets ? { expanded: open } : undefined}
        disabled={!hasMultiplePets}
        onPress={openPanel}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <Avatar
          name={activePet.name}
          photoURL={activePet.photoURL}
          size={22}
          variant="pet"
          fallbackChar="🐾"
          style={styles.pillAvatar}
        />
        <Text style={styles.name} numberOfLines={1}>
          {activePet.name}
        </Text>
        {hasMultiplePets ? (
          <View style={open ? styles.chevronOpen : undefined}>
            <ChevronDown size={12} color={colors.ink3} strokeWidth={2.5} />
          </View>
        ) : null}
      </Pressable>

      {hasMultiplePets ? (
        <Modal visible={open} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={close}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel={t("Common.close")}
            accessibilityRole="button"
          />
          {anchor ? (
            <View style={[styles.panel, { left: anchor.x, top: anchor.y }]} accessibilityViewIsModal>
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
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      selected && styles.rowSelected,
                      pressed && !selected && styles.rowPressed,
                    ]}
                  >
                    <Avatar name={p.name} photoURL={p.photoURL} size={34} variant="pet" fallbackChar="🐾" />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={[styles.goalChip, selected && styles.goalChipActive]}>
                        <Text style={[styles.goalChipText, selected && styles.goalChipTextActive]}>
                          {t("Walks.page.petPicker.goalChip", { n: goal })}
                        </Text>
                      </View>
                    </View>
                    {selected ? <Check size={16} color={colors.brandDeep} strokeWidth={2.5} /> : null}
                  </Pressable>
                );
              })}
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  close();
                  router.push("/(tabs)/pets");
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.manageTile}>
                  <Settings size={18} color={colors.ink2} strokeWidth={2} />
                </View>
                <Text style={styles.manageText}>{t("Walks.page.petPicker.manageLink")}</Text>
              </Pressable>
            </View>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // web: rounded-full border bg-card pl-1 pr-2.5 py-1 gap-1.5
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
  pillAvatar: { backgroundColor: "#f7c168" },
  name: { fontSize: 13, fontWeight: "600", color: colors.ink, maxWidth: 104 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  pressed: { opacity: 0.7 },
  panel: {
    position: "absolute",
    width: PANEL_W,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 6,
    ...shadows.elevated,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
  },
  rowSelected: { backgroundColor: colors.brandTint },
  rowPressed: { backgroundColor: colors.bgAlt },
  rowBody: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 2 },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  goalChip: {
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  goalChipActive: { backgroundColor: colors.card },
  goalChipText: { fontSize: 10, fontWeight: "600", color: colors.ink2 },
  goalChipTextActive: { color: colors.brandDeep },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 4, marginHorizontal: 4 },
  manageTile: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  manageText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
});
