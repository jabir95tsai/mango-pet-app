"use client";

import { Check } from "lucide-react";
import { WalksPetWalking } from "./walks-pet-walking";

/**
 * Radial progress dial — the hero of the walks page redesign. 232px
 * outer container, 96px radius ring with 14px stroke, animated
 * `stroke-dasharray` (600ms ease) drives the progress sweep.
 *
 * - Empty ring tint matches the brand/leaf family (`#f7e4c5` warm
 *   amber for incomplete, `#e7f2dc` leaf-tint for complete) so the
 *   ring background pre-stages the colour the fill will land on.
 * - Centre inset (28px) is a soft gradient disc that holds the walking
 *   dog avatar. When the goal is met, a leaf check badge appears
 *   bottom-right of the avatar with a thick `card` ring so it reads as
 *   a stickered milestone.
 * - Bottom numeric pill (`{done} / {goal} 分`) overlaps the ring so the
 *   tick at the top of the ring stays unobstructed.
 *
 * The transition on `stroke-dasharray` is preserved under
 * `prefers-reduced-motion` (per spec: progress easing isn't an
 * animation, it's UI feedback). Only the walking dog inside stops.
 */
type Props = {
  /** 0–100; values >100 cap the sweep but the pill still shows the
   *  real number ("45 / 30 分 ✓"). */
  percent: number;
  /** Drives ring colour swap + green check badge. */
  complete: boolean;
  doneMin: number;
  goalMin: number;
};

const R = 96;
const STROKE = 14;
const C = 2 * Math.PI * R;

export function WalksDial({ percent, complete, doneMin, goalMin }: Props) {
  const dash = C * Math.min(1, percent / 100);
  const ringColor = complete ? "#5fa858" : "#f39800";
  const bgRing = complete ? "#e7f2dc" : "#f7e4c5";

  return (
    <div className="relative mx-auto h-[232px] w-[232px]">
      {/* Outer celebration glow on complete */}
      {complete && (
        <div
          aria-hidden="true"
          className="absolute -inset-2.5 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(95,168,88,0.18) 0%, rgba(95,168,88,0) 65%)",
          }}
        />
      )}

      {/* Progress ring */}
      <svg
        width="232"
        height="232"
        viewBox="0 0 232 232"
        className="absolute inset-0 -rotate-90"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(doneMin)} / ${goalMin}`}
      >
        <circle
          cx="116"
          cy="116"
          r={R}
          fill="none"
          stroke={bgRing}
          strokeWidth={STROKE}
        />
        <circle
          cx="116"
          cy="116"
          r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        {/* Tick at top */}
        <circle
          cx="116"
          cy={116 - R}
          r="3"
          fill="#ffffff"
          stroke="#eadfc4"
          strokeWidth="1.5"
        />
      </svg>

      {/* Center disc with walking dog */}
      <div
        className="absolute inset-7 grid place-items-center overflow-hidden rounded-full"
        style={{
          background: complete
            ? "linear-gradient(180deg, #fff7e0 0%, #ffeec2 100%)"
            : "linear-gradient(180deg, #ffe9b8 0%, #ffcf75 100%)",
          boxShadow:
            "inset 0 -8px 20px rgba(120,70,0,0.10), inset 0 2px 6px rgba(255,255,255,0.6)",
        }}
      >
        <WalksPetWalking complete={complete} />
        {complete && (
          <div
            aria-hidden="true"
            className="absolute right-2 bottom-2 grid h-[38px] w-[38px] place-items-center rounded-full bg-mango-leaf text-white"
            style={{
              boxShadow:
                "0 6px 14px -4px rgba(63,138,58,0.55), 0 0 0 4px #ffffff",
            }}
          >
            <Check className="size-5" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Numeric pill overlapping the ring at the bottom */}
      <div className="absolute -bottom-1.5 left-0 right-0 text-center">
        <div
          className="inline-flex items-baseline gap-1 rounded-full border border-mango-hairline bg-mango-card px-3.5 py-1.5"
          style={{ boxShadow: "0 4px 10px -6px rgba(80,50,10,0.25)" }}
        >
          <span className="text-[22px] font-bold tabular-nums tracking-tight text-mango-ink">
            {Math.round(doneMin)}
          </span>
          <span className="text-xs font-semibold text-mango-ink-2">
            / {goalMin} 分
          </span>
        </div>
      </div>
    </div>
  );
}
