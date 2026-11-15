/**
 * Leaderboard layout A (podium) pieces, shared by the human + dog boards:
 *  - Podium: top 3 as 2nd · 1st · 3rd columns on mango-toned blocks
 *  - ScopePill: the scope switch as a compact pill beside the title
 *    (native ActionSheetIOS, same pattern as feed/post-menu)
 *  - MyRankBar: pinned above the tab bar when "me" is ranked below the podium,
 *    with the gap to the next rank up
 */
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { Avatar } from "@/components/ui/Avatar";
import { useTabBarOverlap } from "@/lib/liquid-glass";
import { groupThousands } from "@/lib/format";
import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

export type PodiumItem = {
  key: string;
  name: string;
  photoURL?: string | null;
  score: number;
  /** Pre-formatted「n 次 · x km」line. */
  meta: string;
  isMe?: boolean;
};

// Medal metals are decorative (gold reuses mango amber); ink numerals pass AA on all three.
const PLACE = [
  { medal: colors.amber, edge: colors.brandDeep, ribbon: [colors.brand, colors.brandDeep], avatar: 60, padBottom: 26 },
  { medal: "#e4e1dc", edge: "#b9b3aa", ribbon: [colors.amber, colors.brand], avatar: 50, padBottom: 14 },
  { medal: "#f0c39a", edge: "#b9784a", ribbon: [colors.brandTint, colors.amber], avatar: 46, padBottom: 8 },
] as const;

function Medal({ place }: { place: number }) {
  const p = PLACE[place];
  return (
    <Svg width={44} height={54} viewBox="0 0 44 54" style={styles.medal}>
      <Path d="M8 0h10l6 16-8 4L8 0Z" fill={p.ribbon[0]} />
      <Path d="M36 0H26l-6 16 8 4 8-20Z" fill={p.ribbon[1]} />
      <Circle cx={22} cy={34} r={16} fill={p.medal} stroke={p.edge} strokeWidth={3} />
      <Circle cx={22} cy={34} r={11} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
      <SvgText x={22} y={40} textAnchor="middle" fontSize={16} fontWeight="900" fill={colors.ink}>
        {place + 1}
      </SvgText>
    </Svg>
  );
}

/** Layout A3: top 3 as medal cards, 2nd · 1st · 3rd; 1st is taller + mango outline. */
export function Podium({ items, isDog }: { items: PodiumItem[]; isDog?: boolean }) {
  if (items.length === 0) return null;
  // Empty slots keep the 1st card centered.
  const slots = [1, 0, 2];
  return (
    <View style={styles.podium}>
      {slots.map((place) => {
        const it = items[place];
        if (!it) return <View key={place} style={styles.slot} />;
        const p = PLACE[place];
        return (
          <View
            key={it.key}
            style={[styles.slot, styles.card, { paddingBottom: p.padBottom }, place === 0 && styles.cardFirst]}
            accessible
            accessibilityLabel={`${place + 1}. ${it.name}, ${groupThousands(it.score)} ${t("Leaderboard.unitScore")}`}
          >
            <Medal place={place} />
            <View style={[styles.avatar, it.isMe && styles.avatarMe]}>
              <Avatar
                name={it.name}
                photoURL={it.photoURL}
                size={p.avatar}
                shape="circle"
                fallbackChar={isDog ? "🐾" : "🙂"}
              />
            </View>
            <Text style={styles.cardName} numberOfLines={1}>
              {it.name}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {it.meta}
            </Text>
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                {groupThousands(it.score)}
                <Text style={styles.scoreUnit}> {t("Leaderboard.unitScore")}</Text>
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function ScopePill<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  function open() {
    const labels = [...options.map((o) => o.label), t("Common.cancel")];
    ActionSheetIOS.showActionSheetWithOptions(
      { options: labels, cancelButtonIndex: labels.length - 1 },
      (i) => {
        if (i < options.length) onChange(options[i].value);
      },
    );
  }
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t("Leaderboard.scopeA11y", { scope: current.label })}
      hitSlop={4}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Text style={styles.pillText} numberOfLines={1}>
        {current.label}
      </Text>
      <ChevronDown size={14} color={colors.ink2} strokeWidth={2.2} />
    </Pressable>
  );
}

export function MyRankBar({
  rank,
  name,
  photoURL,
  score,
  gap,
  isDog,
}: {
  rank: number;
  name: string;
  photoURL?: string | null;
  score: number;
  /** Points to the next rank up (rank - 1). */
  gap: number;
  isDog?: boolean;
}) {
  const overlap = useTabBarOverlap();
  return (
    <View
      pointerEvents="none"
      style={[styles.bar, { bottom: overlap + spacing.sm }]}
      accessible
      accessibilityLabel={`${t("Leaderboard.myRank")} ${rank}, ${t("Leaderboard.gapToNext", { gap: groupThousands(gap), rank: rank - 1 })}`}
    >
      <Text style={styles.barRank}>#{rank}</Text>
      <Avatar name={name} photoURL={photoURL} size={32} shape="circle" fallbackChar={isDog ? "🐾" : "🙂"} />
      <View style={styles.barBody}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {isDog ? name : t("Leaderboard.myRank")}
        </Text>
        <Text style={styles.barMeta} numberOfLines={1}>
          {t("Leaderboard.gapToNext", { gap: groupThousands(gap), rank: rank - 1 })}
        </Text>
      </View>
      <Text style={styles.barScore}>{groupThousands(score)}</Text>
    </View>
  );
}

/** Height MyRankBar takes, so the list can pad past it. */
export const MY_RANK_BAR_SPACE = 76;

const styles = StyleSheet.create({
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  slot: { flex: 1 },
  card: {
    alignItems: "center",
    paddingHorizontal: 6,
    borderRadius: radius.xl2,
    borderWidth: 1,
    borderColor: colors.card,
    backgroundColor: "rgba(255,255,255,0.92)",
    ...shadows.card,
  },
  cardFirst: {
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.cardSoft,
    ...shadows.mango,
  },
  medal: { marginTop: -2 },
  avatar: { marginTop: 6, borderRadius: radius.pill, borderWidth: 2, borderColor: "transparent" },
  avatarMe: { borderColor: colors.brandDeep },
  cardName: { marginTop: 6, maxWidth: "100%", fontSize: 13, fontWeight: "700", color: colors.ink },
  cardMeta: { maxWidth: "100%", fontSize: 11, color: colors.ink2 },
  scorePill: {
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSoft,
  },
  scoreText: { fontSize: 14, fontWeight: "800", color: colors.brandDeep, fontVariant: ["tabular-nums"] },
  scoreUnit: { fontSize: 10, fontWeight: "600", color: colors.ink2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.card,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  pressed: { opacity: 0.7 },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  bar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.xl2,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
    ...shadows.mango,
  },
  barRank: { fontSize: 15, fontWeight: "800", color: colors.brandDeep, fontVariant: ["tabular-nums"] },
  barBody: { flex: 1, minWidth: 0 },
  barTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  barMeta: { fontSize: 12, color: colors.ink2 },
  barScore: { fontSize: 16, fontWeight: "800", color: colors.brandDeep, fontVariant: ["tabular-nums"] },
});
