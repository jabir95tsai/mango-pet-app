/**
 * 4-tab pill bar (概覽 / 提醒 / 開銷 / 健康) — 1:1 with apps/web/src/components/
 * pets/pet-tabs.tsx: a single bg-alt pill (rounded-full, hairline border, p-1)
 * (active = card bg + soft shadow + bold ink; inactive = ink-2 semibold).
 * iOS motion: the active pill is a draggable glass lens (ui/LensTrack) —
 * docs/design-system.md §4 exception (user 2026-10-11); web stays a toggle.
 */
import { StyleSheet, Text } from "react-native";

import { LensTrack } from "@/components/ui/LensTrack";

import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");

export const PET_TABS = ["overview", "reminders", "expenses", "health"] as const;
export type PetTabKey = (typeof PET_TABS)[number];

export function PetTabs({
  active,
  onChange,
}: {
  active: PetTabKey;
  onChange: (tab: PetTabKey) => void;
}) {
  return (
    <LensTrack
      items={PET_TABS.map((key) => ({ key, accessibilityLabel: tPP(`tabs.${key}`) }))}
      selectedIndex={PET_TABS.indexOf(active)}
      onSelect={(i) => onChange(PET_TABS[i])}
      trackStyle={styles.bar}
      itemStyle={() => styles.tab}
      lensStyle={styles.tabActive}
      lensRadius={radius.pill}
      renderItem={(i, lit) => (
        <Text style={[styles.label, lit && styles.labelActive]}>{tPP(`tabs.${PET_TABS[i]}`)}</Text>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    minHeight: 44,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.card,
    shadowColor: "#50320a",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  label: { fontSize: 13.5, fontWeight: "600", letterSpacing: 0.2, color: colors.ink2 },
  labelActive: { color: colors.ink, fontWeight: "700" },
});
