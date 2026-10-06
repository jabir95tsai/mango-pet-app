/**
 * Global push toggle — AuthProvider owns session-wide reconciliation; this view
 * requests permission, shows acknowledged registration state, and offers retry
 * or the iOS Settings route when permission has already been denied.
 */
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useAuth } from "@/state/auth-context";
import { disablePush, enablePush, probePushStatus } from "@/lib/push";
import { t, activeLocale } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function PushToggle() {
  const { user, pushStatus: status } = useAuth();
  const [busy, setBusy] = useState(false);
  const [settingsError, setSettingsError] = useState(false);

  async function toggle(next: boolean) {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (next) await enablePush(user.uid);
      else await disablePush(user.uid);
    } catch {
      // Push service publishes "error". Never show enabled before server ack.
    } finally {
      setBusy(false);
    }
  }

  const denied = status === "denied";
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>{t("Push.title")}</Text>
          <Text style={styles.hint}>
            {status === "checking"
              ? t("Push.status.checking")
              : status === "error"
                ? (activeLocale === "en" ? "Registration failed. Check your connection and try again." : "推播註冊失敗，請確認連線後重試。")
              : denied
                ? t("Push.status.deniedIos")
                : status === "enabled"
                  ? t("Push.status.enabled")
                  : t("Push.status.disabled")}
          </Text>
        </View>
        <Switch
          value={status === "enabled"}
          onValueChange={toggle}
          disabled={busy || denied || status === "checking"}
          trackColor={{ true: colors.brand, false: colors.hairline }}
          thumbColor={colors.card}
        />
      </View>
      {denied ? <Pressable accessibilityRole="button" onPress={() => {
        setSettingsError(false);
        void Linking.openSettings().catch(() => setSettingsError(true));
      }} style={styles.action}>
        <Text style={styles.link}>{activeLocale === "en" ? "Open iOS Settings" : "開啟 iOS 設定"}</Text>
      </Pressable> : null}
      {status === "error" ? <Pressable accessibilityRole="button" disabled={busy} onPress={async () => {
        if (!user || busy) return;
        setBusy(true);
        try { await probePushStatus(user.uid); } catch { /* error remains visible */ }
        finally { setBusy(false); }
      }} style={styles.action}><Text style={styles.link}>{t("Common.retry")}</Text></Pressable> : null}
      {settingsError ? <Text style={styles.hint}>{activeLocale === "en" ? "Open Settings manually and select Notifications." : "請手動開啟系統設定，選擇通知。"}</Text> : null}
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
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 12, color: colors.ink3, marginTop: 2 },
  action: { paddingVertical: spacing.sm },
  link: { color: colors.brandDeep, fontWeight: "600" },
});
