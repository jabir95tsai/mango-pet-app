/**
 * Walk auto-photo + leaderboard visibility sections (P5a) — direct merge writes,
 * optimistic. Mirror web walk-auto-photo-section + leaderboard-visibility-section.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { LeaderboardVisibility } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { getUserPrefs, setLeaderboardVisibility, setWalkAutoPhoto } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function WalkAutoPhotoSection() {
  const { user } = useAuth();
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserPrefs(user.uid).then((p) => setOn(p.walkPrefs?.autoPhotoShare !== false));
  }, [user]);

  async function toggle(next: boolean) {
    if (!user) return;
    const prev = on;
    setOn(next);
    try {
      await setWalkAutoPhoto(user.uid, next);
    } catch {
      setOn(prev);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>遛狗自動拍照分享</Text>
          <Text style={styles.hint}>開始 / 結束遛狗時，提示拍照並分享動態。</Text>
        </View>
        <Switch
          value={on}
          onValueChange={toggle}
          trackColor={{ true: colors.brand, false: colors.hairline }}
          thumbColor={colors.card}
        />
      </View>
    </View>
  );
}

const VIS_OPTIONS: { value: LeaderboardVisibility; label: string; sub: string }[] = [
  { value: "public", label: "🌍 公開", sub: "全 App + 好友排行榜都看得到" },
  { value: "friends", label: "👥 好友", sub: "只有好友排行榜看得到" },
  { value: "off", label: "🔒 隱藏", sub: "不出現在任何排行榜（自己仍看得到自己的狗）" },
];

export function LeaderboardVisibilitySection() {
  const { user } = useAuth();
  const [value, setValue] = useState<LeaderboardVisibility>("public");

  useEffect(() => {
    if (!user) return;
    getUserPrefs(user.uid).then((p) => setValue(p.leaderboardVisibility ?? "public"));
  }, [user]);

  async function pick(next: LeaderboardVisibility) {
    if (!user || next === value) return;
    const prev = value;
    setValue(next);
    try {
      await setLeaderboardVisibility(user.uid, next);
    } catch {
      setValue(prev);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>排行榜可見度</Text>
      {VIS_OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => pick(o.value)}
            style={[styles.option, on && styles.optionOn]}
          >
            <View style={styles.text}>
              <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{o.label}</Text>
              <Text style={styles.hint}>{o.sub}</Text>
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 11, color: colors.ink3, marginTop: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  optionOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  optionLabel: { fontSize: 14, fontWeight: "700", color: colors.ink },
  optionLabelOn: { color: colors.brandDeep },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
