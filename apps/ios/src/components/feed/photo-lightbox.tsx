/**
 * Photo lightbox — full-screen carousel, 1:1 with web apps/web/src/components/
 * ui/photo-lightbox.tsx:
 *
 *  - black/90 overlay; photos `contain`-fit inside a 16pt inset, one per
 *    screen width on a horizontal track
 *  - horizontal swipe (> 50px) changes photo; the axis locks after 8px like web
 *  - vertical drag-down follows the finger, fades the overlay (to 0.5 over
 *    400px) and closes past 100px
 *  - tapping the dark area around the photo closes (web backdrop click); the
 *    X (top-right) closes too
 *  - multi-photo: counter (PhotoLightbox.counter, 12/500 at 80%) and tappable
 *    dots (8pt; active = 20pt mango pill)
 *  - Reduce Motion: no fade-in, no snap / close animations (instant)
 *  - VoiceOver: escape gesture closes; the photo area is "adjustable"
 *    (swipe up/down = next/previous)
 *
 * `onSave` (iOS extra — PhotosKit save, top-left Download button like web's
 * downloadAction) may return a Promise; the lightbox owns the busy state so
 * repeated taps can't start duplicate saves. `saving` is still honoured for
 * callers that track it themselves.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from "react-native";
import { Download, X } from "lucide-react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors } from "@/theme/theme";

/** Beyond this horizontal travel on release, snap to the neighbour. */
const SWIPE_H_THRESHOLD = 50;
/** Beyond this downward travel on release, close. */
const SWIPE_V_CLOSE_THRESHOLD = 100;
/** Axis dead zone (web commits the axis after 8px). */
const AXIS_DEAD_ZONE = 8;
/** Web `p-4` around each photo. */
const PHOTO_INSET = 16;
/** Web `transform 300ms ease`. */
const SNAP_MS = 300;

const AXIS_NONE = 0;
const AXIS_H = 1;
const AXIS_V = 2;

