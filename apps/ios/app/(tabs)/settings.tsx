/**
 * Settings — 1:1 with the web card stack (apps/web/src/app/app/settings/page.tsx):
 * RouteHeader → profile (avatar + name/email + friends disc, black sign-out
 * pill) → guest upgrade → achievements entry → latest photos → family →
 * push → engagement push → walk auto-photo → leaderboard visibility →
 * blocked users → language → privacy & data → danger zone → legal links.
 *
 * Gating matches web: family shows a locked notice for guests; engagement
 * push, walk auto-photo, export and the danger zone show for any signed-in
 * user; leaderboard visibility, blocked users and the friends disc stay
 * hidden for guests.
 *
 * One users/{uid} read feeds every pref section. The tab stays mounted (web
 * remounts per navigation), so a focus refreshes prefs + photos + members
 * only when they are older than FOCUS_STALE_MS (the photo preview alone is
 * 4 source queries); pull-to-refresh always refreshes, incl. the family.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, Trophy, Users } from "lucide-react-native";

import { useTabBarScrollInsets } from "@/lib/liquid-glass";
import { signOut } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { getUserPrefs, type UserPrefs } from "@/lib/user-prefs";
import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { RouteHeader } from "@/components/ui";
import { UserAvatar } from "@/components/feed/user-avatar";
import { PushToggle } from "@/components/settings/push-toggle";
import { EngagementPushSection } from "@/components/settings/engagement-push-section";
import { WalkAutoPhotoSection, LeaderboardVisibilitySection } from "@/components/settings/prefs-sections";
import { BlockedUsersSection } from "@/components/settings/blocked-users-section";
import { GuestUpgradeSection } from "@/components/settings/guest-upgrade-section";
import { PhotosPreviewSection } from "@/components/settings/photos-preview-section";
import { FamilySection } from "@/components/settings/family-section";
import { ExportDataSection } from "@/components/settings/export-data-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { LanguageSection } from "@/components/settings/language-switcher";
import { SettingsCard, SettingsIconDisc } from "@/components/settings/settings-card";
import { t } from "@/lib/i18n";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

/** Skip focus refreshes for data younger than this (Firestore read cost). */
const FOCUS_STALE_MS = 60_000;

