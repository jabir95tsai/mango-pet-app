/**
 * 4-tab pill bar (概覽 / 提醒 / 開銷 / 健康) — 1:1 with apps/web/src/components/
 * pets/pet-tabs.tsx: a single bg-alt pill (rounded-full, hairline border, p-1)
 * with a simple per-tab colour toggle (active = card bg + soft shadow + bold
 * ink; inactive = ink-2 semibold). Web uses a 200ms colour transition, not a
 * sliding indicator — so we toggle, not slide.
 */
import { StyleSheet, Pressable, Text, View } from "react-native";

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
    <View style={styles.bar}>
      {PET_TABS.map((key) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tPP(`tabs.${key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
