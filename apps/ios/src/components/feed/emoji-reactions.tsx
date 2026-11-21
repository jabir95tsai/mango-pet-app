/**
 * Emoji reactions — 1:1 with web apps/web/src/components/feed/emoji-reactions
 * .tsx (feed-comments-and-reactions-v2 §B). Facebook-style:
 *
 *  - Threads-style bare button: outline Heart (or your emoji once reacted) +
 *    total count, no pill background. Tap = remove whatever you have, else set
 *    ❤️. Long-press (450ms, web LONG_PRESS_MS) opens the tray; VoiceOver gets
 *    a "more reactions" custom action instead.
 *  - tray: a floating pill of the 5 emojis just above the control. Rendered
 *    in a transparent Modal at the measured position so it never gets clipped
 *    by the card / list and any tap outside dismisses it (web closes on
 *    pointerdown outside). Pick = replace, or remove if it's already yours.
 *
 * Counts update optimistically with rollback; they re-sync from the post prop
 * whenever the feed refetches (web `useEffect(() => setLocalCounts(counts))`).
 * The tray enter animation is skipped under Reduce Motion.
 *
 * Backend model unchanged: one reaction per user (setReaction / reactions/
 * {uid} / client-maintained reactionCounts).
 */
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { REACTION_EMOJIS, type ReactionEmoji } from "@mango/shared-types";

import { getMyReaction, setReaction } from "@/lib/posts";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useAuth } from "@/state/auth-context";
import { useGuestUpgrade } from "@/components/auth/guest-upgrade";
import { colors, radius, shadows, spacing } from "@/theme/theme";

type Counts = Record<ReactionEmoji, number>;

const DEFAULT_EMOJI: ReactionEmoji = "❤️";
const LONG_PRESS_MS = 450;
// Threads-style liked red; only for the filled heart + its count.
const LIKE_RED = "#ff3040";
// Tray geometry: p-1 + 5 × size-10 + 4 × gap-1 + 1px border each side.
const TRAY_ITEM = 40;
const TRAY_PAD = 4;
const TRAY_GAP = 4;
const TRAY_WIDTH =
  REACTION_EMOJIS.length * TRAY_ITEM + (REACTION_EMOJIS.length - 1) * TRAY_GAP + TRAY_PAD * 2 + 2;
const TRAY_HEIGHT = TRAY_ITEM + TRAY_PAD * 2 + 2;
const TRAY_OFFSET = 8; // web mb-2

