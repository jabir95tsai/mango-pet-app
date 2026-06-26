/**
 * Seven-day strip — 1:1 with apps/web/src/components/walks/walks-week-strip.tsx.
 * Card container (rounded-2xl, hairline, shadow-card). Per day a 34px circle:
 *   done       → solid brand fill, white paw
 *   done+today → solid leaf fill, white paw, leaf-tint halo ring
 *   today      → brand-tint fill, dashed brand border, brand dot
 *   other      → dashed hairline border, empty
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";

import { GlassCard } from "@/components/ui/GlassCard";
import { colors, spacing } from "@/theme/theme";

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function Paw({ size = 16, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Ellipse cx={6.5} cy={9} rx={1.8} ry={2.3} />
      <Ellipse cx={17.5} cy={9} rx={1.8} ry={2.3} />
      <Ellipse cx={9.5} cy={5.5} rx={1.6} ry={2.1} />
      <Ellipse cx={14.5} cy={5.5} rx={1.6} ry={2.1} />
      <Path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
    </Svg>
  );
}

type Props = {
  days: boolean[]; // length 7, Monday-first
  todayIdx: number;
  complete: boolean;
};

export function WalksWeekStrip({ days, todayIdx, complete }: Props) {
  return (
    <GlassCard level="regular" padded={false} contentStyle={styles.card}>
      {days.map((done, i) => {
        const isToday = i === todayIdx;
        const todayDone = isToday && complete;
        return (
          <View key={i} style={styles.col}>
            <Text style={[styles.label, isToday && styles.labelToday]}>
              {DAY_LABELS[i]}
            </Text>
            <View
              style={[
                styles.dot,
                done
                  ? todayDone
                    ? styles.dotLeaf
                    : styles.dotBrand
                  : isToday
                    ? styles.dotToday
                    : styles.dotEmpty,
                todayDone && styles.halo,
              ]}
            >
              {done ? (
                <Paw size={16} />
              ) : isToday ? (
                <View style={styles.todayDot} />
              ) : null}
            </View>
          </View>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  // GlassCard provides the surface; this is just the inner day-row layout.
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  col: { alignItems: "center", gap: 6, flex: 1 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: colors.ink3 },
  labelToday: { color: colors.brandDeep },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dotBrand: { backgroundColor: colors.brand },
  dotLeaf: { backgroundColor: colors.leaf },
  dotToday: {
    backgroundColor: colors.brandTint,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderStyle: "dashed",
  },
  dotEmpty: {
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderStyle: "dashed",
  },
  halo: {
    shadowColor: "#5fa858",
    shadowOpacity: 0,
    // leaf-tint halo ring (web: box-shadow 0 0 0 3px #e7f2dc)
    borderWidth: 3,
    borderColor: colors.leafTint,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
});
