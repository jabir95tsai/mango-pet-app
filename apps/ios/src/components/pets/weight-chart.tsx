/**
 * Weight trend chart — 1:1 with apps/web/src/components/pets/
 * pet-weight-trend-chart.tsx: a bare area + line + dot chart (leaf-deep
 * stroke, leaf-tint gradient fill, default 70pt tall, no axes / labels) over
 * the most recent 6 weight readings. Width is measured via onLayout so it fills
 * the card (web stretches a 300-wide viewBox; measuring keeps the dots round).
 *
 * Pure chart: renders nothing for < 2 points — the caller (PetHealthBody)
 * owns the card header, the "資料不足" placeholder and the current/delta
 * footer, like web's PetHealthBody. All-equal weights draw a flat mid line.
 */
import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import type { WeightPoint } from "@/lib/health-data";
import { LEAF_DEEP } from "@/lib/expense-ui";
import { colors } from "@/theme/theme";

const PAD = 6;

export function WeightChart({
  points,
  max = 6,
  height = 70,
}: {
  points: WeightPoint[];
  /** Most recent N readings to plot (web: 6). */
  max?: number;
  /** Pixel height of the chart area (web default 70). */
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  // Most recent N readings, ascending so the line goes left → right.
  const data = useMemo(
    () => [...points].sort((a, b) => a.date - b.date).slice(-max),
    [points, max],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const geom = useMemo(() => {
    if (data.length < 2 || width <= 0) return null;
    const kgs = data.map((p) => p.kg);
    const lo = Math.min(...kgs);
    const hi = Math.max(...kgs);
    const range = hi - lo;
    const top = PAD;
    const bot = height - PAD;
    const n = data.length;
    const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
    const y = (kg: number) =>
      range === 0 ? height / 2 : bot - ((kg - lo) / range) * (bot - top);
    const pts = data.map((p, i) => ({ x: x(i), y: y(p.kg) }));
    const line = `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`;
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;
    return { pts, line, area };
  }, [data, width, height]);

  if (data.length < 2) return null;

  return (
    <View
      onLayout={onLayout}
      style={{ height }}
      // Decorative (web aria-hidden); the card footer states the numbers.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {geom ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="petWeightFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.leafTint} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.leafTint} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geom.area} fill="url(#petWeightFill)" />
          <Path
            d={geom.line}
            stroke={LEAF_DEEP}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {geom.pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2.4}
              fill={colors.card}
              stroke={LEAF_DEEP}
              strokeWidth={1.6}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
