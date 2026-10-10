/**
 * Walk auto-photo + leaderboard visibility sections — 1:1 with web
 * walk-auto-photo-section + leaderboard-visibility-section: icon disc + title /
 * body, a loading line until the prefs arrive, controls disabled while loading
 * or saving, optimistic merge writes with rollback + red error text.
 * Leaderboard options: lucide icon + label (14/500 ink) + hint (12 ink2);
 * the selected one gets a brand border on brand-tint/40 + Check.
 *
 * `prefs` comes from the settings screen's single users/{uid} read
 * (undefined = still loading).
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Camera, Check, Globe, Lock, Trophy, Users } from "lucide-react-native";
import type { LeaderboardVisibility } from "@mango/shared-types";

import { withAlpha } from "@/components/auth/color";
import { useAuth } from "@/state/auth-context";
import { setLeaderboardVisibility, setWalkAutoPhoto, type UserPrefs } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import { SettingsCard, SettingsIconDisc, settingsText } from "./settings-card";

function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : t("Family.actionFailed");
}

export function WalkAutoPhotoSection({ prefs }: { prefs: UserPrefs | undefined }) {
  const { user } = useAuth();
  const [on, setOn] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = prefs === undefined;

  useEffect(() => {
    if (prefs) setOn(prefs.walkPrefs?.autoPhotoShare !== false);
  }, [prefs]);

  async function toggle(next: boolean) {
    if (!user || pending) return;
    const prev = on;
    setOn(next);
    setPending(true);
    setError(null);
    try {
      await setWalkAutoPhoto(user.uid, next);
    } catch (e) {
      setOn(prev);
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard>
      <View style={styles.row}>
        <SettingsIconDisc>
          <Camera size={16} color={colors.brandDeep} strokeWidth={2} />
        </SettingsIconDisc>
        <View style={styles.text}>
          <Text style={settingsText.title}>{t("Settings.walkAutoPhoto.title")}</Text>
          <Text style={settingsText.sub}>{t("Settings.walkAutoPhoto.body")}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => void toggle(v)}
          disabled={loading || pending}
          trackColor={{ true: colors.brand, false: colors.hairline }}
          thumbColor={colors.card}
          accessibilityLabel={t("Settings.walkAutoPhoto.title")}
        />
      </View>
      {error ? (
        <Text style={settingsText.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </SettingsCard>
  );
}

const VIS_OPTIONS: { value: LeaderboardVisibility; Icon: typeof Globe }[] = [
  { value: "public", Icon: Globe },
  { value: "friends", Icon: Users },
  { value: "off", Icon: Lock },
];

export function LeaderboardVisibilitySection({ prefs }: { prefs: UserPrefs | undefined }) {
  const { user } = useAuth();
  const [value, setValue] = useState<LeaderboardVisibility>("public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = prefs === undefined;

  useEffect(() => {
    if (prefs) setValue(prefs.leaderboardVisibility ?? "public");
  }, [prefs]);

  async function pick(next: LeaderboardVisibility) {
    if (!user || pending || next === value) return;
    const prev = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      await setLeaderboardVisibility(user.uid, next);
    } catch (e) {
      setValue(prev);
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard>
      <View style={styles.row}>
        <SettingsIconDisc>
          <Trophy size={16} color={colors.brandDeep} strokeWidth={2} />
        </SettingsIconDisc>
        <View style={styles.text}>
          <Text style={settingsText.title}>{t("Settings.leaderboardVisibility.title")}</Text>
          <Text style={settingsText.sub}>{t("Settings.leaderboardVisibility.subtitle")}</Text>
        </View>
      </View>
      {loading ? (
        <Text style={settingsText.sub}>{t("Settings.leaderboardVisibility.loading")}</Text>
      ) : (
        <View style={styles.options} accessibilityRole="radiogroup">
          {VIS_OPTIONS.map(({ value: v, Icon }) => {
            const on = v === value;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: pending }}
                disabled={pending}
                onPress={() => void pick(v)}
                style={({ pressed }) => [
                  styles.option,
                  on && styles.optionOn,
                  pressed && !on && styles.optionPressed,
                ]}
              >
                <Icon
                  size={16}
                  color={on ? colors.brandDeep : colors.ink3}
                  strokeWidth={2}
                  style={styles.optIcon}
                />
                <View style={styles.text}>
                  <Text style={styles.optionLabel}>{t(`Settings.leaderboardVisibility.${v}.label`)}</Text>
                  <Text style={settingsText.sub}>{t(`Settings.leaderboardVisibility.${v}.hint`)}</Text>
                </View>
                {on ? (
                  <Check size={16} color={colors.brandDeep} strokeWidth={2.5} style={styles.optIcon} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? (
        <Text style={settingsText.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, minWidth: 0 },
  options: { gap: spacing.sm },
  // web: flex items-start gap-3 rounded-md border p-3
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  optionOn: { borderColor: colors.brand, backgroundColor: withAlpha(colors.brandTint, 0.4) },
  optionPressed: { backgroundColor: colors.bgAlt },
  optIcon: { marginTop: 2 },
  optionLabel: { fontSize: 14, fontWeight: "500", color: colors.ink },
});
