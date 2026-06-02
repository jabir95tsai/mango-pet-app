/**
 * Weight trend chart — hand-rolled react-native-svg area + line over the last
 * N weight points (default 6), mirroring web's hand-rolled SVG. Width is
 * measured via onLayout so it fills the card. Guards:
 *  - <2 points → "需要 2 筆以上" message (no chart).
 *  - all weights equal → yScale would divide by zero; we pad the range so the
 *    line renders flat in the middle instead of NaN.
 */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { WeightPoint } from "@/lib/health-data";
import { scoped } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const tPP = scoped("PetsPage");

const HEIGHT = 150;
const PAD_X = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 22;

export function WeightChart({
  points,
  max = 6,
}: {
  points: WeightPoint[];
  max?: number;
}) {
  const [width, setWidth] = useState(0);
  const data = useMemo(() => points.slice(-max), [points, max]);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  // All hooks run unconditionally (Rules of Hooks); geom is null when there's
  // not enough data or width isn't measured yet.
  const geom = useMemo(() => {
    if (data.length < 2 || width <= 0) return null;
    const kgs = data.map((p) => p.kg);
    let lo = Math.min(...kgs);
    let hi = Math.max(...kgs);
    if (hi - lo < 0.001) {
      // all (nearly) equal → pad so the divisor isn't zero; flat line centered.
      lo -= 1;
      hi += 1;
    }
    const plotW = Math.max(1, width - PAD_X * 2);
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const n = data.length;
    const x = (i: number) => PAD_X + (i / (n - 1)) * plotW;
    const y = (kg: number) => PAD_TOP + plotH * (1 - (kg - lo) / (hi - lo));
    const pts = data.map((p, i) => ({ x: x(i), y: y(p.kg), kg: p.kg }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area =
      `${line} L${pts[pts.length - 1].x},${HEIGHT - PAD_BOTTOM} ` +
      `L${pts[0].x},${HEIGHT - PAD_BOTTOM} Z`;
    return { pts, line, area };
  }, [data, width]);

  if (data.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {tPP("health.weightTrendInsufficient")}
        </Text>
      </View>
    );
  }

  const latest = data[data.length - 1].kg;

  return (
    <View onLayout={onLayout}>
      <View style={styles.head}>
        <Text style={styles.latest}>{`${latest} ${tPP("kgUnit")}`}</Text>
        <Text style={styles.range}>{tPP("health.weightTrendRange")}</Text>
      </View>
      {geom ? (
        <Svg width={width} height={HEIGHT}>
          <Path d={geom.area} fill={colors.brandTint} opacity={0.5} />
          <Path
            d={geom.line}
            stroke={colors.brand}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {geom.pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={colors.card}
              stroke={colors.brand}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  latest: { fontSize: 20, fontWeight: "800", color: colors.ink },
  range: { fontSize: 11, color: colors.ink3 },
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyText: { fontSize: 12, color: colors.ink3, textAlign: "center" },
});
