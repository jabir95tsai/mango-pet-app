"use client";

/**
 * Walking dog avatar — sits in the centre of the radial dial on the
 * walks page. Pure SVG + 5 CSS keyframes, scoped to a `walks-pet-walking`
 * class prefix so the keyframes don't pollute globals.css.
 *
 * Spec docs/features/walks-v2-rebuild.md: the cartoon dog (not the user's
 * own pet photo) is intentional — user explicitly accepted retracting
 * Q11's "no wiggling" for this dial-bound illustration. `complete=true`
 * relaxes the pace, swaps the eye for a happy curve, opens the mouth,
 * and sticks out the tongue.
 *
 * Reduced motion: ALL animations stop (the 5 wd-* + the wd-body parent).
 * The dog still renders, just static. The `transform-box: fill-box` on
 * legs/tail keeps them rotating around their own anchor instead of the
 * SVG origin.
 */
type Props = {
  complete: boolean;
};

export function WalksPetWalking({ complete }: Props) {
  // Relax the gait when the goal is met — slower duration reads as
  // "happy stroll" rather than the urgent stride of incomplete mode.
  const dur = complete ? "0.9s" : "0.45s";

  return (
    <div className="relative h-[65px] w-[85px]">
      <style>{`
        .walks-pet-walking-body {
          animation: wd-bob ${dur} ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        .walks-pet-walking-leg {
          transform-box: fill-box;
          transform-origin: 50% 0%;
          animation-duration: ${dur};
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .walks-pet-walking-leg.a { animation-name: wd-swingA; }
        .walks-pet-walking-leg.b { animation-name: wd-swingB; }
        .walks-pet-walking-tail {
          transform-box: fill-box;
          transform-origin: 95% 90%;
          animation: wd-wag 0.36s ease-in-out infinite;
        }
        .walks-pet-walking-ground {
          animation: wd-ground ${dur} linear infinite;
        }
        @keyframes wd-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes wd-swingA {
          0%, 100% { transform: rotate(18deg); }
          50% { transform: rotate(-18deg); }
        }
        @keyframes wd-swingB {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes wd-wag {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(22deg); }
        }
        @keyframes wd-ground {
          0% { transform: translateX(0); }
          100% { transform: translateX(-24px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .walks-pet-walking-body,
          .walks-pet-walking-leg,
          .walks-pet-walking-tail,
          .walks-pet-walking-ground {
            animation: none !important;
          }
        }
      `}</style>
      <svg
        width="85"
        height="65"
        viewBox="0 0 200 140"
        className="block"
        aria-hidden="true"
      >
        {/* Moving ground dots — sense of motion */}
        <g className="walks-pet-walking-ground">
          {[-10, 20, 50, 80, 110, 140, 170, 200, 230].map((x) => (
            <circle key={x} cx={x} cy="128" r="1.6" fill="#c9b27f" opacity="0.55" />
          ))}
        </g>
        {/* Contact shadow */}
        <ellipse cx="100" cy="126" rx="56" ry="4" fill="#000" opacity="0.08" />

        <g className="walks-pet-walking-body">
          {/* Far-side back leg (darker) */}
          <rect
            className="walks-pet-walking-leg b"
            x="58"
            y="82"
            width="9"
            height="32"
            rx="3"
            fill="#b4773a"
          />
          {/* Near-side back leg */}
          <rect
            className="walks-pet-walking-leg a"
            x="48"
            y="82"
            width="9"
            height="32"
            rx="3"
            fill="#d99258"
          />

          {/* Tail */}
          <path
            className="walks-pet-walking-tail"
            d="M52 64 Q34 50 44 28 Q54 42 62 60 Z"
            fill="#d99258"
          />

          {/* Body */}
          <ellipse cx="100" cy="72" rx="52" ry="22" fill="#e8a85a" />
          {/* Belly highlight */}
          <ellipse cx="100" cy="84" rx="40" ry="8" fill="#fff5d8" opacity="0.7" />

          {/* Head */}
          <circle cx="150" cy="56" r="22" fill="#e8a85a" />
          {/* Ear (perked) */}
          <path d="M156 36 L170 28 L165 52 Z" fill="#b4773a" />
          {/* Snout / muzzle */}
          <ellipse cx="170" cy="64" rx="14" ry="9" fill="#fff5d8" />
          {/* Nose */}
          <ellipse cx="180" cy="61" rx="3.2" ry="2.6" fill="#231b14" />
          {/* Eye — closes into a happy arc when goal complete */}
          {complete ? (
            <path
              d="M150 52 Q154 49 158 52"
              stroke="#231b14"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <circle cx="154" cy="52" r="2.2" fill="#231b14" />
          )}
          {/* Mouth — open smile when complete, neutral otherwise */}
          <path
            d={complete ? "M167 70 Q172 76 178 70" : "M170 70 Q173 72 178 70"}
            stroke="#231b14"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          {/* Tongue when happy */}
          {complete && (
            <ellipse cx="173" cy="73" rx="3.5" ry="2.2" fill="#ff8e8e" />
          )}
          {/* Cheek */}
          <circle cx="142" cy="68" r="3" fill="#ffb3ba" opacity="0.55" />

          {/* Far-side front leg */}
          <rect
            className="walks-pet-walking-leg b"
            x="138"
            y="86"
            width="9"
            height="32"
            rx="3"
            fill="#b4773a"
          />
          {/* Near-side front leg */}
          <rect
            className="walks-pet-walking-leg a"
            x="128"
            y="86"
            width="9"
            height="32"
            rx="3"
            fill="#d99258"
          />
        </g>
      </svg>
    </div>
  );
}
