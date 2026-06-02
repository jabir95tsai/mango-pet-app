/**
 * Guest upgrade card (P5a) — shown only to anonymous users. Links a Google/Apple
 * credential onto the SAME uid (data preserved). On a pre-existing account it
 * "switches" (no merge). Mirrors web guest-upgrade.tsx (Google + Apple only).
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  upgradeGuestWithApple,
  upgradeGuestWithGoogle,
  type GuestUpgradeResult,
} from "@/lib/auth";
import { isAppleSignInAvailable } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function GuestUpgradeSection() {
  const [busy, setBusy] = useState(false);
  const [appleOk, setAppleOk] = useState(true);

  // best-effort apple availability (don't block render)
  useEffect(() => {
    isAppleSignInAvailable().then(setAppleOk).catch(() => setAppleOk(false));
  }, []);

  async function run(fn: () => Promise<GuestUpgradeResult>) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fn();
      if (res.status === "switched") {
        Alert.alert(t("Guest.upgrade.title"), t("Guest.upgrade.conflictBody"));
      } else {
        Alert.alert(t("Guest.upgrade.title"), "✅");
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/canceled" || code === "ERR_REQUEST_CANCELED") {
        // user cancelled — silent
      } else {
        Alert.alert(t("Guest.upgrade.errors.generic"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("Guest.settings.title")}</Text>
      <Text style={styles.body}>{t("Guest.settings.body")}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => run(upgradeGuestWithGoogle)}
          disabled={busy}
          style={[styles.btn, styles.google]}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.googleText}>{t("Guest.upgrade.withGoogle")}</Text>
          )}
        </Pressable>
        {appleOk ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => run(upgradeGuestWithApple)}
            disabled={busy}
            style={[styles.btn, styles.apple]}
          >
            <Text style={styles.appleText}>{t("Guest.upgrade.withApple")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  body: { fontSize: 12, color: colors.ink2, lineHeight: 18 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  btn: { height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  google: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
  googleText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  apple: { backgroundColor: "#000" },
  appleText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
