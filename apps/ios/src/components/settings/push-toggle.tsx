/**
 * Global push toggle — 1:1 with web apps/web/src/components/settings/push-toggle.tsx:
 * a 36pt brand-tint disc (BellRing enabled / BellOff denied·error / Bell), the
 * title + status line, and — while enabled — a ghost "test" action (web
 * sendTestPush) with the green result line. The on/off control stays the
 * native Switch (accepted iOS difference for web's enable/disable buttons).
 *
 * AuthProvider owns session-wide reconciliation; this view requests
 * permission, shows the acknowledged registration state, and offers retry or
 * the iOS Settings route when permission has already been denied.
 */
import { useState } from "react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import { Bell, BellOff, BellRing, Send } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/state/auth-context";
import { disablePush, enablePush, probePushStatus } from "@/lib/push";
import { sendTestPush } from "@/lib/account";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";
import { SettingsCard, SettingsIconDisc, settingsText } from "./settings-card";

export function PushToggle() {
  const { user, pushStatus: status } = useAuth();
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState(false);

  async function toggle(next: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setTestResult(null);
    setTestError(null);
    try {
      if (next) await enablePush(user.uid);
      else await disablePush(user.uid);
    } catch {
      // Push service publishes "error". Never show enabled before server ack.
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (testing || busy) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await sendTestPush();
      if (res.sent > 0) {
        setTestResult(
          res.failed > 0
            ? t("Push.testPartial", { sent: res.sent, failed: res.failed })
            : t("Push.testSent", { sent: res.sent }),
        );
      } else {
        setTestResult(t("Push.testFailed", { failed: res.failed }));
      }
    } catch (err) {
      setTestError(err instanceof Error && err.message ? err.message : t("Push.testError"));
    } finally {
      setTesting(false);
    }
  }

  async function retry() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await probePushStatus(user.uid);
    } catch {
      /* error remains visible */
    } finally {
      setBusy(false);
    }
  }

  const denied = status === "denied";
  const enabled = status === "enabled";
  const Icon = enabled ? BellRing : denied || status === "error" ? BellOff : Bell;
  const statusText =
    status === "checking"
      ? t("Push.status.checking")
      : status === "error"
        ? t("Push.status.error")
        : denied
          ? t("Push.status.deniedIos")
          : enabled
            ? t("Push.status.enabled")
            : t("Push.status.disabled");

  return (
    <SettingsCard style={styles.card}>
      <View style={styles.row}>
        <SettingsIconDisc>
          <Icon size={16} color={colors.brandDeep} strokeWidth={2} />
        </SettingsIconDisc>
        <View style={styles.text}>
          <Text style={settingsText.title}>{t("Push.title")}</Text>
          <Text style={settingsText.sub} accessibilityLiveRegion="polite">
            {statusText}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={busy || testing || denied || status === "checking"}
          trackColor={{ true: colors.brand, false: colors.hairline }}
          thumbColor={colors.card}
          accessibilityLabel={t("Push.title")}
        />
      </View>

      {enabled ? (
        <Button
          label={testing ? "..." : t("Push.test")}
          variant="ghost"
          size="sm"
          icon={<Send size={14} color={colors.ink} strokeWidth={2} />}
          onPress={handleTest}
          disabled={testing || busy}
          style={styles.inlineAction}
        />
      ) : null}
      {denied ? (
        <Button
          label={t("Push.openIosSettings")}
          variant="ghost"
          size="sm"
          onPress={() => {
            setSettingsError(false);
            void Linking.openSettings().catch(() => setSettingsError(true));
          }}
          style={styles.inlineAction}
        />
      ) : null}
      {status === "error" ? (
        <Button
          label={t("Common.retry")}
          variant="ghost"
          size="sm"
          onPress={() => void retry()}
          disabled={busy}
          style={styles.inlineAction}
        />
      ) : null}

      {testResult ? <Text style={settingsText.success}>{testResult}</Text> : null}
      {testError ? (
        <Text style={settingsText.error} accessibilityRole="alert">
          {testError}
        </Text>
      ) : null}
      {settingsError ? <Text style={settingsText.sub}>{t("Push.openSettingsManually")}</Text> : null}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, minWidth: 0 },
  // Ghost button pads its label by 12 → the label lines up with the title
  // (36pt disc + 12pt gap).
  inlineAction: { alignSelf: "flex-start", marginLeft: 36 },
});
