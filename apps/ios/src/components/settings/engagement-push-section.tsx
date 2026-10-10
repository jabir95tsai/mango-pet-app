/**
 * Engagement push opt-out — 1:1 with web
 * apps/web/src/components/settings/engagement-push-section.tsx: a Sparkles
 * header disc + title / subtitle, then one row per ENGAGEMENT_PUSH_TYPE
 * (Bell 16 + label + hint + Switch) divided by hairlines. "On" means NOT in
 * pushPrefs.engagementOptOut. Toggling writes arrayUnion/arrayRemove
 * (concurrent-safe), optimistic with rollback + red error text; the row's
 * switch is disabled while it saves. "family-milestone" is greyed in personal
 * mode (no family).
 *
 * `prefs` comes from the settings screen's single users/{uid} read
 * (undefined = still loading); local state re-syncs whenever it changes.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Bell, Sparkles } from "lucide-react-native";
import { ENGAGEMENT_PUSH_TYPES, type EngagementPushType } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { setEngagementOptOut, type UserPrefs } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { SettingsCard, SettingsIconDisc, settingsText } from "./settings-card";

export function EngagementPushSection({ prefs }: { prefs: UserPrefs | undefined }) {
  const { user } = useAuth();
  const { family, status: familyStatus } = useFamily();
  const [optOut, setOptOut] = useState<Set<EngagementPushType>>(new Set());
  const [pending, setPending] = useState<EngagementPushType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = prefs === undefined;

  useEffect(() => {
    if (prefs) setOptOut(new Set(prefs.pushPrefs?.engagementOptOut ?? []));
  }, [prefs]);

  // Only a RESOLVED scope without a family is personal mode (R08).
  const personalMode = familyStatus === "ready" && !family;

  async function toggle(type: EngagementPushType, on: boolean) {
    if (!user || pending) return;
    const optOutNext = !on; // on = receive = not opted out
    const prev = new Set(optOut);
    const next = new Set(optOut);
    if (optOutNext) next.add(type);
    else next.delete(type);
    setOptOut(next);
    setPending(type);
    setError(null);
    try {
      await setEngagementOptOut(user.uid, type, optOutNext);
    } catch (e) {
      setOptOut(prev);
      setError(e instanceof Error && e.message ? e.message : t("Family.actionFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <SettingsCard>
      <View style={styles.header}>
        <SettingsIconDisc>
          <Sparkles size={16} color={colors.brandDeep} strokeWidth={2} />
        </SettingsIconDisc>
        <View style={styles.flex}>
          <Text style={settingsText.title}>{t("Settings.engagementPush.title")}</Text>
          <Text style={settingsText.sub}>{t("Settings.engagementPush.subtitle")}</Text>
        </View>
      </View>

      {loading ? (
        <Text style={settingsText.sub}>{t("Settings.engagementPush.loading")}</Text>
      ) : (
        <View>
          {ENGAGEMENT_PUSH_TYPES.map((type, i) => {
            const disabled = type === "family-milestone" && personalMode;
            const on = !optOut.has(type);
            const label = t(`Settings.engagementPush.${type}.label`);
            return (
              <View key={type} style={[styles.row, i > 0 ? styles.rowDivider : styles.rowFirst]}>
                <Bell
                  size={16}
                  color={disabled ? colors.hairline : colors.ink3}
                  strokeWidth={2}
                  style={styles.rowIcon}
                />
                <View style={styles.flex}>
                  <Text style={[styles.label, disabled && styles.muted]}>{label}</Text>
                  <Text style={settingsText.sub}>
                    {disabled
                      ? t("Settings.engagementPush.familyOnlyHint")
                      : t(`Settings.engagementPush.${type}.hint`)}
                  </Text>
                </View>
                <Switch
                  value={on && !disabled}
                  onValueChange={(v) => void toggle(type, v)}
                  disabled={disabled || pending !== null}
                  trackColor={{ true: colors.brand, false: colors.hairline }}
                  thumbColor={colors.card}
                  accessibilityLabel={label}
                />
              </View>
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
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  // web: flex items-start gap-3 py-3 (first: pt-0), divide-y hairline
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowFirst: { paddingTop: 0 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowIcon: { alignSelf: "flex-start", marginTop: 2 },
  label: { fontSize: 14, fontWeight: "500", color: colors.ink },
  muted: { color: colors.ink3 },
});
