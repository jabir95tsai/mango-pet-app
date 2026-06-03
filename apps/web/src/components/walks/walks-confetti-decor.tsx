"use client";

import { ConfettiCanvas } from "@/components/ui/confetti-canvas";

/**
 * Goal-hit celebration confetti for the walks page. Renders the user's
 * Claude Design "精緻紙片彩帶" (paper) effect via the shared canvas engine —
 * a top-edge curtain of paper that flutters + 3D card-flips as it falls.
 *
 * Trigger contract is unchanged: walks/page.tsx mounts this (inside
 * `{showConfetti && …}`) when today's goal is hit and unmounts it after 4s.
 * Mounting fires the burst; the canvas portals to <body> as a fixed,
 * pointer-events-none, aria-hidden overlay and self-cleans its rAF on
 * unmount. prefers-reduced-motion → a single static settled scatter (handled
 * inside ConfettiCanvas).
 */
export function WalksConfettiDecor() {
  return <ConfettiCanvas mode="paper" playToken={1} />;
}
