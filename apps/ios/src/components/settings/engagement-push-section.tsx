/**
 * Engagement push opt-out (P5a) — one switch per ENGAGEMENT_PUSH_TYPE; "on" means
 * NOT in pushPrefs.engagementOptOut. Toggling writes arrayUnion/arrayRemove
 * (concurrent-safe), optimistic with rollback. "family-milestone" is greyed in
 * personal mode (no family). Mirrors web engagement-push-section.tsx.
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import {
  ENGAGEMENT_PUSH_TYPES,
  type EngagementPushType,
} from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { getUserPrefs, setEngagementOptOut } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function EngagementPushSection() {
  const { user } = useAuth();
  const { family } = useFamily();
  const [optOut, setOptOut] = useState<Set<EngagementPushType>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserPrefs(user.uid)
      .then((p) => setOptOut(new Set(p.pushPrefs?.engagementOptOut ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const personalMode = !family;

  async function toggle(type: EngagementPushType, on: boolean) {
    if (!user) return;
    const optOutNext = !on; // on = receive = not opted out
    const prev = new Set(optOut);
    const next = new Set(optOut);
    if (optOutNext) next.add(type);
    else next.delete(type);
    setOptOut(next);
    try {
      await setEngagementOptOut(user.uid, type, optOutNext);
    } catch {
      setOptOut(prev);
    }
  }

  const rows = useMemo(() => ENGAGEMENT_PUSH_TYPES, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("Settings.engagementPush.title")}</Text>
      <Text style={styles.subtitle}>{t("Settings.engagementPush.subtitle")}</Text>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : (
        rows.map((type) => {
          const disabled = type === "family-milestone" && personalMode;
          const on = !optOut.has(type);
          return (
            <View key={type} style={[styles.row, disabled && styles.disabled]}>
              <View style={styles.text}>
                <Text style={styles.label}>{t(`Settings.engagementPush.${type}.label`)}</Text>
                <Text style={styles.hint}>
                  {disabled
                    ? t("Settings.engagementPush.familyOnlyHint")
                    : t(`Settings.engagementPush.${type}.hint`)}
                </Text>
              </View>
              <Switch
                value={on && !disabled}
                onValueChange={(v) => toggle(type, v)}
                disabled={disabled}
                trackColor={{ true: colors.brand, false: colors.hairline }}
                thumbColor={colors.card}
              />
            </View>
          );
        })
      )}
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
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 12, color: colors.ink3 },
  loader: { marginVertical: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  disabled: { opacity: 0.5 },
  text: { flex: 1 },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink },
  hint: { fontSize: 11, color: colors.ink3, marginTop: 1 },
});
