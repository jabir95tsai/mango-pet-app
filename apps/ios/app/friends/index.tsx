/**
 * Friends — 1:1 with web /app/friends:
 *  - back row → RouteHeader (Nav.friends + subtitle) with a secondary
 *    "我的 QR" button; guests get only the locked notice (no tabs / QR)
 *  - tabs: friends (realtime, remove with confirm) / requests (accept Check on
 *    leaf tint, reject UserX) / search (gradient Search button, no-results
 *    line, add → already friends / sent states)
 *  - loading until each listener's first snapshot; listener and action
 *    errors render inline in red (no native "failed" alerts)
 *  - empty states are the shared EmptyState card with a Users tile
 *  - "My QR" sheet: QR with the Mango logo, display name, copy (→ Check for
 *    2s) + back; iOS keeps a native Share action
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft, Check, Copy, QrCode, Search, Share as ShareIcon, UserMinus, UserPlus, Users, UserX } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import type { Friend, FriendRequest, PublicUserProfile } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { subscribeFriends, subscribeFriendRequests, searchUsers } from "@/lib/friends-read";
import { acceptFriendRequest, rejectFriendRequest, removeFriend, sendFriendRequest } from "@/lib/friends-write";
import { resolveUserDisplayName } from "@/lib/auth-profile";
import { UserAvatar } from "@/components/feed/user-avatar";
import { InviteQR } from "@/components/family/invite-qr";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { Segmented } from "@/components/leaderboard/segmented";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SITE_URL } from "@/lib/config";
import { t } from "@/lib/i18n";
import { colors, mangoGradient, radius, shadows, spacing, type, CONTENT_MAX_WIDTH } from "@/theme/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../assets/icon.png");

type Tab = "friends" | "requests" | "search";

function messageOf(e: unknown): string {
  return e instanceof Error && e.message ? e.message : t("Friends.add.failed");
}

export default function FriendsScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const uid = user?.uid ?? null;
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friendsReady, setFriendsReady] = useState(false);
  const [requestsReady, setRequestsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // search state
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFriendsReady(false);
    setRequestsReady(false);
    setLoadError(null);
    if (!uid || isGuest) return;
    const onErr = (e: unknown) => setLoadError(e instanceof Error && e.message ? e.message : t("Error.title"));
    const unsubF = subscribeFriends(
      uid,
      (f) => {
        setFriends(f);
        setFriendsReady(true);
      },
      (e) => {
        setFriendsReady(true);
        onErr(e);
      },
    );
    const unsubR = subscribeFriendRequests(
      uid,
      (r) => {
        setRequests(r);
        setRequestsReady(true);
      },
      (e) => {
        setRequestsReady(true);
        onErr(e);
      },
    );
    return () => {
      unsubF();
      unsubR();
    };
  }, [uid, isGuest]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const excludeUids = useMemo(() => {
    const s = new Set<string>();
    friends.forEach((f) => s.add(f.uid));
    requests.forEach((r) => s.add(r.fromUid));
    if (uid) s.add(uid);
    return s;
  }, [friends, requests, uid]);

  const runSearch = useCallback(async () => {
    if (!q.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const found = await searchUsers(q);
      setResults(found.filter((u) => u.uid !== uid));
    } catch (e) {
      setResults([]);
      setError(messageOf(e));
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [q, uid, searching]);

  async function send(u: PublicUserProfile) {
    if (!user) return;
    setError(null);
    setSentTo((prev) => new Set(prev).add(u.uid));
    try {
      await sendFriendRequest(
        { uid: user.uid, displayName: resolveUserDisplayName(user), photoURL: user.photoURL },
        u.uid,
      );
    } catch (e) {
      setSentTo((prev) => {
        const n = new Set(prev);
        n.delete(u.uid);
        return n;
      });
      setError(messageOf(e));
    }
  }

  function confirmRemove(f: Friend) {
    Alert.alert(t("Friends.removeConfirm"), f.displayName, [
      { text: t("Common.cancel"), style: "cancel" },
      {
        text: t("Common.delete"),
        style: "destructive",
        onPress: async () => {
          setBusy(f.uid);
          setError(null);
          try {
            await removeFriend(f.uid);
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  async function accept(r: FriendRequest) {
    setBusy(r.requestId);
    setError(null);
    try {
      await acceptFriendRequest(r.fromUid);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  async function reject(r: FriendRequest) {
    if (!uid) return;
    setBusy(r.requestId);
    setError(null);
    try {
      await rejectFriendRequest(uid, r.requestId);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await Clipboard.setStringAsync(myQrUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const myQrUrl = uid ? `${SITE_URL}/app/friends/add?uid=${uid}&openExternalBrowser=1` : "";
  const ready = tab === "friends" ? friendsReady : tab === "requests" ? requestsReady : true;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              {t("Nav.friends")}
            </Text>
            <Text style={styles.subtitle}>{t("Friends.subtitle")}</Text>
          </View>
          {!isGuest ? (
            <Button
              label={t("Friends.myQr")}
              variant="secondary"
              size="sm"
              icon={<QrCode size={16} color={colors.ink} strokeWidth={2} />}
              onPress={() => setQrOpen(true)}
            />
          ) : null}
        </View>

        {isGuest ? (
          <GuestLockedNotice feature="friends" />
        ) : (
          <>
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

            {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            {!ready ? (
              <ActivityIndicator color={colors.brand} style={styles.loader} />
            ) : tab === "friends" ? (
              friends.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("Friends.emptyFriends.title")}
                  description={t("Friends.emptyFriends.subtitle")}
                />
              ) : (
                <View style={styles.list}>
                  {friends.map((f) => (
                    <View key={f.uid} style={styles.row}>
                      <UserAvatar name={f.displayName} photoURL={f.photoURL} size={40} />
                      <Text style={styles.rowName} numberOfLines={1}>
                        {f.displayName}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Common.delete")}
                        onPress={() => confirmRemove(f)}
                        disabled={busy === f.uid}
                        style={[styles.iconBtn, busy === f.uid && styles.disabled]}
                      >
                        {({ pressed }) => (
                          <UserMinus size={16} color={pressed ? colors.danger : colors.ink2} strokeWidth={2} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              )
            ) : tab === "requests" ? (
              requests.length === 0 ? (
                <EmptyState icon={Users} title={t("Friends.emptyRequests")} />
              ) : (
                <View style={styles.list}>
                  {requests.map((r) => (
                    <View key={r.requestId} style={styles.row}>
                      <UserAvatar name={r.fromName} photoURL={r.fromPhotoURL} size={40} />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {r.fromName}
                        </Text>
                        <Text style={styles.rowSub}>{t("Friends.wantsToAdd")}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Friends.accept")}
                        onPress={() => void accept(r)}
                        disabled={busy === r.requestId}
                        style={({ pressed }) => [
                          styles.iconBtn,
                          styles.acceptBtn,
                          pressed && styles.pressed,
                          busy === r.requestId && styles.disabled,
                        ]}
                      >
                        <Check size={16} color={colors.leaf} strokeWidth={2.2} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Friends.reject")}
                        onPress={() => void reject(r)}
                        disabled={busy === r.requestId}
                        style={[styles.iconBtn, busy === r.requestId && styles.disabled]}
                      >
                        {({ pressed }) => (
                          <UserX size={16} color={pressed ? colors.danger : colors.ink2} strokeWidth={2} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              )
            ) : (
              <>
                <View style={styles.searchRow}>
                  <Input
                    value={q}
                    onChangeText={setQ}
                    placeholder={t("Friends.searchPlaceholder")}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => void runSearch()}
                    containerStyle={styles.searchInput}
                    accessibilityLabel={t("Friends.searchPlaceholder")}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Friends.tabs.search")}
                    onPress={() => void runSearch()}
                    disabled={searching}
                    style={({ pressed }) => [styles.searchBtn, (pressed || searching) && styles.pressed]}
                  >
                    <LinearGradient
                      colors={mangoGradient.colors}
                      locations={mangoGradient.locations}
                      start={mangoGradient.start}
                      end={mangoGradient.end}
                      style={styles.searchFill}
                    >
                      <Search size={16} color="#ffffff" strokeWidth={2.4} />
                    </LinearGradient>
                  </Pressable>
                </View>
                {searching ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
                <View style={styles.list}>
                  {results.map((u) => {
                    const already = excludeUids.has(u.uid);
                    const sent = sentTo.has(u.uid);
                    return (
                      <View key={u.uid} style={styles.row}>
                        <UserAvatar name={u.displayName} photoURL={u.photoURL} size={40} />
                        <View style={styles.rowBody}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {u.displayName}
                          </Text>
                          {u.city ? <Text style={styles.rowSub}>{u.city}</Text> : null}
                        </View>
                        <Button
                          size="sm"
                          variant={already || sent ? "ghost" : "primary"}
                          disabled={already || sent}
                          label={
                            already
                              ? t("Friends.alreadyFriends")
                              : sent
                                ? t("Friends.requestSent")
                                : t("Friends.addFriend")
                          }
                          icon={already || sent ? undefined : <UserPlus size={14} color="#ffffff" strokeWidth={2} />}
                          onPress={() => void send(u)}
                        />
                      </View>
                    );
                  })}
                </View>
                {searched && !searching && results.length === 0 ? (
                  <Text style={styles.noResults}>{t("Common.none")}</Text>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      {!isGuest ? (
        <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setQrOpen(false)}>
            <Pressable style={styles.qrSheet} accessibilityViewIsModal>
              <Text style={styles.qrTitle} accessibilityRole="header">
                {t("Friends.qrTitle")}
              </Text>
              <Text style={styles.qrInstr}>{t("Friends.qrInstructions")}</Text>
              {uid ? <InviteQR url={myQrUrl} size={240} logo={LOGO} /> : null}
              <Text style={styles.qrName}>{resolveUserDisplayName(user) ?? ""}</Text>
              <View style={styles.qrActions}>
                <Button
                  label={copied ? t("Friends.copied") : t("Friends.copyLink")}
                  variant="secondary"
                  icon={
                    copied ? (
                      <Check size={16} color={colors.ink} strokeWidth={2} />
                    ) : (
                      <Copy size={16} color={colors.ink} strokeWidth={2} />
                    )
                  }
                  onPress={() => void copyLink()}
                  style={styles.flex1}
                />
                <Button label={t("Common.back")} onPress={() => setQrOpen(false)} style={styles.flex1} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Friends.share")}
                onPress={() => void Share.share({ message: myQrUrl })}
                hitSlop={8}
                style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
              >
                <ShareIcon size={18} color={colors.brandDeep} strokeWidth={2} />
                <Text style={styles.shareText}>{t("Friends.share")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  // web back row: p-2 rounded-lg, ArrowLeft size-5
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...type.h1, color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 24, color: colors.ink2 },
  tabs: { marginBottom: spacing.lg },
  loader: { marginVertical: spacing.lg },
  error: { fontSize: 14, color: colors.danger, marginBottom: spacing.md },
  list: { gap: spacing.md },
  // web: card rounded-lg border bg-white p-3 shadow-sm
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    ...shadows.card,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  rowSub: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  acceptBtn: { backgroundColor: colors.leafTint },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  searchInput: { flex: 1 },
  searchBtn: { width: 48, height: 48, borderRadius: radius.md, overflow: "hidden", ...shadows.mango },
  searchFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  noResults: { textAlign: "center", fontSize: 14, color: colors.ink2, paddingVertical: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  qrSheet: {
    backgroundColor: colors.card,
    margin: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    width: "92%",
    maxWidth: 380,
  },
  qrTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  qrInstr: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  qrName: { fontSize: 14, fontWeight: "500", color: colors.ink },
  qrActions: { flexDirection: "row", gap: spacing.sm, width: "100%" },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: spacing.md },
  shareText: { fontSize: 14, fontWeight: "600", color: colors.brandDeep },
});
