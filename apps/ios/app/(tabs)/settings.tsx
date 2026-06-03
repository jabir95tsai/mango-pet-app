/**
 * Settings (P5a) — mirrors the web settings page section order: profile + sign
 * out, guest upgrade (guests), photos + family links, push toggle, engagement
 * opt-outs, walk auto-photo, leaderboard visibility, (data export → P5b), delete
 * account. Guest-only / non-guest gating matches web.
 */
import { Linking, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { signOut } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { useAuth } from "@/state/auth-context";
import { UserAvatar } from "@/components/feed/user-avatar";
import { PushToggle } from "@/components/settings/push-toggle";
import { EngagementPushSection } from "@/components/settings/engagement-push-section";
import { WalkAutoPhotoSection, LeaderboardVisibilitySection } from "@/components/settings/prefs-sections";
import { GuestUpgradeSection } from "@/components/settings/guest-upgrade-section";
import { ExportDataSection } from "@/components/settings/export-data-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGuest = !!user?.isAnonymous;
  const name = user?.displayName ?? (isGuest ? "訪客" : user?.email?.split("@")[0] ?? "");

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profile}>
          <UserAvatar name={name} photoURL={user?.photoURL} size={56} />
          <View style={styles.profileText}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {isGuest ? t("Family.personalMode") : user?.email ?? ""}
            </Text>
          </View>
          <Pressable onPress={() => void signOut()} style={styles.signOut}>
            <Text style={styles.signOutText}>登出</Text>
          </Pressable>
        </View>

        {isGuest ? <GuestUpgradeSection /> : null}

        {/* Links */}
        <Pressable onPress={() => router.push("/photos")} style={styles.linkRow}>
          <Text style={styles.linkText}>🖼️  {t("Settings.photosLink")}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/family")} style={styles.linkRow}>
          <Text style={styles.linkText}>👨‍👩‍👧  {t("Family.title")}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        {!isGuest ? (
          <Pressable onPress={() => router.push("/friends")} style={styles.linkRow}>
            <Text style={styles.linkText}>🧑‍🤝‍🧑  {t("Settings.friendsLink")}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}

        <PushToggle />
        {!isGuest ? <EngagementPushSection /> : null}
        {!isGuest ? <WalkAutoPhotoSection /> : null}
        {!isGuest ? <LeaderboardVisibilitySection /> : null}

        {!isGuest ? <ExportDataSection /> : null}

        {!isGuest ? (
          <View style={styles.danger}>
            <DeleteAccountSection />
          </View>
        ) : null}

        {/* Privacy / Terms (App Store required; content reused from web) */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(`${SITE_URL}/privacy`)} hitSlop={6}>
            <Text style={styles.legalLink}>{t("Common.privacy")}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL(`${SITE_URL}/terms`)} hitSlop={6}>
            <Text style={styles.legalLink}>{t("Common.terms")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.ink },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  profileText: { flex: 1 },
  name: { fontSize: 16, fontWeight: "800", color: colors.ink },
  email: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  signOut: {
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontSize: 13, fontWeight: "700", color: colors.cookie },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  linkText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  chevron: { fontSize: 22, color: colors.ink3 },
  danger: { marginTop: spacing.lg },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  legalLink: { fontSize: 12, color: colors.ink3, textDecorationLine: "underline" },
  legalDot: { fontSize: 12, color: colors.ink3 },
});
