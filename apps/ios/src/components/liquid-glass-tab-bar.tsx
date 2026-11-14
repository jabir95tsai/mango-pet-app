// iOS 26+ floating Liquid Glass tab bar with a draggable glass "lens"
// (LINE / iOS 26 system tab bar feel). Rendered by RaisedTabBar when
// LIQUID_GLASS; iOS < 26 keeps the notched bar there.
//
//  · 5 equal tabs (icon 24 + 10px label) in a floating glass capsule.
//  · At rest the selected tab sits on a soft brand-tint pill.
//  · Touch down → the pill swells into a clear glass bubble that pokes out of
//    the capsule; drag → it follows the finger, stretches with speed (jelly)
//    and magnifies the icons it passes over; release → springs onto the
//    nearest tab and navigates. A plain tap does the same in one motion.
//  · Reduce Motion: no swell / stretch / magnify / spring — the pill just
//    jumps to the tab (design-system §6 hard rule).
//
// a11y: same tablist / tab / selected semantics as the classic bar. Touch is
// handled by the pan gesture; VoiceOver activation still goes through each
// Pressable's onPress. Design: claude.ai canvas "Floating Tab Bar" (2026-10-11),
// docs/features/ios-liquid-glass.md.
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { Footprints, Home, PawPrint, Settings, Trophy, type LucideIcon } from "lucide-react-native";

import { GLASS_BAR_H, GLASS_LENS_BULGE, glassBarBottomGap } from "@/lib/liquid-glass";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors } from "@/theme/theme";
import { tabLabel, type TabBarProps } from "@/components/raised-tab-bar";

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  pets: PawPrint,
  walks: Footprints,
  leaderboard: Trophy,
  settings: Settings,
};

const SIDE_INSET = 16;
const MAX_BAR_WIDTH = 430;
const PAD = 6;
const LENS_H = GLASS_BAR_H - PAD * 2;
// Pressed lens scale. Its vertical overshoot ((LENS_H * BULGE - LENS_H) / 2
// ≈ 8pt) is the headroom GLASS_LENS_BULGE reserves above the capsule.
const BULGE = 1.3;
const MAGNIFY = 0.24;
const SPRING = { damping: 14, stiffness: 180, mass: 0.8 } as const;

