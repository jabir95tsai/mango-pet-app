"use client";

/**
 * Top-bar streak chip — gradient flame icon + day count. Shape ladders
 * across three states:
 *
 *   0-2 days  : muted ink-2 text, neutral surface — barely there
 *               (a 1-day "streak" doesn't earn celebration)
 *   3-6 days  : warm amber→brand-tint gradient + brand-deep text +
 *               flickering flame
 *   ≥7 days   : leaf gradient + leaf-deep text + flickering flame —
 *               the visual "you're on fire, kept it up a week" tier
 *
 * Flicker uses one `flame-flicker` keyframe scoped via a local <style>
 * tag (avoids polluting globals.css per spec). The keyframe is paused
 * under `prefers-reduced-motion`.
 *
 * a11y: the flame SVG is decorative (`aria-hidden`); the visible text
 * is what screen readers read.
 */
type Props = {
  streakDays: number;
  /** Localized label like "3 天" / "3d". Caller supplies. */
  label: string;
  /** Localized tooltip for the ≥7 day variant (optional). */
  weekTooltip?: string;
};

export function StreakChip({ streakDays, label, weekTooltip }: Props) {
  const tier =
    streakDays >= 7 ? "leaf" : streakDays >= 3 ? "brand" : "muted";

  if (tier === "muted") {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums text-mango-ink-2">
        {label}
      </span>
    );
  }

  return (
    <span
      title={tier === "leaf" ? weekTooltip : undefined}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-extrabold"
      style={{
        background:
          tier === "leaf"
            ? "linear-gradient(135deg, #e7f2dc 0%, #d8f2de 100%)"
            : "linear-gradient(135deg, #ffdca0 0%, #ffe7bf 100%)",
        color: tier === "leaf" ? "#3f8a3a" : "#d77b00",
        boxShadow:
          tier === "leaf"
            ? "0 4px 12px -4px rgba(63,138,58,0.40)"
            : "0 4px 12px -4px rgba(243,152,0,0.50)",
      }}
    >
      <style>{`
        .walks-streak-flame {
          animation: walks-streak-flame-flicker 1.1s ease-in-out infinite;
          transform-origin: 50% 90%;
        }
        @keyframes walks-streak-flame-flicker {
          0%, 100% { transform: scale(1) rotate(-2deg); }
          50% { transform: scale(1.12) rotate(3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .walks-streak-flame { animation: none !important; }
        }
      `}</style>
      <span
        aria-hidden="true"
        className="walks-streak-flame inline-flex"
        style={{ filter: "drop-shadow(0 1px 1px rgba(180,60,0,0.35))" }}
      >
        <svg width="16" height="18" viewBox="0 0 24 28" aria-hidden="true">
          <defs>
            <linearGradient
              id="walks-streak-flame-grad"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#ffd84a" />
              <stop offset="55%" stopColor="#ff8a1a" />
              <stop offset="100%" stopColor="#e63a1a" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C12 6 8 8 6 12c-2 4-2 9 2 12 1.5 1 3.5 1.7 4 1.7s2.5-.7 4-1.7c4-3 4-8 2-12-1-2-3-3-3-5 0 1.5-1 2.5-2 2.5C12 9.5 12 6 12 2z"
            fill="url(#walks-streak-flame-grad)"
          />
          <path
            d="M12 14c-1 1.5-2 3-2 5 0 2 1 3.5 2 3.5s2-1.5 2-3.5c0-2-1-3.5-2-5z"
            fill="#ffec8a"
            opacity="0.8"
          />
        </svg>
      </span>
      <span className="whitespace-nowrap tabular-nums">{label}</span>
    </span>
  );
}
