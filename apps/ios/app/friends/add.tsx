/**
 * Friend-add landing (P6) — the QR/deep-link target `/friends/add?uid=X`. Reads
 * the target uid, loads their public profile, and offers Send Friend Request.
 * Mirrors web /app/friends/add. Self-QR and not-found handled.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { PublicUserProfile } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { getUserProfile } from "@/lib/friends-read";
import { sendFriendRequest } from "@/lib/friends-write";
import { UserAvatar } from "@/components/feed/user-avatar";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

type Status = "idle" | "sending" | "sent" | "self" | "error";

export default function FriendAddScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [target, setTarget] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    getUserProfile(uid)
      .then(setTarget)
      .catch(() => setTarget(null))
      .finally(() => setLoading(false));
  }, [uid]);

  async function add() {
    if (!user || !target) return;
    if (user.uid === target.uid) {
      setStatus("self");
      return;
    }
    setStatus("sending");
    try {
      await sendFriendRequest(
        { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL },
        target.uid,
      );
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t("Friends.add.title")}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color={colors.brand} size="large" />
        ) : !target ? (
          <>
            <Text style={styles.emoji}>🔍</Text>
            <Text style={styles.notFoundTitle}>{t("Friends.add.notFoundTitle")}</Text>
            <Text style={styles.notFoundDesc}>{t("Friends.add.notFoundDesc")}</Text>
          </>
        ) : (
          <>
            <UserAvatar name={target.displayName} photoURL={target.photoURL} size={88} />
            <Text style={styles.name}>{target.displayName}</Text>
            {target.city ? <Text style={styles.city}>{target.city}</Text> : null}

            {status === "self" ? (
              <Text style={styles.note}>這是你自己的 QR code 喔</Text>
            ) : status === "sent" ? (
              <Text style={styles.sentNote}>✅ 已送出邀請，等對方接受</Text>
            ) : status === "error" ? (
              <Text style={styles.errNote}>{t("Friends.add.failed")}</Text>
            ) : !user ? (
              <Text style={styles.note}>請先登入才能送出邀請</Text>
            ) : (
              <Pressable onPress={add} disabled={status === "sending"} style={styles.sendBtn}>
                {status === "sending" ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.sendText}>{t("Friends.add.send")}</Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.ink, fontWeight: "700", lineHeight: 32 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  emoji: { fontSize: 44 },
  name: { fontSize: 22, fontWeight: "900", color: colors.ink, marginTop: spacing.sm },
  city: { fontSize: 13, color: colors.ink3 },
  note: { fontSize: 14, color: colors.ink2, marginTop: spacing.md, textAlign: "center" },
  sentNote: { fontSize: 15, fontWeight: "700", color: colors.leaf, marginTop: spacing.lg },
  errNote: { fontSize: 14, color: colors.cookie, marginTop: spacing.md },
  notFoundTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  notFoundDesc: { fontSize: 13, color: colors.ink2, textAlign: "center", lineHeight: 19 },
  sendBtn: { marginTop: spacing.xl, height: 52, paddingHorizontal: spacing.xxl, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  sendText: { fontSize: 16, fontWeight: "800", color: colors.card },
});