function normalize(counts: Partial<Counts> | undefined): Counts {
  const out = {} as Counts;
  for (const e of REACTION_EMOJIS) {
    const v = Number(counts?.[e] ?? 0);
    out[e] = Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  return out;
}

type TrayPos = { left: number; top: number };

export function EmojiReactions({
  postId,
  uid,
  initialCounts,
}: {
  postId: string;
  uid: string;
  /** The post's denormalised reactionCounts (re-synced whenever it changes). */
  initialCounts: Counts | undefined;
}) {
  const reduceMotion = useReducedMotion();
  // Guests see counts but can't react (rules reject it) — taps open the upgrade sheet.
  const { isGuest } = useAuth();
  const { openUpgrade } = useGuestUpgrade();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [counts, setCounts] = useState<Counts>(() => normalize(initialCounts));
  const [mine, setMine] = useState<ReactionEmoji | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [tray, setTray] = useState<TrayPos | null>(null);
  const [trayAnim] = useState(() => new Animated.Value(0));
  const [popAnim] = useState(() => new Animated.Value(1));
  const wrapperRef = useRef<View>(null);

  // Fresh server counts after a refetch (same post key → no remount).
  useEffect(() => {
    if (!pendingRef.current) setCounts(normalize(initialCounts));
  }, [initialCounts]);

  // The viewer's own reaction. Re-read when the post is refetched (a new
  // reactionCounts object) so a reaction made on another device shows up.
  useEffect(() => {
    let alive = true;
    getMyReaction(postId, uid)
      .then((r) => {
        if (alive && !pendingRef.current) setMine(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [postId, uid, initialCounts]);

  // Tray enter animation (snaps under Reduce Motion).
  useEffect(() => {
    if (!tray) {
      trayAnim.setValue(0);
      return;
    }
    if (reduceMotion) {
      trayAnim.setValue(1);
      return;
    }
    trayAnim.setValue(0);
    Animated.timing(trayAnim, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tray, reduceMotion, trayAnim]);

  // Optimistic commit + rollback. `next === mine` is a no-op.
  function commit(next: ReactionEmoji | null) {
    if (pendingRef.current || next === mine) return;
    const prevMine = mine;
    const prevCounts = counts;
    const optimistic = { ...counts };
    if (prevMine) optimistic[prevMine] = Math.max(0, (optimistic[prevMine] ?? 0) - 1);
    if (next) optimistic[next] = (optimistic[next] ?? 0) + 1;
    setCounts(optimistic);
    setMine(next);
    // Haptics aren't motion, so they still fire under Reduce Motion; iOS mutes them if system haptics are off.
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft,
    ).catch(() => {});
    // Like feedback: the main emoji pops (skipped under Reduce Motion).
    if (next && !reduceMotion) {
      popAnim.setValue(1);
      Animated.sequence([
        Animated.timing(popAnim, {
          toValue: 1.35,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(popAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    pendingRef.current = true;
    setPending(true);
    setReaction(postId, uid, next)
      .catch(() => {
        // Revert so a silent failure doesn't look like the tap "took".
        setCounts(prevCounts);
        setMine(prevMine);
      })
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
      });
  }

  function openTray() {
    const node = wrapperRef.current;
    if (!node) return;
    node.measureInWindow((x, y, _w, h) => {
      const left = Math.max(spacing.sm, Math.min(x, windowWidth - TRAY_WIDTH - spacing.sm));
      // Above the control (web bottom-full mb-2); flip below near the top edge.
      const above = y - TRAY_OFFSET - TRAY_HEIGHT;
      const top = above < insets.top + spacing.sm ? y + h + TRAY_OFFSET : above;
      setTray({ left, top });
    });
  }

  function closeTray() {
    setTray(null);
  }

  function handlePick(emoji: ReactionEmoji) {
    commit(mine === emoji ? null : emoji);
    closeTray();
  }

  const total = REACTION_EMOJIS.reduce((s, e) => s + (counts[e] ?? 0), 0);
  const mainLabel = mine
    ? t("Post.yourReaction", { emoji: mine })
    : t("Post.react", { emoji: DEFAULT_EMOJI });

  return (
    <View ref={wrapperRef} collapsable={false} style={styles.row}>
      {/* Threads-style: bare icon + count, no pill. Tap = ❤️/remove,
          long-press = tray. VoiceOver reaches the tray via a custom action. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mainLabel}
        accessibilityValue={total > 0 ? { text: t("Post.reactionCount", { count: total }) } : undefined}
        accessibilityState={{ selected: mine !== null, disabled: pending }}
        accessibilityActions={[{ name: "moreReactions", label: t("Post.moreReactions") }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "moreReactions") (isGuest ? openUpgrade : openTray)();
        }}
        onPress={isGuest ? openUpgrade : () => commit(mine ? null : DEFAULT_EMOJI)}
        onLongPress={isGuest ? undefined : openTray}
        delayLongPress={LONG_PRESS_MS}
        disabled={pending}
        hitSlop={8}
        style={({ pressed }) => [styles.mainBtn, pending && styles.pending, pressed && styles.pressed]}
      >
        <Animated.View style={{ transform: [{ scale: popAnim }] }}>
          {mine && mine !== DEFAULT_EMOJI ? (
            <Text style={styles.mainEmoji}>{mine}</Text>
          ) : (
            <Heart
              size={22}
              color={mine ? LIKE_RED : colors.ink2}
              fill={mine ? LIKE_RED : "none"}
              strokeWidth={1.75}
            />
          )}
        </Animated.View>
        {total > 0 ? (
          <Text style={[styles.count, mine === DEFAULT_EMOJI && { color: LIKE_RED }]}>{total}</Text>
        ) : null}
      </Pressable>

      <Modal
        visible={tray != null}
        transparent
        animationType="none"
        onRequestClose={closeTray}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeTray}
          accessible={false}
          importantForAccessibility="no"
        />
        {tray ? (
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={t("Post.pickReaction")}
            onAccessibilityEscape={closeTray}
            style={[
              styles.tray,
              { left: tray.left, top: tray.top },
              {
                opacity: trayAnim,
                transform: [
                  { translateY: trayAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
                  { scale: trayAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ],
              },
            ]}
          >
            {REACTION_EMOJIS.map((emoji) => {
              const on = mine === emoji;
              return (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={t("Post.react", { emoji })}
                  accessibilityState={{ selected: on, disabled: pending }}
                  onPress={() => handlePick(emoji)}
                  disabled={pending}
                  hitSlop={2}
                  style={({ pressed }) => [
                    styles.trayBtn,
                    on && styles.trayBtnOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.trayEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  mainBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
  mainEmoji: { fontSize: 19, lineHeight: 24 },
  count: { fontSize: 14, color: colors.ink2, fontVariant: ["tabular-nums"] },
  // web disabled:opacity-60
  pending: { opacity: 0.6 },
  // web absolute bottom-full left-0 mb-2 flex gap-1 rounded-full border bg-white p-1 shadow-lg
  tray: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: TRAY_GAP,
    padding: TRAY_PAD,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.elevated,
  },
  // web grid size-10 place-items-center rounded-full text-xl
  trayBtn: {
    width: TRAY_ITEM,
    height: TRAY_ITEM,
    borderRadius: TRAY_ITEM / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // web bg-amber-100 → brandTint
  trayBtnOn: { backgroundColor: colors.brandTint },
  trayEmoji: { fontSize: 20 },
  pressed: { opacity: 0.7 },
});
