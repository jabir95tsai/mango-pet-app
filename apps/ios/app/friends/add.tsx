/**
 * Friend-add landing — the QR / deep-link target `/friends/add?uid=X`, 1:1
 * with web /app/friends/add: back row → RouteHeader (add.title + subtitle) →
 * a white card with the target's avatar (96), name, city and the action:
 *   - send (btn-mango, UserPlus, "送出中…" while busy; failures keep the
 *     button and show the real error underneath — retryable)
 *   - sent → leaf pill with Check; already friends → muted line
 *   - self QR / signed-out → explanatory line
 *   - guests → the locked notice (friends are community features)
 * Not found → EmptyState card with a back button. Back falls back to
 * /friends on a cold deep link.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Check, UserPlus, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { PublicUserProfile } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { getUserProfile, listFriendUids } from "@/lib/friends-read";
import { sendFriendRequest } from "@/lib/friends-write";
import { resolveUserDisplayName } from "@/lib/auth-profile";
import { UserAvatar } from "@/components/feed/user-avatar";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { colors, radius, shadows, spacing, type, CONTENT_MAX_WIDTH } from "@/theme/theme";

type Status = "idle" | "sending" | "sent";

export default function FriendAddScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [target, setTarget] = useState<PublicUserProfile | null>(null);
  const [alreadyFriend, setAlreadyFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    let alive = true;
    void Promise.allSettled([
      getUserProfile(uid),
      user && !isGuest ? listFriendUids(user.uid) : Promise.resolve([] as string[]),
    ]).then(([profileR, friendsR]) => {
      if (!alive) return;
      setTarget(profileR.status === "fulfilled" ? profileR.value : null);
      setAlreadyFriend(friendsR.status === "fulfilled" && friendsR.value.includes(uid));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [uid, user, isGuest]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/friends"));

  async function add() {
    if (!user || !target || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      await sendFriendRequest(
        { uid: user.uid, displayName: resolveUserDisplayName(user), photoURL: user.photoURL },
        target.uid,
      );
      setStatus("sent");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error && e.message ? e.message : t("Friends.add.failed"));
    }
  }

  const isSelf = !!user && !!target && user.uid === target.uid;

  let action: React.ReactNode;
  if (!user) {
    action = <Text style={styles.note}>{t("Friends.add.signIn")}</Text>;
  } else if (isGuest) {
    action = <GuestLockedNotice feature="friends" style={styles.fullWidth} />;
  } else if (isSelf) {
    action = <Text style={styles.selfNote}>{t("Friends.add.self")}</Text>;
  } else if (status === "sent") {
    action = (
      <View style={styles.sentPill}>
        <Check size={16} color={colors.leaf} strokeWidth={2.2} />
        <Text style={styles.sentText}>{t("Friends.add.sent")}</Text>
      </View>
    );
  } else if (alreadyFriend) {
    action = <Text style={styles.note}>{t("Friends.alreadyFriends")}</Text>;
  } else {
    action = (
      <View style={styles.fullWidth}>
        <Button
          label={status === "sending" ? t("Friends.add.sending") : t("Friends.add.send")}
          size="lg"
          fullWidth
          icon={<UserPlus size={16} color="#ffffff" strokeWidth={2} />}
          onPress={() => void add()}
          disabled={status === "sending"}
        />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Common.back")}
          onPress={goBack}
          hitSlop={8}
          style={styles.backBtn}
        >
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Friends.add.title")}
          </Text>
          <Text style={styles.subtitle}>{t("Friends.add.subtitle")}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} size="large" style={styles.loader} />
        ) : !target ? (
          <EmptyState
            icon={X}
            title={t("Friends.add.notFoundTitle")}
            description={t("Friends.add.notFoundDesc")}
            secondaryAction={{ label: t("Common.back"), onPress: goBack }}
          />
        ) : (
          <View style={styles.card}>
            <UserAvatar name={target.displayName} photoURL={target.photoURL} size={96} />
            <View style={styles.identity}>
              <Text style={styles.name}>{target.displayName}</Text>
              {target.city ? <Text style={styles.city}>{target.city}</Text> : null}
            </View>
            {action}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  header: { marginBottom: spacing.xl },
  title: { ...type.h1, color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 24, color: colors.ink2 },
  loader: { marginTop: spacing.xxl },
  // web: rounded-lg border bg-white p-6 shadow-sm flex-col items-center gap-4
  card: {
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.card,
  },
  identity: { alignItems: "center", gap: 2 },
  name: { fontSize: 18, fontWeight: "600", color: colors.ink, textAlign: "center" },
  city: { fontSize: 12, color: colors.ink3 },
  fullWidth: { width: "100%" },
  note: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  selfNote: { fontSize: 14, color: colors.brandDeep, textAlign: "center" },
  sentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.leafTint,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sentText: { fontSize: 14, fontWeight: "600", color: colors.leaf },
  error: { marginTop: spacing.sm, fontSize: 14, color: colors.danger, textAlign: "center" },
});
