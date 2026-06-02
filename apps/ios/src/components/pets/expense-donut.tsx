/**
 * Expense category donut — hand-rolled react-native-svg (D-charts: no heavy
 * chart lib, mirrors web's hand-rolled SVG). Segments are stroked arcs of a
 * single circle via strokeDasharray/offset, rotated so 0 starts at top. Center
 * shows the month total. Empty (total 0) → muted track ring only.
 */
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import type { ExpenseCategory } from "@mango/shared-types";

import { CATEGORY_COLOR } from "@/lib/expense-ui";
import { groupThousands } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const tPP = scoped("PetsPage");

export type DonutSegment = { category: ExpenseCategory; amount: number };

export function ExpenseDonut({
  segments,
  total,
  size = 168,
  strokeWidth = 22,
}: {
  segments: DonutSegment[];
  total: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let acc = 0;
    return segments
      .filter((s) => s.amount > 0)
      .map((s) => {
        const dash = (s.amount / total) * c;
        const arc = {
          category: s.category,
          dash,
          offset: -acc,
        };
        acc += dash;
        return arc;
      });
  }, [segments, total, c]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={center} originY={center}>
          {/* track */}
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={colors.hairline}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.5}
          />
          {arcs.map((a) => (
            <Circle
              key={a.category}
              cx={center}
              cy={center}
              r={r}
              stroke={CATEGORY_COLOR[a.category]}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.total}>{`$${groupThousands(total)}`}</Text>
        <Text style={styles.label}>{tPP("expenses.donutLabel")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center" },
  total: { fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  label: { fontSize: 11, color: colors.ink3, marginTop: 2 },
});
