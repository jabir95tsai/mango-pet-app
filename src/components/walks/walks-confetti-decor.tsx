"use client";

/**
 * Top-of-page confetti decoration shown on the walks page when the
 * user has hit today's goal. Pure static decor — 9 colour-rotated
 * div pieces, NO animation (the celebratory confetti-fall animation
 * is reserved for the tracking-view done screen so the same surprise
 * isn't burned twice).
 *
 * Lives behind the page content (`-z-0`), only visible in the corners
 * around the dial; the page renders this once, conditionally, when
 * goalHit === true.
 *
 * a11y: pure decoration, `aria-hidden`.
 */
const PIECES: Array<{
  left: string;
  top: string;
  rot: string;
  color: string;
}> = [
  { left: "6%", top: "8%", rot: "-18deg", color: "#f39800" },
  { left: "18%", top: "22%", rot: "24deg", color: "#5fa858" },
  { left: "30%", top: "6%", rot: "8deg", color: "#ffb3ba" },
  { left: "48%", top: "18%", rot: "-12deg", color: "#ffc25c" },
  { left: "62%", top: "9%", rot: "30deg", color: "#f39800" },
  { left: "78%", top: "22%", rot: "-22deg", color: "#5fa858" },
  { left: "90%", top: "6%", rot: "12deg", color: "#d77b3f" },
  { left: "12%", top: "40%", rot: "18deg", color: "#ffc25c" },
  { left: "84%", top: "38%", rot: "-8deg", color: "#ffb3ba" },
];

export function WalksConfettiDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-0"
    >
      {PIECES.map((p, i) => (
        <div
          key={i}
          className="absolute h-3 w-1.5 rounded-[2px] opacity-85"
          style={{
            left: p.left,
            top: p.top,
            transform: `rotate(${p.rot})`,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
