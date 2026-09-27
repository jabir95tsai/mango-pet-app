/**
 * Segmented tabs — 1:1 with web ui/tabs.tsx: an INLINE pill group (hugs its
 * content, left-aligned — NOT full-width), bg-alt track (rounded-lg, p-1), h-8
 * segments (rounded-md, px-4, text-sm/medium). Active = card bg + brand-deep
 * text + soft shadow; inactive = ink-2. Generic over the option value.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/theme/theme";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
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
            hitSlop={6}
            style={[styles.seg, on && styles.segOn]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // inline-flex: hug content, left-aligned (not stretched full-width).
  track: {
    alignSelf: "flex-start",
    flexDirection: "row",
    backgroundColor: colors.bgAlt,
    borderRadius: radius.sm,
    padding: 4,
  },
  seg: {
    height: 32,
    borderRadius: radius.md - 6, // rounded-md ≈ 6
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  segOn: {
    backgroundColor: colors.card,
    shadowColor: "#50320a",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontSize: 14, fontWeight: "500", color: colors.ink2 },
  textOn: { color: colors.brandDeep },
});
