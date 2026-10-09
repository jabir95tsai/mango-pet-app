/**
 * First-login onboarding — 1:1 with web apps/web/src/app/onboarding/page.tsx
 * (SHELL-9): PawPrint header, two option cards (create / join a family, each
 * opening the same dialog web uses — family-section CreateFamilyDialog /
 * JoinFamilyDialog) and a quiet "personal mode" skip.
 *
 * The root navigator lands brand-new (non-guest, no family, not yet
 * onboarded) users here. Completing any path sets the onboarded flag and goes
 * to the walks tab (web router.replace("/app/walks")). Guests can't create or
 * join a family (server-rejected), so they see the GuestLockedNotice instead.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowRight, PawPrint, UserPlus, Users, type LucideIcon } from "lucide-react-native";

import { Button, Dialog, Field, Input } from "@/components/ui";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { createFamily, joinFamilyByCode } from "@/lib/families-write";
import { ONBOARDED_KEY } from "@/lib/onboarding";
import { t, useLocale } from "@/lib/i18n";
import { colors, radius, shadows, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

/** Callable error code without the optional "functions/" prefix. */
function callableCode(err: unknown): string {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code.replace(/^functions\//, "") : "";
}

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
    // ── SHELL-8 HOOK POINT — personal-data import wizard ───────────────
    // Web (onboarding/page.tsx) stores `newFamilyId` as pendingImportFamilyId
    // here and renders <ImportWizardDialog familyId onComplete onClose>,
    // which moves the user's personal pets / records into the new family
    // (or short-circuits when there is nothing to import). The import lane
    // should open its wizard for `newFamilyId` at this point and call
    // handleImportComplete() from the wizard's onComplete AND onClose.
    void newFamilyId;
    await handleImportComplete();
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
        onCreated={handleCreatedOrJoined}
      />
      <JoinFamilyDialog
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onJoined={handleCreatedOrJoined}
      />
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

// ── Dialogs — 1:1 with web family-section CreateFamilyDialog / JoinFamilyDialog.

function CreateFamilyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (familyId: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createFamily(name.trim() || t("Family.defaultName"));
      await onCreated(res.familyId);
      onClose();
    } catch (err) {
      setError(
        callableCode(err) === "permission-denied" ? t("Guest.locked.family") : t("Error.title"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      visible={open}
      onClose={onClose}
      title={t("Family.createDialog.title")}
      description={t("Family.createDialog.instructions")}
      dismissible={!busy}
      contentStyle={styles.dialogBody}
      footer={
        <View style={styles.dialogActions}>
          <Button
            variant="ghost"
            label={t("Common.cancel")}
            onPress={onClose}
            disabled={busy}
          />
          <Button label={t("Family.createDialog.submit")} onPress={submit} loading={busy} />
        </View>
      }
    >
      <Field label={t("Family.createDialog.nameLabel")}>
        <Input
          value={name}
          error={error}
          onChangeText={setName}
          placeholder={t("Family.createDialog.namePlaceholder")}
          maxLength={40}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel={t("Family.createDialog.nameLabel")}
        />
      </Field>
    </Dialog>
  );
}

function JoinFamilyDialog({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (familyId: string) => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (busy) return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t("Family.joinDialog.errInvalidCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await joinFamilyByCode(trimmed);
      if (res.alreadyMember) {
        setError(t("Family.joinDialog.errAlready"));
        return;
      }
      await onJoined(res.familyId);
      onClose();
    } catch (err) {
      const c = callableCode(err);
      setError(
        c === "invalid-argument" || c === "not-found"
          ? t("Family.joinDialog.errInvalidCode")
          : c === "permission-denied"
            ? t("Guest.locked.family")
            : t("Join.error"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      visible={open}
      onClose={onClose}
      title={t("Family.joinDialog.title")}
      description={t("Family.joinDialog.instructions")}
      dismissible={!busy}
      contentStyle={styles.dialogBody}
      footer={
        <View style={styles.dialogActions}>
          <Button
            variant="ghost"
            label={t("Common.cancel")}
            onPress={onClose}
            disabled={busy}
          />
          <Button
            label={t("Family.joinDialog.submit")}
            onPress={submit}
            loading={busy}
            disabled={code.length !== 6}
          />
        </View>
      }
    >
      <Input
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        error={error}
        accessibilityLabel={t("Family.inviteCode")}
        style={styles.codeInput}
      />
    </Dialog>
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
