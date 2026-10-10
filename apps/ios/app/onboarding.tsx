/**
 * First-login onboarding — 1:1 with web apps/web/src/app/onboarding/page.tsx
 * (SHELL-9): PawPrint header, two option cards (create / join a family, each
 * opening the shared CreateFamilyDialog / JoinFamilyDialog, then the import
 * wizard like web) and a quiet "personal mode" skip.
 *
 * The root navigator lands brand-new (non-guest, no family, not yet
 * onboarded) users here. Completing any path sets the onboarded flag and goes
 * to the walks tab (web router.replace("/app/walks")). Guests can't create or
 * join a family (server-rejected), so they see the GuestLockedNotice instead.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowRight, PawPrint, UserPlus, Users, type LucideIcon } from "lucide-react-native";

import { Button } from "@/components/ui";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { CreateFamilyDialog, JoinFamilyDialog } from "@/components/family/family-dialogs";
import { ImportWizardSheet } from "@/components/family/import-wizard-sheet";
import { ONBOARDED_KEY } from "@/lib/onboarding";
import { t, useLocale } from "@/lib/i18n";
import { colors, radius, shadows, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

export default function OnboardingScreen() {
  useLocale();
  const router = useRouter();
  const { isGuest } = useAuth();
  const { family, refresh } = useFamily();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  // True from a successful create/join until we navigate away, so the
  // refreshed family doesn't flash the "already in a family" fallback.
  const [completing, setCompleting] = useState(false);
  const [pendingImportFamilyId, setPendingImportFamilyId] = useState<string | null>(null);

  async function finish() {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // Best-effort: worst case onboarding shows again on the next sign-in.
    }
    router.replace("/(tabs)/walks");
  }

  async function handleCreatedOrJoined(newFamilyId: string) {
    setCompleting(true);
    // refresh() so the new scope is live before anything reads it (web).
    await refresh();
    // Web: offer to move personal-mode data into the new family (the wizard
    // closes itself when there is nothing to import), then finish.
    setPendingImportFamilyId(newFamilyId);
  }

  async function handleImportComplete() {
    await refresh();
    await finish();
  }

  // Already in a family → this page isn't relevant (web renders the same
  // fallback rather than redirecting).
  if (family && !completing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.already}>
          <Text style={styles.alreadyText}>{t("Onboarding.alreadyInFamily")}</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/(tabs)/walks")}
            hitSlop={12}
            style={({ pressed }) => [styles.alreadyLink, pressed && styles.dim]}
          >
            <Text style={styles.alreadyLinkText}>{t("Onboarding.goToApp")}</Text>
            <ArrowRight size={16} color={colors.brandDeep} strokeWidth={2} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTile}>
            <PawPrint size={28} color={colors.brandDeep} strokeWidth={2} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {t("Onboarding.title")}
          </Text>
          <Text style={styles.subtitle}>{t("Onboarding.subtitle")}</Text>
        </View>

        <View style={styles.options}>
          {isGuest ? (
            <GuestLockedNotice feature="family" />
          ) : (
            <>
              <OptionCard
                icon={Users}
                title={t("Onboarding.createTitle")}
                description={t("Onboarding.createDescription")}
                actionLabel={t("Onboarding.createAction")}
                onPress={() => setShowCreate(true)}
              />
              <OptionCard
                icon={UserPlus}
                title={t("Onboarding.joinTitle")}
                description={t("Onboarding.joinDescription")}
                actionLabel={t("Onboarding.joinAction")}
                onPress={() => setShowJoin(true)}
              />
            </>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={finish}
            style={({ pressed }) => [styles.skip, pressed && styles.dim]}
          >
            <Text style={styles.skipText}>{t("Onboarding.skipAction")}</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>{t("Onboarding.footerHint")}</Text>
      </ScrollView>

      <CreateFamilyDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={handleCreatedOrJoined}
      />
      <JoinFamilyDialog
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onDone={handleCreatedOrJoined}
      />
      {pendingImportFamilyId ? (
        <ImportWizardSheet
          familyId={pendingImportFamilyId}
          onClose={() => {
            setPendingImportFamilyId(null);
            void handleImportComplete();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** web OptionCard: on phone widths `flex flex-col gap-3` — icon tile, text,
 *  then a full-width sm Button (sm:flex-row only applies from 640px). */
function OptionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTile}>
        <Icon size={20} color={colors.brandDeep} strokeWidth={2} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
      </View>
      <Button
        size="sm"
        label={actionLabel}
        accessibilityLabel={`${actionLabel} · ${title}`}
        onPress={onPress}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  dim: { opacity: 0.6 },
  // web: mx-auto flex max-w-xl flex-col gap-6 p-6
  scroll: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  // web: header text-center
  header: { alignItems: "center" },
  // web: mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-amber-100 text-amber-700
  headerTile: {
    width: 56,
    height: 56,
    marginBottom: spacing.md,
    borderRadius: radius.xl2,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // web: text-2xl font-bold
  title: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.ink, textAlign: "center" },
  // web: mt-2 text-sm text-zinc-600
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink2,
    textAlign: "center",
  },
  // web: flex flex-col gap-3
  options: { gap: spacing.md },
  // web: flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white p-4
  //      shadow-sm (radius → --radius-lg, docs/design-system.md §2)
  card: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    ...shadows.card,
  },
  // web: grid size-10 rounded-lg bg-amber-100 text-amber-700
  cardTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { minWidth: 0 },
  // web: text-sm font-semibold
  cardTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.ink },
  // web: text-xs text-zinc-500 mt-0.5
  cardDesc: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink3 },
  // web: mt-2 self-center text-sm text-zinc-500
  skip: {
    marginTop: spacing.sm,
    alignSelf: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  skipText: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  // web: text-center text-xs text-zinc-400
  footer: { fontSize: 12, lineHeight: 16, color: colors.ink3, textAlign: "center" },
  // web dialog form: flex flex-col gap-4
  dialogBody: { gap: spacing.lg },
  // web: flex justify-end gap-3
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
  // web: font-mono text-2xl text-center tracking-widest tabular-nums
  codeInput: {
    height: 52,
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  // web fallback: mx-auto max-w-md p-6 text-center text-sm text-zinc-500
  already: {
    flex: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  alreadyText: { fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: "center" },
  // web: mt-4 inline-flex items-center gap-1 text-amber-700
  alreadyLink: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 44,
  },
  alreadyLinkText: { fontSize: 14, color: colors.brandDeep },
});
