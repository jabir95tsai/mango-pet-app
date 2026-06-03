/**
 * Friends (P6) — tabs: friends list (realtime, remove), incoming requests
 * (accept/reject), user search (email/displayName → send request). Plus a "My QR"
 * modal. Mirrors web /app/friends. onSnapshot listeners are cleaned up on unmount.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import type { Friend, FriendRequest, PublicUserProfile } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import {
  subscribeFriends,
  subscribeFriendRequests,
  searchUsers,
} from "@/lib/friends-read";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/lib/friends-write";
import { UserAvatar } from "@/components/feed/user-avatar";
import { InviteQR } from "@/components/family/invite-qr";
import { Segmented } from "@/components/leaderboard/segmented";
import { SITE_URL } from "@/lib/config";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

type Tab = "friends" | "requests" | "search";

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [qrOpen, setQrOpen] = useState(false);

  // search state
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const unsubF = subscribeFriends(user.uid, setFriends);
    const unsubR = subscribeFriendRequests(user.uid, setRequests);
    return () => {
      unsubF();
      unsubR();
    };
  }, [user]);

  const excludeUids = useMemo(() => {
    const s = new Set<string>();
    friends.forEach((f) => s.add(f.uid));
    requests.forEach((r) => s.add(r.fromUid));
    if (user) s.add(user.uid);
    return s;
  }, [friends, requests, user]);

  const runSearch = useCallback(async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const found = await searchUsers(q);
      setResults(found.filter((u) => u.uid !== user?.uid));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [q, user]);

  async function send(u: PublicUserProfile) {
    if (!user) return;
    setSentTo((prev) => new Set(prev).add(u.uid));
    try {
      await sendFriendRequest(
        { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL },
        u.uid,
      );
    } catch (e) {
      setSentTo((prev) => {
        const n = new Set(prev);
        n.delete(u.uid);
        return n;
      });
      Alert.alert(t("Friends.add.failed"), e instanceof Error ? e.message : "");
    }
  }

  function confirmRemove(f: Friend) {
    Alert.alert(t("Friends.removeConfirm"), f.displayName, [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => removeFriend(f.uid).catch(() => Alert.alert("失敗")),
      },
    ]);
  }

  async function accept(r: FriendRequest) {
    try {
      await acceptFriendRequest(r.fromUid);
    } catch {
      Alert.alert("失敗");
    }
  }
  async function reject(r: FriendRequest) {
    if (!user) return;
    try {
      await rejectFriendRequest(user.uid, r.requestId);
    } catch {
      Alert.alert("失敗");
    }
  }

  const myQrUrl = user ? `${SITE_URL}/app/friends/add?uid=${user.uid}&openExternalBrowser=1` : "";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.flex}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>好友</Text>
        <Pressable accessibilityLabel={t("Friends.myQr")} onPress={() => setQrOpen(true)} hitSlop={8} style={styles.qrBtn}>
          <Text style={styles.qrBtnText}>▦</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "friends", label: t("Friends.tabs.friends", { count: friends.length }) },
            { value: "requests", label: t("Friends.tabs.requests", { count: requests.length }) },
            { value: "search", label: t("Friends.tabs.search") },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === "friends" ? (
          friends.length === 0 ? (
            <Empty title={t("Friends.emptyFriends.title")} sub={t("Friends.emptyFriends.subtitle")} />
          ) : (
            friends.map((f) => (
              <View key={f.uid} style={styles.row}>
                <UserAvatar name={f.displayName} photoURL={f.photoURL} size={44} />
                <Text style={styles.rowName} numberOfLines={1}>{f.displayName}</Text>
                <Pressable onPress={() => confirmRemove(f)} hitSlop={6} style={styles.rowAction}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))
          )
        ) : null}

        {tab === "requests" ? (
          requests.length === 0 ? (
            <Empty title={t("Friends.emptyRequests")} />
          ) : (
            requests.map((r) => (
              <View key={r.requestId} style={styles.row}>
                <UserAvatar name={r.fromName} photoURL={r.fromPhotoURL} size={44} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{r.fromName}</Text>
                  <Text style={styles.rowSub}>{t("Friends.wantsToAdd")}</Text>
                </View>
                <Pressable onPress={() => accept(r)} style={[styles.smallBtn, styles.accept]}>
                  <Text style={styles.acceptText}>{t("Friends.accept")}</Text>
                </Pressable>
                <Pressable onPress={() => reject(r)} style={[styles.smallBtn, styles.reject]}>
                  <Text style={styles.rejectText}>{t("Friends.reject")}</Text>
                </Pressable>
              </View>
            ))
          )
        ) : null}

        {tab === "search" ? (
          <>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder={t("Friends.searchPlaceholder")}
                placeholderTextColor={colors.ink3}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={runSearch}
              />
              <Pressable onPress={runSearch} style={styles.searchBtn}>
                <Text style={styles.searchBtnText}>🔍</Text>
              </Pressable>
            </View>
            {searching ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} /> : null}
            {results.map((u) => {
              const already = excludeUids.has(u.uid);
              const sent = sentTo.has(u.uid);
              return (
                <View key={u.uid} style={styles.row}>
                  <UserAvatar name={u.displayName} photoURL={u.photoURL} size={44} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>{u.displayName}</Text>
                    {u.city ? <Text style={styles.rowSub}>{u.city}</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => send(u)}
                    disabled={already || sent}
                    style={[styles.smallBtn, already || sent ? styles.sentBtn : styles.accept]}
                  >
                    <Text style={already || sent ? styles.sentText : styles.acceptText}>
                      {already ? "已是好友" : sent ? "已送出" : "加好友"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={styles.qrSheet}>
            <Text style={styles.qrTitle}>{t("Friends.qrTitle")}</Text>
            <Text style={styles.qrInstr}>{t("Friends.qrInstructions")}</Text>
            {user ? <InviteQR url={myQrUrl} size={220} /> : null}
            <View style={styles.qrActions}>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(myQrUrl);
                  Alert.alert(t("Friends.copied"));
                }}
                style={styles.qrActionBtn}
              >
                <Text style={styles.qrActionText}>{t("Friends.copyLink")}</Text>
              </Pressable>
              <Pressable
                onPress={() => Share.share({ message: myQrUrl })}
                style={styles.qrActionBtn}
              >
                <Text style={styles.qrActionText}>分享</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setQrOpen(false)} style={styles.qrClose}>
              <Text style={styles.qrCloseText}>關閉</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.ink, fontWeight: "700", lineHeight: 32 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  qrBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandTint, alignItems: "center", justifyContent: "center" },
  qrBtnText: { fontSize: 18, color: colors.brandDeep },
  tabs: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tab: { flex: 1, minHeight: 44, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.ink3 },
  tabTextOn: { color: colors.brandDeep, fontWeight: "800" },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md },
  rowBody: { flex: 1 },
  rowName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  rowSub: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  rowAction: { padding: 4 },
  removeText: { fontSize: 14, color: colors.ink3, fontWeight: "700" },
  smallBtn: { paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  accept: { backgroundColor: colors.brand },
  acceptText: { fontSize: 13, fontWeight: "800", color: colors.card },
  reject: { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline },
  rejectText: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  sentBtn: { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline },
  sentText: { fontSize: 13, fontWeight: "700", color: colors.ink3 },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchInput: { flex: 1, height: 48, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15, color: colors.ink },
  searchBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: "center", justifyContent: "center" },
  searchBtnText: { fontSize: 18 },
  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, textAlign: "center" },
  emptySub: { fontSize: 13, color: colors.ink2, textAlign: "center", lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  qrSheet: { backgroundColor: colors.card, margin: spacing.lg, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.md, maxWidth: 340 },
  qrTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  qrInstr: { fontSize: 12, color: colors.ink2, textAlign: "center" },
  qrActions: { flexDirection: "row", gap: spacing.md },
  qrActionBtn: { paddingHorizontal: spacing.lg, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" },
  qrActionText: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  qrClose: { paddingHorizontal: spacing.xl, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  qrCloseText: { fontSize: 14, fontWeight: "800", color: colors.card },
});
