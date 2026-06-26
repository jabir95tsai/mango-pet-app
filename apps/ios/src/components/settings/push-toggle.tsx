/**
 * Global push toggle (P5a) — probes APNs permission + pushPrefs.globalDisabled on
 * mount, then enables (request permission + register token) or disables (clear
 * tokens + set globalDisabled). Mirrors web push-toggle.tsx state machine.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { useAuth } from "@/state/auth-context";
import { disablePush, enablePush, probePushStatus, type PushStatus } from "@/lib/push";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function PushToggle() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    probePushStatus(user.uid).then(setStatus).catch(() => setStatus("disabled"));
  }, [user]);

  async function toggle(next: boolean) {
    if (!user || busy) return;
    setBusy(true);
    const prev = status;
    setStatus(next ? "enabled" : "disabled");
    try {
      const result = next ? await enablePush(user.uid) : (await disablePush(user.uid), "disabled" as const);
      setStatus(result);
    } catch {
      setStatus(prev);
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 12, color: colors.ink3, marginTop: 2 },
});
