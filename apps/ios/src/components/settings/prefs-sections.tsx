/**
 * Walk auto-photo + leaderboard visibility sections (P5a) — direct merge writes,
 * optimistic. 1:1 with web walk-auto-photo-section + leaderboard-visibility-section:
 * icon disc + i18n title/body, lucide option icons + Check on the selected row.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Camera, Check, Globe, Lock, Trophy, Users } from "lucide-react-native";
import type { LeaderboardVisibility } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { getUserPrefs, setLeaderboardVisibility, setWalkAutoPhoto } from "@/lib/user-prefs";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tWap = scoped("Settings.walkAutoPhoto");
const tLv = scoped("Settings.leaderboardVisibility");

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
        <View style={styles.iconDisc}>
          <Camera size={16} color={colors.brandDeep} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{tWap("title")}</Text>
          <Text style={styles.hint}>{tWap("body")}</Text>
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

const VIS_OPTIONS: { value: LeaderboardVisibility; Icon: typeof Globe }[] = [
  { value: "public", Icon: Globe },
  { value: "friends", Icon: Users },
  { value: "off", Icon: Lock },
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
      <View style={styles.headerRow}>
        <View style={styles.iconDisc}>
          <Trophy size={16} color={colors.brandDeep} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{tLv("title")}</Text>
          <Text style={styles.hint}>{tLv("subtitle")}</Text>
        </View>
      </View>
      {VIS_OPTIONS.map(({ value: v, Icon }) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => pick(v)}
            style={[styles.option, on && styles.optionOn]}
          >
            <Icon size={16} color={on ? colors.brandDeep : colors.ink3} style={styles.optIcon} />
            <View style={styles.optText}>
              <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{tLv(`${v}.label`)}</Text>
              <Text style={styles.hint}>{tLv(`${v}.hint`)}</Text>
            </View>
            {on ? <Check size={16} color={colors.brandDeep} style={styles.optIcon} /> : null}
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xs },
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 11, color: colors.ink3, marginTop: 1, lineHeight: 15 },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  optionOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  optIcon: { marginTop: 2 },
  optText: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: "700", color: colors.ink },
  optionLabelOn: { color: colors.brandDeep },
});
