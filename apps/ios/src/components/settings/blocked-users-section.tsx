/**
 * Settings → "已封鎖的使用者" — lets the user see and undo who they've
 * blocked (users/{uid}.blockedUids). Without this the block action would be a
 * one-way door. Spec docs/features/ugc-moderation.md. 1:1 with web
 * apps/web/src/components/settings/blocked-users-section.tsx: UserX disc +
 * title, avatar rows with a secondary sm "unblock" button, optimistic removal
 * with rollback + red Moderation.unblockFailed.
 *
 * The uid list comes from the settings screen's single users/{uid} read
 * (`prefs`, undefined = still loading); only the profiles are fetched here.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UserX } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/feed/user-avatar";
import { useAuth } from "@/state/auth-context";
import { getUserProfileLite, unblockUser, type UserPrefs } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { SettingsCard, SettingsIconDisc, settingsText } from "./settings-card";

type Row = { uid: string; displayName: string; photoURL: string | null };

export function BlockedUsersSection({ prefs }: { prefs: UserPrefs | undefined }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const uidsKey = (prefs?.blockedUids ?? []).join(",");

  useEffect(() => {
    if (!prefs) return;
    let cancelled = false;
    const uids = prefs.blockedUids ?? [];
    void Promise.all(uids.map((uid) => getUserProfileLite(uid).catch(() => null))).then(
      (profiles) => {
        if (cancelled) return;
        setRows(
          uids.map((uid, i) => ({
            uid,
            displayName: profiles[i]?.displayName ?? uid,
            photoURL: profiles[i]?.photoURL ?? null,
          })),
        );
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidsKey, prefs === undefined]);

  async function handleUnblock(uid: string) {
    if (!user || pendingUid || !rows) return;
    setPendingUid(uid);
    setError(false);
    const prev = rows;
    setRows(rows.filter((r) => r.uid !== uid));
    try {
      await unblockUser(user.uid, uid);
    } catch {
      setRows(prev);
      setError(true);
    } finally {
      setPendingUid(null);
    }
  }

  return (
    <SettingsCard>
      <View style={styles.header}>
        <SettingsIconDisc>
          <UserX size={16} color={colors.brandDeep} strokeWidth={2} />
        </SettingsIconDisc>
        <Text style={[settingsText.title, styles.flex]}>{t("Moderation.blockedUsersTitle")}</Text>
      </View>
      {rows === null ? (
        <Text style={settingsText.sub}>{t("Common.loading")}</Text>
      ) : rows.length === 0 ? (
        <Text style={settingsText.sub}>{t("Moderation.blockedUsersEmpty")}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.uid} style={styles.row}>
            <UserAvatar name={r.displayName} photoURL={r.photoURL} size={32} />
            <Text style={styles.name} numberOfLines={1}>
              {r.displayName}
            </Text>
            <Button
              label={t("Moderation.unblock")}
              variant="secondary"
              size="sm"
              onPress={() => void handleUnblock(r.uid)}
              disabled={pendingUid !== null}
              loading={pendingUid === r.uid}
            />
          </View>
        ))
      )}
      {error ? (
        <Text style={settingsText.error} accessibilityRole="alert">
          {t("Moderation.unblockFailed")}
        </Text>
      ) : null}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { flex: 1, fontSize: 14, color: colors.ink },
});
