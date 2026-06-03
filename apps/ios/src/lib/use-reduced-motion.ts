/**
 * useReducedMotion — single source for the OS "Reduce Motion" preference.
 *
 * Before this hook, four components (photo-lightbox, pet-story-avatar,
 * leaderboard-row, walk-confetti) each open-coded the same
 * `AccessibilityInfo.isReduceMotionEnabled()` one-shot read. This consolidates
 * that into one hook AND adds a live subscription, so a mid-session toggle in
 * iOS Settings is honoured without an app restart.
 *
 * Every animation in the app (dial arc, walking dog, glow, confetti, sheet
 * transitions) should gate on this — when it returns true, render the static /
 * final frame instead of animating. UX-0 a11y baseline.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (active) setReduced(v);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => {
        if (active) setReduced(v);
      },
    );

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
