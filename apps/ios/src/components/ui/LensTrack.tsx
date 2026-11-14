/**
 * LensTrack — the in-content "pick one" track with the same glass-lens motion
 * as the bottom LiquidGlassTabBar (user 2026-10-11, docs/design-system.md §4
 * exception). Used by ui/Tabs (and leaderboard Segmented through it) and
 * pets/PetTabs; each caller keeps its own solid mango track + active pill look.
 *
 *  · At rest the selected segment sits on the caller's solid pill (`lensStyle`).
 *  · Touch down → the pill swells; on iOS 26 it turns into clear glass
 *    (GlassView), elsewhere a white-rimmed bubble. Labels under it magnify.
 *  · Horizontal drag → the lens follows the finger (stretching with speed) and
 *    lights the segment under it; release → springs onto that segment and
 *    selects it. A tap selects through the Pressable as before.
 *  · Vertical movement fails the pan, so a parent ScrollView still scrolls.
 *  · Reduce Motion: no swell / stretch / magnify / spring — the pill jumps.
 *
 * Segments may differ in width (inline tracks hug their labels), so the lens
 * animates both x and width from each segment's measured layout.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type Insets,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { LIQUID_GLASS } from "@/lib/liquid-glass";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Frame = { x: number; y: number; width: number; height: number };

export type LensTrackItem = {
  key: string;
  accessibilityLabel: string;
  disabled?: boolean;
};

export type LensTrackProps = {
  items: LensTrackItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Segment content; `lit` = selected, or under the lens while dragging. */
  renderItem: (index: number, lit: boolean) => ReactNode;
  /** The solid track (row direction is applied for you). */
  trackStyle?: StyleProp<ViewStyle>;
  /** Per-segment box (padding / height / flex). */
  itemStyle?: (index: number) => StyleProp<ViewStyle>;
  /** The resting active pill: background, shadow. */
  lensStyle?: StyleProp<ViewStyle>;
  lensRadius: number;
  hitSlop?: Insets;
  accessibilityLabel?: string;
};

const BULGE = 1.12;
const MAGNIFY = 0.12;
const SPRING = { damping: 15, stiffness: 200, mass: 0.7 } as const;

