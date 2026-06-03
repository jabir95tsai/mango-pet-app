/**
 * Weight trend chart — hand-rolled react-native-svg area + line over the last
 * N weight points (default 6), mirroring web's hand-rolled SVG. Width is
 * measured via onLayout so it fills the card. S3 polish: gradient area fill,
 * faint top/baseline gridlines, min/max kg y-hints, and first/last date labels
 * on the x-axis. Guards:
 *  - <2 points → "需要 2 筆以上" message (no chart).
 *  - all weights equal → yScale would divide by zero; we pad the range so the
 *    line renders flat in the middle instead of NaN.
 */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import type { WeightPoint } from "@/lib/health-data";
import { scoped } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const tPP = scoped("PetsPage");

// 1:1 with apps/web/src/components/pets/pet-weight-trend-chart.tsx — a bare
// area+line+dots chart (leaf-deep stroke, leaf-tint fill, ~80px tall, no
// gridlines/axes/labels). The latest-kg + range head lives above it.
const HEIGHT = 80;
const PAD = 6;
const LEAF_DEEP = "#3f8a3a";

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

  const geom = useMemo(() => {
    if (data.length < 2 || width <= 0) return null;
    const kgs = data.map((p) => p.kg);
    const lo = Math.min(...kgs);
    const hi = Math.max(...kgs);
    const range = hi - lo;
    const top = PAD;
    const bot = HEIGHT - PAD;
    const n = data.length;
    const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
    const y = (kg: number) => (range === 0 ? HEIGHT / 2 : bot - ((kg - lo) / range) * (bot - top));
    const pts = data.map((p, i) => ({ x: x(i), y: y(p.kg) }));
    const line = `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`;
    const area = `${line} L ${width} ${HEIGHT} L 0 ${HEIGHT} Z`;
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
          <Defs>
            <LinearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#e7f2dc" stopOpacity={1} />
              <Stop offset="1" stopColor="#e7f2dc" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geom.area} fill="url(#weightArea)" />
          <Path
            d={geom.line}
            stroke={LEAF_DEEP}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {geom.pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#ffffff" stroke={LEAF_DEEP} strokeWidth={1.6} />
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
    marginBottom: 6,
  },
  latest: { fontSize: 20, fontWeight: "800", color: colors.ink },
  range: { fontSize: 11, color: colors.ink3 },
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyText: { fontSize: 12, color: colors.ink3, textAlign: "center" },
});
