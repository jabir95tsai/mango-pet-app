/**
 * Photo lightbox (P3b) — full-screen modal carousel. Horizontal swipe changes
 * photo (>50px commit), vertical drag-down dismisses (>100px) with a fading
 * backdrop. Mirrors apps/web/src/components/ui/photo-lightbox.tsx behaviour with
 * react-native-gesture-handler + reanimated. Respects reduce-motion (snaps
 * without spring). `onSave` is an optional hook wired by P3c (PhotosKit).
 */
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/theme";

const H_COMMIT = 50;
const V_CLOSE = 100;

export function PhotoLightbox({
  photos,
  initialIndex,
  open,
  onClose,
  onSave,
  saving,
}: {
  photos: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onSave?: (url: string, index: number) => void;
  saving?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [reduceMotion, setReduceMotion] = useState(false);

  const translateX = useSharedValue(-initialIndex * width);
  const translateY = useSharedValue(0);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      translateX.value = -initialIndex * width;
      translateY.value = 0;
      backdrop.value = 1;
    }
    // re-seed only when (re)opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIndex, width]);

  function settleTo(next: number) {
    setIndex(next);
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
      if (horizontal) {
        translateX.value = -index * width + e.translationX;
      } else if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdrop.value = Math.max(0.4, 1 - e.translationY / 400);
      }
    })
    .onEnd((e) => {
      const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
      if (horizontal) {
        let next = index;
        if (e.translationX < -H_COMMIT && index < photos.length - 1) next = index + 1;
        else if (e.translationX > H_COMMIT && index > 0) next = index - 1;
        const target = -next * width;
        translateX.value = reduceMotion
          ? withTiming(target, { duration: 0 })
          : withSpring(target, { damping: 22, stiffness: 220 });
        if (next !== index) runOnJS(settleTo)(next);
      } else if (e.translationY > V_CLOSE) {
        backdrop.value = withTiming(0, { duration: 160 });
        translateY.value = withTiming(e.translationY + 300, { duration: 160 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
        backdrop.value = withTiming(1, { duration: 160 });
      }
    });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          {onSave ? (
            <Pressable
              accessibilityLabel="儲存到相簿"
              onPress={() => onSave(photos[index], index)}
              disabled={saving}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Text style={styles.iconText}>{saving ? "…" : "⬇︎"}</Text>
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Pressable
            accessibilityLabel="關閉"
            onPress={onClose}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
        </View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.track, { width: width * photos.length }, trackStyle]}
          >
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={{ width, height: height * 0.7, justifyContent: "center" }}>
                <Image
                  source={{ uri }}
                  resizeMode="contain"
                  style={{ width, height: height * 0.7 }}
                  accessibilityIgnoresInvertColors
                />
              </View>
            ))}
          </Animated.View>
        </GestureDetector>

        {photos.length > 1 ? (
          <View style={styles.indicator}>
            <Text style={styles.counter}>
              {index + 1} / {photos.length}
            </Text>
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === index && styles.dotActive]}
                />
              ))}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  track: { flex: 1, flexDirection: "row", alignItems: "center" },
  indicator: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  counter: { color: "#fff", fontSize: 14, fontWeight: "700" },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { backgroundColor: "#fff", width: 9, height: 9, borderRadius: 5 },
  pressed: { opacity: 0.6 },
});
