/**
 * Settings (P5a) — 1:1 with the web settings card-stack. Profile card (avatar +
 * name/email + 👥 friends disc, with a black 登出 pill below the name), guest
 * upgrade, latest-photos card, inline family card, push toggle, engagement
 * opt-outs, walk auto-photo, leaderboard visibility, data export, delete
 * account, legal links. Guest gating matches web.
 */
import { Linking, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { signOut } from "@/lib/auth";
import { GlassBackground } from "@/components/ui/GlassBackground";
import { SITE_URL } from "@/lib/config";
import { useAuth } from "@/state/auth-context";
import { UserAvatar } from "@/components/feed/user-avatar";
import { PushToggle } from "@/components/settings/push-toggle";
import { EngagementPushSection } from "@/components/settings/engagement-push-section";
import { WalkAutoPhotoSection, LeaderboardVisibilitySection } from "@/components/settings/prefs-sections";
import { GuestUpgradeSection } from "@/components/settings/guest-upgrade-section";
import { PhotosPreviewSection } from "@/components/settings/photos-preview-section";
import { FamilySection } from "@/components/settings/family-section";
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
    <GlassBackground>
    <SafeAreaView edges={["top"]} style={styles.flexGlass}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card [S5a] — avatar + name/email + 👥 friends disc;
            black 登出 pill sits below the name (web parity). */}
        <View style={styles.profile}>
          <View style={styles.profileRow}>
            <UserAvatar name={name} photoURL={user?.photoURL} size={48} />
            <View style={styles.profileText}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.email} numberOfLines={1}>
                {isGuest ? t("Family.personalMode") : user?.email ?? "—"}
              </Text>
            </View>
            {!isGuest ? (
              <Pressable
                onPress={() => router.push("/friends")}
                accessibilityRole="button"
                accessibilityLabel={t("Settings.friendsLink")}
                style={({ pressed }) => [styles.friendsDisc, pressed && styles.dim]}
              >
                <Text style={styles.friendsIcon}>👥</Text>
              </Pressable>
            ) : null}
          </View>
          {user ? (
            <Pressable
              onPress={() => void signOut()}
              style={({ pressed }) => [styles.signOut, pressed && styles.dim]}
            >
              <Text style={styles.signOutText}>{t("Auth.signOut")}</Text>
            </Pressable>
          ) : null}
        </View>

        {isGuest ? <GuestUpgradeSection /> : null}

        {/* Latest photos [S5c] */}
        {user ? <PhotosPreviewSection /> : null}

        {/* Family — expanded inline card [S5d] (non-guest; family needs a
            real identity, matching web's guest-locked behaviour). */}
        {!isGuest ? <FamilySection /> : null}

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
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flexGlass: { flex: 1, backgroundColor: "transparent" },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.ink },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  profile: {
    gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.5)",
    padding: spacing.lg,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  profileText: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  email: { fontSize: 13, color: colors.ink2, marginTop: 1 },
  friendsDisc: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsIcon: { fontSize: 19 },
  signOut: {
    alignSelf: "flex-start",
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  dim: { opacity: 0.7 },
  danger: { marginTop: spacing.lg },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  legalLink: { fontSize: 12, color: colors.ink3, textDecorationLine: "underline" },
  legalDot: { fontSize: 12, color: colors.ink3 },
});
