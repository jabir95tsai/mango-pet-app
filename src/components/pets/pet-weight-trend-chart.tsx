"use client";

/**
 * SVG line chart for the 健康 tab weight trend card. Ports prototype
 * `HealthBody` chart block (line 898–911) — area fill + circle markers
 * on a leafDeep stroke. Hand-rolled (no charting library).
 *
 * Caller passes weight series points (descending by recency is fine,
 * we sort ascending). If < 2 points we render nothing — the caller
 * shows a "資料不足" placeholder instead.
 */
type Point = { date: number; kg: number };

type Props = {
  /** Weight readings; we only use the most recent 6. */
  points: Point[];
  /** Pixel height of the chart area (width fills 100%). Default 70. */
  height?: number;
};

const VIEW_W = 300;

export function PetWeightTrendChart({ points, height = 70 }: Props) {
  if (points.length < 2) return null;

  // Most recent 6 readings, ascending so the line goes left → right.
  const series = [...points]
    .sort((a, b) => a.date - b.date)
    .slice(-6);

  const kgs = series.map((p) => p.kg);
  const minKg = Math.min(...kgs);
  const maxKg = Math.max(...kgs);
  // Pad the range a touch so the line never grazes the top/bottom edge.
  const PAD = 6;
  const top = PAD;
  const bot = height - PAD;
  const range = maxKg - minKg;
  // If all points share the same weight, draw a flat line mid-height.
  const yFor = (kg: number) =>
    range === 0 ? height / 2 : bot - ((kg - minKg) / range) * (bot - top);

  // Evenly space x positions across the available width — 0..VIEW_W
  // because the SVG uses preserveAspectRatio="none" and stretches.
  const xFor = (i: number) =>
    series.length === 1 ? VIEW_W / 2 : (i / (series.length - 1)) * VIEW_W;

  const linePoints = series.map((p, i) => `${xFor(i)} ${yFor(p.kg).toFixed(2)}`);
  const linePath = `M ${linePoints.join(" L ")}`;
  const areaPath = `${linePath} L ${VIEW_W} ${height} L 0 ${height} Z`;

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="petWeightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e7f2dc" />
            <stop offset="100%" stopColor="#e7f2dc" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#petWeightFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#3f8a3a"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {series.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.kg)}
            r={2.4}
            fill="#ffffff"
            stroke="#3f8a3a"
            strokeWidth={1.6}
          />
        ))}
      </svg>
    </div>
  );
}
