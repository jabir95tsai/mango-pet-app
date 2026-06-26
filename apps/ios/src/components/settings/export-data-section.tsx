/**
 * Data export section (P5b) — button → exportUserData callable → write JSON +
 * native share. Mirrors web export-data-button. Uses Settings.privacyData.* keys.
 */
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/state/auth-context";
import { exportAndShareUserData } from "@/lib/data-export";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function ExportDataSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await exportAndShareUserData(user.uid);
    } catch (e) {
      setError(`${t("Settings.privacyData.errorPrefix")}: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("Settings.privacyData.title")}</Text>
      <Text style={styles.subtitle}>{t("Settings.privacyData.subtitle")}</Text>
      <Pressable onPress={run} disabled={busy} style={[styles.btn, busy && styles.disabled]}>
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.btnText}>{t("Settings.privacyData.downloadAction")}</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 12, color: colors.ink3, lineHeight: 17 },
  btn: {
    marginTop: spacing.xs,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  error: { fontSize: 12, color: colors.cookie },
  disabled: { opacity: 0.6 },
});
