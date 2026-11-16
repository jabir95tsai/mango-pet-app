/**
 * usePressFeedback — design-system §4 press feedback (scale .97 + opacity dip)
 * animated on the UI thread, so it runs at the display rate (120Hz ProMotion)
 * instead of snapping on a JS re-render of Pressable's `pressed` style.
 *
 * Spread `handlers` onto an Animated Pressable and put `style` in its style
 * array. Reduce Motion (§5): no scale, only the opacity change.
 * `restOpacity` is the idle opacity (e.g. the disabled dim), since the animated
 * opacity overrides any static one.
 */
import { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "@/lib/use-reduced-motion";

const IN = { duration: 70 };
const OUT = { duration: 160 };

export function usePressFeedback({
  pressedOpacity = 1,
  reducedPressedOpacity = pressedOpacity,
  restOpacity = 1,
}: { pressedOpacity?: number; reducedPressedOpacity?: number; restOpacity?: number } = {}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const target = reduceMotion ? reducedPressedOpacity : pressedOpacity;

  const style = useAnimatedStyle(() => ({
    opacity: restOpacity + (target - restOpacity) * progress.value,
    transform: [{ scale: reduceMotion ? 1 : 1 - 0.03 * progress.value }],
  }));

  const handlers = {
    onPressIn: () => {
      progress.value = withTiming(1, IN);
    },
    onPressOut: () => {
      progress.value = withTiming(0, OUT);
    },
  };

  return { style, handlers, progress };
}