export function LiquidGlassTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const capsuleW = Math.min(windowWidth, MAX_BAR_WIDTH) - SIDE_INSET * 2;
  const count = state.routes.length;
  const slot = (capsuleW - PAD * 2) / count;
  const maxX = PAD + (count - 1) * slot;
  const restX = PAD + state.index * slot;

  const lensX = useSharedValue(restX);
  const pressed = useSharedValue(0); // 0 rest → 1 glass bubble
  const stretch = useSharedValue(0); // 0..0.28 from drag velocity
  const dragging = useSharedValue(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Follow the focused tab (navigation, deep links, resize) when not touched.
  useEffect(() => {
    if (dragging.value) return;
    lensX.value = reduceMotion ? restX : withSpring(restX, SPRING);
  }, [restX, reduceMotion, dragging, lensX]);

  const go = useCallback(
    (index: number) => {
      const route = state.routes[index];
      if (!route) return;
      const focused = state.index === index;
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    },
    [navigation, state.index, state.routes],
  );

  const clampX = (fingerX: number) => {
    "worklet";
    return Math.min(maxX, Math.max(PAD, fingerX - slot / 2));
  };
  const indexAt = (x: number) => {
    "worklet";
    return Math.min(count - 1, Math.max(0, Math.round((x - PAD) / slot)));
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      dragging.value = true;
      const x = clampX(e.x);
      if (reduceMotion) {
        lensX.value = x;
      } else {
        lensX.value = withSpring(x, SPRING);
        pressed.value = withSpring(1, SPRING);
      }
    })
    .onUpdate((e) => {
      lensX.value = clampX(e.x);
      if (!reduceMotion) stretch.value = Math.min(Math.abs(e.velocityX) / 3000, 0.28);
    })
    .onFinalize((_e, success) => {
      const index = indexAt(lensX.value);
      const target = PAD + index * slot;
      dragging.value = false;
      if (reduceMotion) {
        lensX.value = target;
        pressed.value = 0;
        stretch.value = 0;
      } else {
        lensX.value = withSpring(target, SPRING);
        pressed.value = withSpring(0, SPRING);
        stretch.value = withTiming(0, { duration: 180 });
      }
      runOnJS(setHoverIdx)(null);
      if (success) runOnJS(go)(index);
    });

  // Light up whichever tab the lens is over while dragging (JS only on change).
  useAnimatedReaction(
    () => (dragging.value ? indexAt(lensX.value) : -1),
    (now, prev) => {
      if (now !== prev && now >= 0) runOnJS(setHoverIdx)(now);
    },
  );

  const lensStyle = useAnimatedStyle(() => {
    const p = pressed.value;
    const s = stretch.value;
    return {
      transform: [
        { translateX: lensX.value },
        { scaleX: 1 + (BULGE * 1.04 - 1) * p + s },
        { scaleY: 1 + (BULGE - 1) * p - s * 0.55 },
      ],
    };
  });
  // Rest tint fades out as the lens turns into clear glass.
  const tintStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value }));
  const rimStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const litIndex = hoverIdx ?? state.index;
  const gap = glassBarBottomGap(insets.bottom);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { height: gap + GLASS_BAR_H + GLASS_LENS_BULGE }]}>
      <GestureHandlerRootView
        style={[styles.frame, { width: capsuleW, bottom: gap, left: (windowWidth - capsuleW) / 2 }]}
      >
        <GlassView glassEffectStyle="regular" colorScheme="light" style={styles.capsule} pointerEvents="none" />

        <Animated.View pointerEvents="none" style={[styles.lens, { width: slot }, lensStyle]}>
          <GlassView glassEffectStyle="clear" colorScheme="light" style={styles.lensFill} />
          <Animated.View style={[styles.lensFill, styles.lensTint, tintStyle]} />
          <Animated.View style={[styles.lensFill, styles.lensRim, rimStyle]} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <View accessibilityRole="tablist" style={styles.row}>
            {state.routes.map((route, index) => (
              <Tab
                key={route.key}
                label={tabLabel(route.name)}
                Icon={ICONS[route.name]}
                selected={state.index === index}
                lit={litIndex === index}
                center={PAD + slot * (index + 0.5)}
                slot={slot}
                lensX={lensX}
                pressed={pressed}
                onPress={() => go(index)}
              />
            ))}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}

function Tab({
  label,
  Icon,
  selected,
  lit,
  center,
  slot,
  lensX,
  pressed,
  onPress,
}: {
  label: string;
  Icon: LucideIcon | undefined;
  selected: boolean;
  lit: boolean;
  center: number;
  slot: number;
  lensX: SharedValue<number>;
  pressed: SharedValue<number>;
  onPress: () => void;
}) {
  // Magnify by distance from the lens centre while the lens is swollen.
  const magStyle = useAnimatedStyle(() => {
    const d = Math.abs(lensX.value + slot / 2 - center);
    const near = Math.max(0, 1 - d / (slot * 0.9));
    return { transform: [{ scale: 1 + MAGNIFY * near * pressed.value }] };
  });
  const color = lit ? colors.brandDeep : colors.ink2;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, magStyle]}>
        {Icon ? <Icon size={24} color={color} strokeWidth={lit ? 2.25 : 2} /> : null}
        <Text style={[styles.label, lit && styles.labelLit]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  frame: { position: "absolute", height: GLASS_BAR_H, overflow: "visible" },
  capsule: { ...StyleSheet.absoluteFill, borderRadius: GLASS_BAR_H / 2 },
  lens: {
    position: "absolute",
    top: PAD,
    left: 0,
    height: LENS_H,
    borderRadius: LENS_H / 2,
    shadowColor: "#78480a",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  lensFill: { ...StyleSheet.absoluteFill, borderRadius: LENS_H / 2 },
  lensTint: { backgroundColor: colors.brandTint },
  lensRim: { borderWidth: 1, borderColor: "rgba(255,255,255,0.95)" },
  row: { ...StyleSheet.absoluteFill, flexDirection: "row", paddingHorizontal: PAD },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabInner: { alignItems: "center", gap: 3 },
  label: { fontSize: 10, lineHeight: 12, fontWeight: "500", color: colors.ink2 },
  labelLit: { fontWeight: "700", color: colors.brandDeep },
});
