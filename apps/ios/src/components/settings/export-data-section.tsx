/**
 * Privacy & data card — 1:1 with the web settings section (ShieldCheck 20 +
 * title 16/600, subtitle 14 ink2) around export-data-button.tsx: a secondary
 * self-start button (Download 16 + downloadAction / "downloading" while busy),
 * green success line, red "errorPrefix: …" line. The iOS take on web's Blob
 * download: exportUserData callable → JSON file → native share sheet.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Download, ShieldCheck } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/state/auth-context";
import { exportAndShareUserData } from "@/lib/data-export";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { SettingsCard, settingsText } from "./settings-card";

export function ExportDataSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!user || busy) return;
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      await exportAndShareUserData(user.uid);
      setDone(true);
    } catch (e) {
      setError(`${t("Settings.privacyData.errorPrefix")}: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard>
      <View style={styles.header}>
        <ShieldCheck size={20} color={colors.brandDeep} strokeWidth={2} />
        <Text style={settingsText.titleLg}>{t("Settings.privacyData.title")}</Text>
      </View>
      <Text style={settingsText.body}>{t("Settings.privacyData.subtitle")}</Text>
      <Button
        label={busy ? t("Settings.privacyData.downloading") : t("Settings.privacyData.downloadAction")}
        variant="secondary"
        icon={Download}
        onPress={() => void run()}
        disabled={busy}
        style={styles.btn}
      />
      {done ? <Text style={settingsText.success}>{t("Settings.privacyData.successToast")}</Text> : null}
      {error ? (
        <Text style={settingsText.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  btn: { alignSelf: "flex-start" },
});
