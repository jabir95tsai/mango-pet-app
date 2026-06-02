/**
 * 4-tab pill bar (概覽 / 提醒 / 開銷 / 健康) — hand-rolled, no react-native-
 * tab-view (D-tab decision: web is also a pill bar with no swipe). Active tab
 * gets a white card pill + shadow; inactive is muted text. Mirrors web
 * pet-tabs.
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
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.card,
    shadowColor: colors.paw,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink3 },
  labelActive: { color: colors.ink, fontWeight: "800" },
});