export function LensTrack({
  items,
  selectedIndex,
  onSelect,
  renderItem,
  trackStyle,
  itemStyle,
  lensStyle,
  lensRadius,
  hitSlop,
  accessibilityLabel,
}: LensTrackProps) {
  const reduceMotion = useReducedMotion();
  const [frames, setFrames] = useState<(Frame | undefined)[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const framesSV = useSharedValue<Frame[]>([]);
  const lensX = useSharedValue(0);
  const lensW = useSharedValue(0);
  const ready = useSharedValue(0);
  const pressed = useSharedValue(0);
  const stretch = useSharedValue(0);
  const dragging = useSharedValue(false);

  const onItemLayout = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout;
      setFrames((prev) => {
        const next = prev.slice(0, items.length);
        next[index] = { x, y, width, height };
        return next;
      });
    },
    [items.length],
  );

  const allMeasured = items.length > 0 && items.every((_, i) => frames[i]);
  const sel = allMeasured ? frames[selectedIndex] : undefined;

  useEffect(() => {
    if (allMeasured) framesSV.value = frames as Frame[];
  }, [allMeasured, frames, framesSV]);

  // Follow the selection (taps, programmatic changes, re-layout).
  useEffect(() => {
    if (!sel || dragging.value) return;
    const first = ready.value === 0;
    ready.value = 1;
    if (reduceMotion || first) {
      lensX.value = sel.x;
      lensW.value = sel.width;
    } else {
      lensX.value = withSpring(sel.x, SPRING);
      lensW.value = withSpring(sel.width, SPRING);
    }
  }, [sel, reduceMotion, dragging, ready, lensX, lensW]);

  const disabledMask = items.map((it) => !!it.disabled);

  const indexAt = (centerX: number) => {
    "worklet";
    const fs = framesSV.value;
    let best = -1;
    let bestD = Number.MAX_VALUE;
    for (let i = 0; i < fs.length; i++) {
      if (disabledMask[i]) continue;
      const d = Math.abs(fs[i].x + fs[i].width / 2 - centerX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const select = useCallback(
    (index: number) => {
      if (index >= 0 && index !== selectedIndex) onSelect(index);
    },
    [onSelect, selectedIndex],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      if (!reduceMotion) pressed.value = withSpring(1, SPRING);
    })
    .onStart(() => {
      dragging.value = true;
    })
    .onUpdate((e) => {
      const fs = framesSV.value;
      if (fs.length === 0) return;
      const minX = fs[0].x;
      const last = fs[fs.length - 1];
      const w = lensW.value;
      lensX.value = Math.min(last.x + last.width - w, Math.max(minX, e.x - w / 2));
      if (!reduceMotion) stretch.value = Math.min(Math.abs(e.velocityX) / 3500, 0.2);
    })
    .onFinalize((e, success) => {
      const wasDragging = dragging.value;
      dragging.value = false;
      if (reduceMotion) {
        pressed.value = 0;
        stretch.value = 0;
      } else {
        pressed.value = withSpring(0, SPRING);
        stretch.value = withTiming(0, { duration: 160 });
      }
      runOnJS(setHoverIdx)(null);
      if (!wasDragging) return; // a tap: the Pressable selects
      const index = success ? indexAt(e.x) : selectedIndex;
      const f = framesSV.value[index];
      if (f) {
        lensX.value = reduceMotion ? f.x : withSpring(f.x, SPRING);
        lensW.value = reduceMotion ? f.width : withSpring(f.width, SPRING);
      }
      if (success) runOnJS(select)(index);
    });

  useAnimatedReaction(
    () => (dragging.value ? indexAt(lensX.value + lensW.value / 2) : -1),
    (now, prev) => {
      if (now !== prev && now >= 0) runOnJS(setHoverIdx)(now);
    },
  );

  const lensAnim = useAnimatedStyle(() => {
    const p = pressed.value;
    const s = stretch.value;
    return {
      opacity: ready.value,
      width: lensW.value,
      transform: [
        { translateX: lensX.value },
        { scaleX: 1 + (BULGE * 1.03 - 1) * p + s },
        { scaleY: 1 + (BULGE - 1) * p - s * 0.5 },
      ],
    };
  });
  const restAnim = useAnimatedStyle(() => ({ opacity: 1 - pressed.value }));
  const glassAnim = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const litIndex = hoverIdx ?? selectedIndex;
  const radiusStyle = { borderRadius: lensRadius };

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={pan}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={accessibilityLabel}
          style={[trackStyle, styles.row]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lens,
              radiusStyle,
              { top: sel?.y ?? 0, height: sel?.height ?? 0 },
              lensAnim,
            ]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, radiusStyle, lensStyle, restAnim]} />
            <Animated.View style={[StyleSheet.absoluteFill, radiusStyle, glassAnim]}>
              {LIQUID_GLASS ? (
                <GlassView
                  glassEffectStyle="clear"
                  colorScheme="light"
                  style={[StyleSheet.absoluteFill, radiusStyle]}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, radiusStyle, styles.bubbleFallback]} />
              )}
              <View style={[StyleSheet.absoluteFill, radiusStyle, styles.rim]} />
            </Animated.View>
          </Animated.View>

          {items.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ selected: index === selectedIndex, disabled: !!item.disabled }}
              disabled={item.disabled}
              onPress={() => select(index)}
              onLayout={onItemLayout(index)}
              hitSlop={hitSlop}
              style={[itemStyle?.(index), item.disabled && styles.disabled]}
            >
              <Magnified index={index} framesSV={framesSV} lensX={lensX} lensW={lensW} pressed={pressed}>
                {renderItem(index, litIndex === index)}
              </Magnified>
            </Pressable>
          ))}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function Magnified({
  index,
  framesSV,
  lensX,
  lensW,
  pressed,
  children,
}: {
  index: number;
  framesSV: SharedValue<Frame[]>;
  lensX: SharedValue<number>;
  lensW: SharedValue<number>;
  pressed: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const f = framesSV.value[index];
    if (!f) return { transform: [{ scale: 1 }] };
    const d = Math.abs(lensX.value + lensW.value / 2 - (f.x + f.width / 2));
    const near = Math.max(0, 1 - d / Math.max(f.width, 1));
    return { transform: [{ scale: 1 + MAGNIFY * near * pressed.value }] };
  });
  return <Animated.View style={[styles.content, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 0 },
  row: { flexDirection: "row" },
  lens: { position: "absolute", left: 0 },
  bubbleFallback: { backgroundColor: "rgba(255,255,255,0.55)" },
  rim: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#78480a",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  disabled: { opacity: 0.5 },
});
