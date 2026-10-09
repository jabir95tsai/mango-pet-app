/**
 * Emoji reactions — 1:1 with web apps/web/src/components/feed/emoji-reactions
 * .tsx (feed-comments-and-reactions-v2 §B). Facebook-style:
 *
 *  - main pill (36pt, bgAlt; brandTint + amber ring when you reacted) shows
 *    your emoji or ❤️. Tap = remove whatever you have, else set ❤️. Long-press
 *    (450ms, web LONG_PRESS_MS) opens the tray.
 *  - "more reactions" button (36pt circle, lucide SmilePlus) — the accessible
 *    path to the tray (VoiceOver can't long-press).
 *  - summary cluster: the emojis that appeared (overlapping) + total.
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
import { SmilePlus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { REACTION_EMOJIS, type ReactionEmoji } from "@mango/shared-types";

import { getMyReaction, setReaction } from "@/lib/posts";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, shadows, spacing } from "@/theme/theme";

type Counts = Record<ReactionEmoji, number>;

const DEFAULT_EMOJI: ReactionEmoji = "❤️";
const LONG_PRESS_MS = 450;
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [counts, setCounts] = useState<Counts>(() => normalize(initialCounts));
  const [mine, setMine] = useState<ReactionEmoji | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [tray, setTray] = useState<TrayPos | null>(null);
  const [trayAnim] = useState(() => new Animated.Value(0));
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
  const present = REACTION_EMOJIS.filter((e) => (counts[e] ?? 0) > 0);
  const mainLabel = mine
    ? t("Post.yourReaction", { emoji: mine })
    : t("Post.react", { emoji: DEFAULT_EMOJI });

  return (
    <View ref={wrapperRef} collapsable={false} style={styles.row}>
      {/* Main toggle — tap = ❤️/remove, long-press = open tray. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mainLabel}
        accessibilityState={{ selected: mine !== null, disabled: pending }}
        onPress={() => commit(mine ? null : DEFAULT_EMOJI)}
        onLongPress={openTray}
        delayLongPress={LONG_PRESS_MS}
        disabled={pending}
        hitSlop={4}
        style={({ pressed }) => [
          styles.mainBtn,
          mine ? styles.mainBtnOn : null,
          pending && styles.pending,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.mainEmoji}>{mine ?? DEFAULT_EMOJI}</Text>
      </Pressable>

      {/* Accessible tray opener. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Post.moreReactions")}
        accessibilityState={{ expanded: tray != null }}
        onPress={() => (tray ? closeTray() : openTray())}
        hitSlop={4}
        style={({ pressed }) => [styles.moreBtn, pressed && styles.morePressed]}
      >
        <SmilePlus size={16} color={colors.ink3} strokeWidth={2} />
      </Pressable>

      {/* Summary — which emojis appeared + total (FB-style). */}
      {total > 0 ? (
        <View
          accessible
          accessibilityLabel={t("Post.reactionCount", { count: total })}
          style={styles.summary}
        >
          <View style={styles.summaryEmojis}>
            {present.map((e, i) => (
              <Text key={e} style={[styles.summaryEmoji, i > 0 && styles.summaryOverlap]}>
                {e}
              </Text>
            ))}
          </View>
          <Text style={styles.summaryCount}>{total}</Text>
        </View>
      ) : null}

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
  // web relative inline-flex items-center gap-2
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // web inline-flex h-9 items-center rounded-full px-3; off bg-zinc-100
  mainBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  // web bg-amber-100 ring-1 ring-amber-400 → mango brandTint + amber ring
  mainBtnOn: { backgroundColor: colors.brandTint, borderColor: colors.amber },
  mainEmoji: { fontSize: 16, lineHeight: 20 },
  // web disabled:opacity-60
  pending: { opacity: 0.6 },
  // web grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-500
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  morePressed: { backgroundColor: colors.hairline },
  // web inline-flex items-center gap-1 text-xs font-medium text-zinc-500
  summary: { flexDirection: "row", alignItems: "center", gap: 4 },
  summaryEmojis: { flexDirection: "row", alignItems: "center" },
  summaryEmoji: { fontSize: 12 },
  summaryOverlap: { marginLeft: -2 },
  summaryCount: { fontSize: 12, fontWeight: "500", color: colors.ink3 },
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
