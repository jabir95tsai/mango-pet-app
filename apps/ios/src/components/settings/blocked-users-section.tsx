/**
 * Settings → "已封鎖的使用者" — lets the user see and undo who they've
 * blocked (users/{uid}.blockedUids). Without this the block action would
 * be a one-way door. Spec docs/features/ugc-moderation.md. Web parity:
 * apps/web/src/components/settings/blocked-users-section.tsx.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { UserX } from "lucide-react-native";

import { useAuth } from "@/state/auth-context";
import { getBlockedUids, getUserProfileLite, unblockUser } from "@/lib/user-prefs";
import { UserAvatar } from "@/components/feed/user-avatar";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const t = scoped("Moderation");

type Row = { uid: string; displayName: string; photoURL: string | null };

export function BlockedUsersSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const uids = await getBlockedUids(user.uid);
        const profiles = await Promise.all(
          uids.map((uid) => getUserProfileLite(uid).catch(() => null)),
        );
        if (cancelled) return;
        setRows(
          uids.map((uid, i) => ({
            uid,
            displayName: profiles[i]?.displayName ?? uid,
            photoURL: profiles[i]?.photoURL ?? null,
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleUnblock(uid: string) {
    if (!user || pendingUid) return;
    setPendingUid(uid);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.uid !== uid));
    try {
      await unblockUser(user.uid, uid);
    } catch {
      setRows(prev);
    } finally {
      setPendingUid(null);
    }
  }

  if (loading) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconDisc}>
          <UserX size={16} color={colors.brandDeep} />
        </View>
        <Text style={styles.title}>{t("blockedUsersTitle")}</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{t("blockedUsersEmpty")}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.uid} style={styles.row}>
            <UserAvatar name={r.displayName} photoURL={r.photoURL} size={32} />
            <Text style={styles.name} numberOfLines={1}>
              {r.displayName}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleUnblock(r.uid)}
              disabled={pendingUid === r.uid}
              style={({ pressed }) => [styles.unblockBtn, pressed && styles.pressed]}
            >
              <Text style={styles.unblockText}>{t("unblock")}</Text>
            </Pressable>
          </View>
        ))
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  empty: { fontSize: 12, color: colors.ink3, paddingLeft: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { flex: 1, fontSize: 14, color: colors.ink },
  unblockBtn: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  unblockText: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  pressed: { opacity: 0.7 },
});
