"use client";

/**
 * SVG donut chart for the 開銷 tab — hand-rolled to avoid pulling in a
 * chart library. Ports prototype `ExpenseDonut` (line 753–798) 1:1
 * including the tiny gap between slices and the center "本月合計
 * NT$ X" label.
 *
 * Slices: caller passes sorted descending so the largest slice anchors
 * at 12 o'clock and reads counterclockwise.
 */
type Slice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: Slice[];
  total: number;
  size?: number;
  monthTotalLabel: string;
};

const TAU = Math.PI * 2;
const GAP = (1.2 * Math.PI) / 180; // 1.2° gap between slices

export function PetExpenseDonut({
  slices,
  total,
  size = 128,
  monthTotalLabel,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const ir = r - 18;

  // Precompute angle offsets so the slice loop is pure — start at 12
  // o'clock and sum sweeps cumulatively. Avoids reassigning a render-
  // scope variable, which the react-hooks lint rule flags.
  const sweeps = slices.map((s) =>
    total > 0 ? (s.value / total) * TAU : 0,
  );
  const offsets: number[] = [];
  sweeps.reduce((sum, sw) => {
    offsets.push(sum);
    return sum + sw;
  }, -Math.PI / 2);

  const arcs = slices.map((s, i) => {
    const start = offsets[i];
    const sweep = sweeps[i];
    const a0 = start + GAP / 2;
    const a1 = start + sweep - GAP / 2;
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
    return { ...s, d };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color} />
      ))}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          fill: "#9a8a74",
          letterSpacing: 0.5,
        }}
      >
        {monthTotalLabel}
      </text>
      <text
        x={cx}
        y={cy + 13}
        textAnchor="middle"
        style={{
          fontSize: 17,
          fontWeight: 800,
          fill: "#231b14",
          letterSpacing: "-0.4px",
        }}
      >
        <tspan style={{ fontSize: 9.5, fontWeight: 600, fill: "#9a8a74" }}>
          NT${" "}
        </tspan>
        {total.toLocaleString()}
      </text>
    </svg>
  );
}
