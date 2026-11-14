/**
 * Tabs — visuals 1:1 with web apps/web/src/components/ui/tabs.tsx. Motion:
 * the active pill is a draggable glass lens (ui/LensTrack) — the iOS-only
 * exception to the "simple toggle" rule in docs/design-system.md §4
 * (user 2026-10-11). Web stays a simple toggle.
 *
 *   track  `inline-flex rounded-lg bg-zinc-100 p-1`  → hugs content, left-
 *          aligned, bgAlt fill, radius sm (8), padding 4
 *   tab    `h-8 rounded-md px-4 text-sm font-medium` → 32 tall, radius 6,
 *          px 16, 14/500
 *   active `bg-white text-amber-700 shadow-sm`       → card fill + brandDeep
 *          text + soft shadow; inactive ink2
 *
 * size="sm" is a compact 28pt variant (px 12, 13pt). `fullWidth` stretches the
 * track and splits it evenly. a11y: track = tablist, items = tab + selected;
 * each segment gets a hitSlop so the effective target reaches 44pt.
 *
 * `options` ({ value, label }) is accepted as an alias of `items` so the
 * leaderboard Segmented call sites can switch imports without other changes.
 */
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { LensTrack } from "@/components/ui/LensTrack";
import { colors, radius } from "@/theme/theme";

export type TabItem<K extends string = string> = {
  key: K;
  label: string;
  icon?: LucideIcon;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export type TabsProps<K extends string = string> = {
  items?: TabItem<K>[];
  /** Alias of `items` using web's `{ value, label }` option shape. */
  options?: { value: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  size?: "sm" | "md";
  /** Stretch the track to the container and split segments evenly. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  md: { height: 32, padX: 16, font: 14, icon: 16, slop: 6 },
  sm: { height: 28, padX: 12, font: 13, icon: 14, slop: 8 },
} as const;

export function Tabs<K extends string>({
  items,
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  accessibilityLabel,
  style,
}: TabsProps<K>) {
  const list: TabItem<K>[] =
    items ?? (options ?? []).map((o) => ({ key: o.value, label: o.label }));
  const s = SIZES[size];

  const selectedIndex = Math.max(0, list.findIndex((it) => it.key === value));

  return (
    <LensTrack
      accessibilityLabel={accessibilityLabel}
      items={list.map((it) => ({
        key: it.key,
        accessibilityLabel: it.accessibilityLabel ?? it.label,
        disabled: it.disabled,
      }))}
      selectedIndex={selectedIndex}
      onSelect={(i) => onChange(list[i].key)}
      trackStyle={[styles.track, fullWidth && styles.trackFull, style]}
      itemStyle={() => [
        styles.seg,
        { height: s.height, paddingHorizontal: s.padX },
        fullWidth && styles.segFull,
      ]}
      lensStyle={styles.segOn}
      lensRadius={6}
      hitSlop={{ top: s.slop, bottom: s.slop, left: 2, right: 2 }}
      renderItem={(i, lit) => {
        const item = list[i];
        const Icon = item.icon;
        const fg = lit ? colors.brandDeep : colors.ink2;
        return (
          <>
            {Icon ? <Icon size={s.icon} color={fg} strokeWidth={2} /> : null}
            <Text style={[styles.text, { fontSize: s.font, color: fg }]} numberOfLines={1}>
              {item.label}
            </Text>
          </>
        );
      }}
    />
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
  trackFull: { alignSelf: "stretch" },
  seg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 6, // web rounded-md
  },
  segFull: { flex: 1 },
  segOn: {
    backgroundColor: colors.card,
    shadowColor: colors.paw,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontWeight: "500" },
});
