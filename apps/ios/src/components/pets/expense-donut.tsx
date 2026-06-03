/**
 * Expense category donut — 1:1 with apps/web/src/components/pets/
 * pet-expense-donut.tsx: filled wedge arcs (1.2° gap between slices, largest at
 * 12 o'clock) with an 18px-thick ring, and a centred "本月合計 / NT$ {total}"
 * label drawn inside the SVG. Caller passes segments sorted descending.
 */
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Text as SvgText, TSpan } from "react-native-svg";
import type { ExpenseCategory } from "@mango/shared-types";

import { CATEGORY_COLOR } from "@/lib/expense-ui";
import { groupThousands } from "@/lib/format";
import { scoped } from "@/lib/i18n";

const tPP = scoped("PetsPage");

export type DonutSegment = { category: ExpenseCategory; amount: number };

const TAU = Math.PI * 2;
const GAP = (1.2 * Math.PI) / 180;

export function ExpenseDonut({
  segments,
  total,
  size = 128,
}: {
  segments: DonutSegment[];
  total: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const ir = r - 18;

  const arcs = useMemo(() => {
    const sweeps = segments.map((s) => (total > 0 ? (s.amount / total) * TAU : 0));
    const offsets: number[] = [];
    sweeps.reduce((sum, sw) => {
      offsets.push(sum);
      return sum + sw;
    }, -Math.PI / 2);
    return segments.map((s, i) => {
      const start = offsets[i];
      const a0 = start + GAP / 2;
      const a1 = start + sweeps[i] - GAP / 2;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const ix0 = cx + ir * Math.cos(a0);
      const iy0 = cy + ir * Math.sin(a0);
      const ix1 = cx + ir * Math.cos(a1);
      const iy1 = cy + ir * Math.sin(a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const d = [
        `M ${x0.toFixed(2)} ${y0.toFixed(2)}`,
        `A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
        `A ${ir} ${ir} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
        "Z",
      ].join(" ");
      return { category: s.category, d };
    });
  }, [segments, total, cx, cy, r, ir]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a) => (
          <Path key={a.category} d={a.d} fill={CATEGORY_COLOR[a.category]} />
        ))}
        <SvgText
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize={9.5}
          fontWeight="700"
          fill="#9a8a74"
        >
          {tPP("expenses.donutLabel")}
        </SvgText>
        <SvgText x={cx} y={cy + 13} textAnchor="middle" fontSize={17} fontWeight="800" fill="#231b14">
          <TSpan fontSize={9.5} fontWeight="600" fill="#9a8a74">{"NT$ "}</TSpan>
          <TSpan>{groupThousands(total)}</TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
