/**
 * Pill segmented control — 1:1 with web `ui/tabs.tsx` (a simple colour-toggle,
 * NOT a sliding indicator): bg-alt track (rounded-lg, p-1), active segment =
 * card bg + brand-deep text + soft shadow, inactive = ink-2. Generic over the
 * option value. `compact` trims the height for the secondary period row.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme/theme";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  compact?: boolean;
}) {
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.seg, compact && styles.segCompact, on && styles.segOn]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segCompact: { minHeight: 36 },
  segOn: {
    backgroundColor: colors.card,
    shadowColor: "#50320a",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  textOn: { color: colors.brandDeep, fontWeight: "700" },
});
