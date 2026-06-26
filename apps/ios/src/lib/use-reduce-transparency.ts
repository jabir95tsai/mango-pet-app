/**
 * useReduceTransparency — the OS "Reduce Transparency" accessibility setting.
 *
 * HARD a11y requirement for the Apple Glass system: when this returns true,
 * every glass surface must drop the BlurView entirely and render an opaque warm
 * mango panel instead (the GlassSurface primitive does this). Keeps contrast for
 * users who can't read text over translucency. Live-subscribed so a mid-session
 * Settings toggle is honoured. Sibling of useReducedMotion.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;

    // isReduceTransparencyEnabled is iOS-only; guard for platforms without it.
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => {
        if (active) setReduce(v);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      (v) => {
        if (active) setReduce(v);
      },
    );

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