export default function SettingsScreen() {
  const tabBarInsets = useTabBarScrollInsets();
  const { user, isGuest } = useAuth();
  const { refresh: refreshFamily } = useFamily();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshAt = useRef(Date.now());
  const uid = user?.uid ?? null;

  const name = user?.displayName ?? (isGuest ? t("Settings.guestName") : (user?.email?.split("@")[0] ?? ""));

  const loadPrefs = useCallback(async () => {
    if (!uid) return;
    try {
      setPrefs(await getUserPrefs(uid));
    } catch {
      // Sections fall back to their defaults rather than spinning forever.
      setPrefs((p) => p ?? {});
    }
  }, [uid]);

  useEffect(() => {
    setPrefs(undefined);
    void loadPrefs();
  }, [loadPrefs]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastRefreshAt.current < FOCUS_STALE_MS) return;
      lastRefreshAt.current = Date.now();
      void loadPrefs();
      setReloadKey((k) => k + 1);
    }, [loadPrefs]),
  );

  async function onRefresh() {
    setRefreshing(true);
    lastRefreshAt.current = Date.now();
    try {
      await Promise.allSettled([loadPrefs(), refreshFamily()]);
    } finally {
      setReloadKey((k) => k + 1);
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      Alert.alert(t("Settings.signOutFailed.title"), t("Settings.signOutFailed.body"));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <ScrollView
        {...tabBarInsets}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.brand} />
        }
      >
        <RouteHeader title={t("Nav.settings")} />

        <View style={styles.stack}>
          {/* Profile */}
          <SettingsCard style={styles.profile}>
            <View style={styles.profileRow}>
              <UserAvatar name={name || "Guest"} photoURL={user?.photoURL} size={48} />
              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>
                  {name || "Guest"}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {user?.email ?? "—"}
                </Text>
              </View>
              {!isGuest ? (
                <Pressable
                  onPress={() => router.push("/friends")}
                  accessibilityRole="button"
                  accessibilityLabel={t("Settings.friendsLink")}
                  style={({ pressed }) => [styles.friendsDisc, pressed && styles.dim]}
                >
                  <Users size={20} color={colors.brandDeep} strokeWidth={1.8} />
                </Pressable>
              ) : null}
            </View>
            {user ? (
              <Pressable
                disabled={signingOut}
                onPress={() => void handleSignOut()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.signOut, (pressed || signingOut) && styles.dim]}
              >
                <Text style={styles.signOutText}>{t("Auth.signOut")}</Text>
              </Pressable>
            ) : null}
          </SettingsCard>

          {isGuest ? <GuestUpgradeSection /> : null}

          {/* Achievements entry — everyone, guests included (web §E) */}
          <Pressable
            onPress={() => router.push("/achievements")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          >
            <View style={styles.linkLeft}>
              <SettingsIconDisc>
                <Trophy size={16} color={colors.brandDeep} strokeWidth={2} />
              </SettingsIconDisc>
              <View style={styles.profileText}>
                <Text style={styles.linkTitle}>{t("Settings.achievements.title")}</Text>
                <Text style={styles.linkSub}>{t("Settings.achievements.subtitle")}</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.ink3} strokeWidth={2} />
          </Pressable>

          {user ? <PhotosPreviewSection reloadKey={reloadKey} /> : null}

          <FamilySection reloadKey={reloadKey} />

          <PushToggle />
          {user ? <EngagementPushSection prefs={prefs} /> : null}
          {user ? <WalkAutoPhotoSection prefs={prefs} /> : null}
          {user && !isGuest ? <LeaderboardVisibilitySection prefs={prefs} /> : null}
          {user && !isGuest ? <BlockedUsersSection prefs={prefs} /> : null}

          <LanguageSection />

          {user ? <ExportDataSection /> : null}

          {/* Danger zone — red border + warning icon, no shadow (web) */}
          {user ? (
            <View style={styles.dangerCard}>
              <View style={styles.dangerHeader}>
                <AlertTriangle size={20} color={colors.danger} strokeWidth={2} />
                <Text style={styles.dangerTitle}>{t("Settings.dangerZone.title")}</Text>
              </View>
              <Text style={styles.dangerSubtitle}>{t("Settings.dangerZone.subtitle")}</Text>
              <DeleteAccountSection />
            </View>
          ) : null}

          {/* Privacy / Terms (App Store required; content reused from web) */}
          <View style={styles.legalRow}>
            <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/privacy`)} hitSlop={6}>
              <Text style={styles.legalLink}>{t("Common.privacy")}</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/terms`)} hitSlop={6}>
              <Text style={styles.legalLink}>{t("Common.terms")}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  // web: flex flex-col gap-4
  stack: { gap: spacing.lg },
  profile: { gap: spacing.lg },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  profileText: { flex: 1, minWidth: 0 },
  // web: truncate font-medium / text-sm ink-2
  name: { fontSize: 16, fontWeight: "500", color: colors.ink },
  email: { fontSize: 14, color: colors.ink2, marginTop: 1 },
  friendsDisc: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // web: h-10 self-start rounded-pill bg-ink px-4 text-sm font-medium white
  signOut: {
    alignSelf: "flex-start",
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  dim: { opacity: 0.7 },
  // web achievements Link: flex justify-between gap-3 rounded-xl border p-6 shadow-card
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.xl,
    shadowColor: "#50320a",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  linkCardPressed: { opacity: 0.7 },
  linkLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.md },
  linkTitle: { fontSize: 16, fontWeight: "500", color: colors.ink },
  linkSub: { fontSize: 14, color: colors.ink2 },
  dangerCard: {
    gap: spacing.md,
    backgroundColor: "rgba(254,242,242,0.5)", // red-50/50
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(252,165,165,0.7)", // red-300/70
    padding: spacing.xl,
  },
  dangerHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dangerTitle: { fontSize: 16, fontWeight: "600", color: colors.dangerDeep },
  dangerSubtitle: { fontSize: 14, lineHeight: 20, color: "rgba(127,29,29,0.8)" }, // red-900/80
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legalLink: { fontSize: 12, color: colors.ink3, textDecorationLine: "underline" },
  legalDot: { fontSize: 12, color: colors.ink3 },
});
