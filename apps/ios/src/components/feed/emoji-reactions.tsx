/**
 * Emoji reactions (P3a) — mirrors web emoji-reactions. A main ❤️ toggle plus a
 * "＋" button that opens a 5-emoji tray. Tapping an emoji sets it (replacing the
 * current one), tapping the current emoji removes it. Counts update optimistically
 * with rollback on server error. (Long-press to open the tray is a P3b polish —
 * it needs the reanimated gesture gate; until then the tray opens on tap.)
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
} from "@mango/shared-types";

import { getMyReaction, setReaction } from "@/lib/posts";
import { colors, radius, spacing } from "@/theme/theme";

type Counts = Record<ReactionEmoji, number>;

function emptyCounts(): Counts {
  return REACTION_EMOJIS.reduce((acc, e) => {
    acc[e] = 0;
    return acc;
  }, {} as Counts);
}

function totalOf(counts: Counts): number {
  return REACTION_EMOJIS.reduce((sum, e) => sum + (counts[e] ?? 0), 0);
}

export function EmojiReactions({
  postId,
  uid,
  initialCounts,
}: {
  postId: string;
  uid: string;
  initialCounts: Counts | undefined;
}) {
  const [counts, setCounts] = useState<Counts>({
    ...emptyCounts(),
    ...(initialCounts ?? {}),
  });
  const [mine, setMine] = useState<ReactionEmoji | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyReaction(postId, uid)
      .then((r) => {
        if (alive) setMine(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [postId, uid]);

  async function apply(next: ReactionEmoji | null) {
    if (busy) return;
    const prevMine = mine;
    const prevCounts = counts;
    if (prevMine === next) {
      setTrayOpen(false);
      return;
    }
    // optimistic
    const optimistic = { ...prevCounts };
    if (prevMine) optimistic[prevMine] = Math.max(0, (optimistic[prevMine] ?? 0) - 1);
    if (next) optimistic[next] = (optimistic[next] ?? 0) + 1;
    setCounts(optimistic);
    setMine(next);
    setTrayOpen(false);
    setBusy(true);
    try {
      await setReaction(postId, uid, next);
    } catch {
      setCounts(prevCounts);
      setMine(prevMine);
    } finally {
      setBusy(false);
    }
  }

  const total = totalOf(counts);
  const activeEmojis = REACTION_EMOJIS.filter((e) => (counts[e] ?? 0) > 0);

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mine === "❤️" ? "取消愛心" : "按愛心"}
          onPress={() => apply(mine === "❤️" ? null : "❤️")}
          style={({ pressed }) => [
            styles.mainBtn,
            mine ? styles.mainBtnOn : null,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.mainEmoji}>{mine ?? "❤️"}</Text>
          {total > 0 ? (
            <Text style={[styles.count, mine ? styles.countOn : null]}>
              {total}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="更多反應"
          onPress={() => setTrayOpen((v) => !v)}
          style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>{trayOpen ? "✕" : "＋"}</Text>
        </Pressable>

        {activeEmojis.length > 0 ? (
          <View style={styles.breakdown}>
            {activeEmojis.map((e) => (
              <Text key={e} style={styles.breakdownItem}>
                {e}
                {counts[e]}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {trayOpen ? (
        <View style={styles.tray}>
          {REACTION_EMOJIS.map((e) => (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={`反應 ${e}`}
              onPress={() => apply(e)}
              style={({ pressed }) => [
                styles.trayBtn,
                mine === e ? styles.trayBtnOn : null,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.trayEmoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  mainBtnOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  mainEmoji: { fontSize: 16 },
  count: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  countOn: { color: colors.brandDeep },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { fontSize: 16, fontWeight: "700", color: colors.ink2 },
  breakdown: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginLeft: 2 },
  breakdownItem: { fontSize: 13, color: colors.ink3, fontWeight: "600" },
  tray: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignSelf: "flex-start",
  },
  trayBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  trayBtnOn: { backgroundColor: colors.brandTint },
  trayEmoji: { fontSize: 22 },
  pressed: { opacity: 0.7 },
});
