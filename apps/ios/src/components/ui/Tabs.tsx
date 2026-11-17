/**
 * Tabs — visuals 1:1 with web apps/web/src/components/ui/tabs.tsx. Motion:
 * the active pill is a draggable glass lens (ui/LensTrack) — the iOS-only
 * exception to the "simple toggle" rule in docs/design-system.md §4
 * (user 2026-10-11). Web stays a simple toggle.
 *
 *   track  `inline-flex rounded-lg bg-zinc-100 p-1`  → hugs content, left-
 *          aligned, bgAlt fill, pill radius (iOS §4), padding 4
 *   tab    `h-8 rounded-md px-4 text-sm font-medium` → 32 tall, pill radius,
 *          px 16, 14/500
 *   active `bg-white text-amber-700 shadow-sm`       → card fill + brandDeep
 *          text + soft shadow; inactive ink2
 *
 * size="sm" is a compact 28pt variant (px 12, 13pt); "lg" a 44pt full-tap variant (pets tabs); "icon" is an icon-only
 * 40pt variant (give items an empty label + accessibilityLabel). `fullWidth` stretches the
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
  size?: "sm" | "md" | "lg" | "icon";
  /** Stretch the track to the container and split segments evenly. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Warm-glass pill look (Home/Walks/Leaderboard redesign). */
  warm?: boolean;
};

const SIZES = {
  md: { height: 32, padX: 16, font: 14, icon: 16, slop: 6 },
  sm: { height: 28, padX: 12, font: 13, icon: 14, slop: 8 },
  lg: { height: 44, padX: 16, font: 13.5, icon: 16, slop: 0 },
  icon: { height: 40, padX: 10, font: 0, icon: 22, slop: 2 },
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
  warm = false,
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
      trackStyle={[styles.track, warm && styles.trackWarm, fullWidth && styles.trackFull, style]}
      itemStyle={() => [
        styles.seg,
        { height: s.height, paddingHorizontal: s.padX },
        fullWidth && styles.segFull,
        warm && styles.segWarm,
      ]}
      lensStyle={[styles.segOn, warm && styles.segWarm]}
      lensRadius={radius.pill}
      hitSlop={{ top: s.slop, bottom: s.slop, left: 2, right: 2 }}
      renderItem={(i, lit) => {
        const item = list[i];
        const Icon = item.icon;
        const fg = lit ? colors.brandDeep : colors.ink2;
        return (
          <>
            {Icon ? <Icon size={s.icon} color={fg} strokeWidth={2} /> : null}
            {item.label ? (
              <Text style={[styles.text, { fontSize: s.font, color: fg }, warm && lit && styles.textWarmOn]} numberOfLines={1}>
                {item.label}
              </Text>
            ) : null}
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
    borderRadius: radius.pill,
    padding: 4,
  },
  trackFull: { alignSelf: "stretch" },
  trackWarm: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: radius.pill,
  },
  segWarm: { borderRadius: radius.pill },
  textWarmOn: { fontWeight: "700" },
  seg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
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
