/**
 * First-login onboarding (P7) — create / join a family, or skip into personal
 * mode. Mirrors web /onboarding (parity-lite). Auto-skips (handled by the root
 * navigator) when the user already has a family. Completing any path sets the
 * onboarded flag and routes into the app.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useFamily } from "@/state/family-context";
import { createFamily, joinFamilyByCode } from "@/lib/families-write";
import { ONBOARDED_KEY } from "@/lib/onboarding";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export default function OnboardingScreen() {
  const router = useRouter();
  const { refresh } = useFamily();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    router.replace("/(tabs)/walks");
  }

  async function doCreate() {
    setBusy(true);
    setError(null);
    try {
      await createFamily(name);
      await refresh();
      await finish();
    } catch {
      setError("建立失敗，請稍後再試");
      setBusy(false);
    }
  }

  async function doJoin() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("Family.joinDialog.errInvalidCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await joinFamilyByCode(code);
      await refresh();
      await finish();
    } catch {
      setError(t("Family.joinDialog.errInvalidCode"));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🥭</Text>
        <Text style={styles.title}>{t("Onboarding.title")}</Text>
        <Text style={styles.subtitle}>{t("Onboarding.subtitle")}</Text>

        {mode === "choose" ? (
          <>
            <Pressable onPress={() => setMode("create")} style={styles.card}>
              <Text style={styles.cardTitle}>👨‍👩‍👧 {t("Onboarding.createTitle")}</Text>
              <Text style={styles.cardDesc}>{t("Onboarding.createDescription")}</Text>
            </Pressable>
            <Pressable onPress={() => setMode("join")} style={styles.card}>
              <Text style={styles.cardTitle}>🔑 {t("Onboarding.joinTitle")}</Text>
              <Text style={styles.cardDesc}>{t("Onboarding.joinDescription")}</Text>
            </Pressable>
            <Pressable onPress={finish} style={styles.skip}>
              <Text style={styles.skipText}>{t("Onboarding.skipAction")}</Text>
            </Pressable>
            <Text style={styles.footer}>{t("Onboarding.footerHint")}</Text>
          </>
        ) : mode === "create" ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>{t("Family.createDialog.nameLabel")}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("Family.createDialog.namePlaceholder")}
              placeholderTextColor={colors.ink3}
              maxLength={30}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={doCreate} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.card} /> : <Text style={styles.primaryText}>{t("Onboarding.createAction")}</Text>}
            </Pressable>
            <Pressable onPress={() => { setMode("choose"); setError(null); }} style={styles.back}>
              <Text style={styles.backText}>‹ 返回</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>{t("Family.inviteCode")}</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={colors.ink3}
              keyboardType="number-pad"
              maxLength={6}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={doJoin} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.card} /> : <Text style={styles.primaryText}>{t("Onboarding.joinAction")}</Text>}
            </Pressable>
            <Pressable onPress={() => { setMode("choose"); setError(null); }} style={styles.back}>
              <Text style={styles.backText}>‹ 返回</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, gap: spacing.md, flexGrow: 1, justifyContent: "center" },
  logo: { fontSize: 56, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "900", color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.ink2, textAlign: "center", lineHeight: 20, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  cardDesc: { fontSize: 13, color: colors.ink2, lineHeight: 18 },
  skip: { marginTop: spacing.sm, alignItems: "center", paddingVertical: spacing.md },
  skipText: { fontSize: 15, fontWeight: "700", color: colors.brandDeep },
  footer: { fontSize: 11, color: colors.ink3, textAlign: "center", lineHeight: 16 },
  form: { gap: spacing.sm },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  input: { height: 52, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
  codeInput: { fontSize: 24, fontWeight: "800", letterSpacing: 8, textAlign: "center" },
  error: { fontSize: 12, color: colors.cookie },
  primary: { marginTop: spacing.sm, height: 52, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  disabled: { opacity: 0.6 },
  back: { alignItems: "center", paddingVertical: spacing.md },
  backText: { fontSize: 14, fontWeight: "700", color: colors.ink2 },
});