type Size = { w: number; h: number };

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
  /** Optional save action (top-left). May return a Promise (busy-guarded). */
  onSave?: (url: string, index: number) => void | Promise<void>;
  /** External busy flag (kept for callers that track it themselves). */
  saving?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const count = photos.length;
  const clampIdx = useCallback(
    (i: number) => Math.max(0, Math.min(Math.max(0, count - 1), i)),
    [count],
  );

  const [index, setIndex] = useState(() => clampIdx(initialIndex));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Natural photo sizes (by URL) — needed to tell a tap on the photo from a
  // tap on the dark margin around the contain-fit image.
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  const indexSV = useSharedValue(clampIdx(initialIndex));
  const translateX = useSharedValue(-clampIdx(initialIndex) * width);
  const translateY = useSharedValue(0);
  const fade = useSharedValue(1);
  const axis = useSharedValue(AXIS_NONE);

  // (Re)seed whenever a new session opens (or the caller moves initialIndex).
  useEffect(() => {
    if (!open) return;
    const safe = clampIdx(initialIndex);
    setIndex(safe);
    indexSV.value = safe;
    translateX.value = -safe * width;
    translateY.value = 0;
    fade.value = 1;
    axis.value = AXIS_NONE;
    // width / clampIdx are handled below — a rotation must not jump back to
    // the photo the lightbox was opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIndex]);

  // Rotation / split-view resize or a shrinking photo list: keep the CURRENT
  // photo, re-clamped, and re-align the track to the new width.
  useEffect(() => {
    const safe = clampIdx(indexSV.value);
    if (safe !== indexSV.value) {
      indexSV.value = safe;
      setIndex(safe);
    }
    translateX.value = -safe * width;
  }, [width, clampIdx, indexSV, translateX]);

  const goTo = useCallback(
    (next: number) => {
      const safe = clampIdx(next);
      setIndex(safe);
      indexSV.value = safe;
      translateX.value = reduceMotion
        ? -safe * width
        : withTiming(-safe * width, { duration: SNAP_MS, easing: Easing.out(Easing.ease) });
    },
    [clampIdx, indexSV, translateX, reduceMotion, width],
  );

  const settleIndex = useCallback((next: number) => setIndex(next), []);

  /** Tap on the dark margin around the (contain-fit) photo closes. */
  const handleTap = useCallback(
    (x: number, y: number) => {
      const uri = photos[index];
      const size = uri ? sizes[uri] : undefined;
      const boxW = width - PHOTO_INSET * 2;
      const boxH = height - PHOTO_INSET * 2;
      if (!size || size.w <= 0 || size.h <= 0 || boxW <= 0 || boxH <= 0) {
        onClose(); // nothing rendered yet → the whole area is "margin" (web parity)
        return;
      }
      const scale = Math.min(boxW / size.w, boxH / size.h);
      const dw = size.w * scale;
      const dh = size.h * scale;
      const left = (width - dw) / 2;
      const top = (height - dh) / 2;
      const inside = x >= left && x <= left + dw && y >= top && y <= top + dh;
      if (!inside) onClose();
    },
    [sizes, photos, index, width, height, onClose],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-AXIS_DEAD_ZONE, AXIS_DEAD_ZONE])
    .activeOffsetY([-AXIS_DEAD_ZONE, AXIS_DEAD_ZONE])
    .onStart(() => {
      axis.value = AXIS_NONE;
    })
    .onUpdate((e) => {
      if (axis.value === AXIS_NONE) {
        if (Math.abs(e.translationX) > AXIS_DEAD_ZONE || Math.abs(e.translationY) > AXIS_DEAD_ZONE) {
          axis.value =
            Math.abs(e.translationX) > Math.abs(e.translationY) ? AXIS_H : AXIS_V;
        } else {
          return;
        }
      }
      if (axis.value === AXIS_H) {
        translateX.value = -indexSV.value * width + e.translationX;
      } else {
        const dy = Math.max(0, e.translationY);
        translateY.value = dy;
        fade.value = Math.max(0.5, 1 - dy / 400);
      }
    })
    .onEnd((e) => {
      if (axis.value === AXIS_H) {
        let next = indexSV.value;
        if (e.translationX < -SWIPE_H_THRESHOLD && next < count - 1) next += 1;
        else if (e.translationX > SWIPE_H_THRESHOLD && next > 0) next -= 1;
        const target = -next * width;
        translateX.value = reduceMotion
          ? target
          : withTiming(target, { duration: SNAP_MS, easing: Easing.out(Easing.ease) });
        if (next !== indexSV.value) {
          indexSV.value = next;
          runOnJS(settleIndex)(next);
        }
      } else if (axis.value === AXIS_V && e.translationY > SWIPE_V_CLOSE_THRESHOLD) {
        if (!reduceMotion) {
          fade.value = withTiming(0, { duration: 160 });
          translateY.value = withTiming(e.translationY + 300, { duration: 160 });
        }
        runOnJS(onClose)();
      } else {
        translateY.value = reduceMotion ? 0 : withTiming(0, { duration: 200 });
        fade.value = reduceMotion ? 1 : withTiming(1, { duration: 200 });
      }
      axis.value = AXIS_NONE;
    });

  const tap = Gesture.Tap().onEnd((e, success) => {
    if (success) runOnJS(handleTap)(e.x, e.y);
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: translateY.value }],
  }));
  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  async function handleSave() {
    if (!onSave || saving || busyRef.current) return;
    const url = photos[index];
    if (!url) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onSave(url, index);
    } catch {
      // Callers own the success / failure feedback; never leak an unhandled
      // rejection from the fire-and-forget press handler.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onA11yAction(e: AccessibilityActionEvent) {
    if (e.nativeEvent.actionName === "increment") goTo(index + 1);
    else if (e.nativeEvent.actionName === "decrement") goTo(index - 1);
  }

  if (!open || count === 0) return null;

  const counterLabel = t("PhotoLightbox.counter", { current: index + 1, total: count });
  const saveBusy = busy || !!saving;
  const btnTop = Math.max(insets.top, 16);

  return (
    <Modal
      visible={open}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      {/* Modals live outside the app's root gesture view — give the
          carousel its own root so pan / tap are recognised. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[styles.overlay, overlayStyle]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <GestureDetector gesture={gesture}>
            <View
              style={StyleSheet.absoluteFill}
              accessible
              // Web labels the dialog with the counter (multi) or "close"
              // (single). Multi = adjustable (swipe up/down steps photos);
              // single = a close button so activating it does what it says.
              accessibilityRole={count > 1 ? "adjustable" : "button"}
              accessibilityLabel={count > 1 ? counterLabel : t("PhotoLightbox.close")}
              accessibilityValue={count > 1 ? { text: counterLabel } : undefined}
              accessibilityActions={
                count > 1 ? [{ name: "increment" }, { name: "decrement" }] : undefined
              }
              onAccessibilityAction={onA11yAction}
              onAccessibilityTap={count > 1 ? undefined : onClose}
            >
              <Animated.View
                style={[styles.track, { width: width * count, height }, trackStyle]}
              >
                {photos.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={[styles.slide, { width, height }]}>
                    {/* Only the current photo ±1 decode (galleries pass hundreds). */}
                    {Math.abs(i - index) <= 1 ? (
                    <Image
                      source={{ uri }}
                      resizeMode="contain"
                      style={{ width: width - PHOTO_INSET * 2, height: height - PHOTO_INSET * 2 }}
                      accessibilityIgnoresInvertColors
                      onLoad={(e) => {
                        const src = e.nativeEvent.source;
                        if (src?.width && src?.height) {
                          setSizes((prev) =>
                            prev[uri]?.w === src.width && prev[uri]?.h === src.height
                              ? prev
                              : { ...prev, [uri]: { w: src.width, h: src.height } },
                          );
                        }
                      }}
                    />
                    ) : null}
                  </View>
                ))}
              </Animated.View>
            </View>
          </GestureDetector>

          {onSave ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Common.saveToAlbum.label")}
              accessibilityState={{ disabled: saveBusy, busy: saveBusy }}
              onPress={() => void handleSave()}
              disabled={saveBusy}
              style={({ pressed }) => [
                styles.iconBtn,
                { top: btnTop, left: 16 },
                pressed && styles.iconBtnPressed,
                saveBusy && styles.iconBtnBusy,
              ]}
            >
              {saveBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Download size={20} color="#ffffff" strokeWidth={2} />
              )}
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("PhotoLightbox.close")}
            onPress={onClose}
            style={({ pressed }) => [
              styles.iconBtn,
              { top: btnTop, right: 16 },
              pressed && styles.iconBtnPressed,
            ]}
          >
            <X size={20} color="#ffffff" strokeWidth={2} />
          </Pressable>

          {count > 1 ? (
            <View
              style={[styles.indicator, { bottom: Math.max(insets.bottom, 24) }]}
              pointerEvents="box-none"
            >
              <Text style={styles.counter} accessibilityLiveRegion="polite">
                {counterLabel}
              </Text>
              {/* Dots only for short sets; the counter always shows (web). */}
              {count <= 10 ? (
              <View style={styles.dots}>
                {photos.map((_, i) => {
                  const active = i === index;
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityLabel={
                        active
                          ? t("PhotoLightbox.counter", { current: i + 1, total: count })
                          : i < index
                            ? t("PhotoLightbox.prev")
                            : t("PhotoLightbox.next")
                      }
                      accessibilityState={{ selected: active }}
                      onPress={() => goTo(i)}
                      hitSlop={{ top: 18, bottom: 18, left: 4, right: 4 }}
                      style={[styles.dot, active && styles.dotActive]}
                    />
                  );
                })}
              </View>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web fixed inset-0 bg-black/90
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)" },
  track: { flexDirection: "row" },
  // web flex h-full w-full items-center justify-center p-4
  slide: { alignItems: "center", justifyContent: "center", padding: PHOTO_INSET },
  // web size-11 rounded-full bg-black/40 text-white
  iconBtn: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  // web hover:bg-black/60
  iconBtnPressed: { backgroundColor: "rgba(0,0,0,0.6)" },
  // web disabled:opacity-60
  iconBtnBusy: { opacity: 0.6 },
  // web absolute inset-x-0 flex flex-col items-center gap-2.5 px-4
  indicator: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  // web text-xs font-medium tabular-nums opacity-80
  counter: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.8,
    fontVariant: ["tabular-nums"],
  },
  // web flex items-center gap-2
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  // web h-2 w-2 rounded-full bg-white/40
  dot: { height: 8, width: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  // web w-5 bg-mango-brand
  dotActive: { width: 20, backgroundColor: colors.brand },
});
