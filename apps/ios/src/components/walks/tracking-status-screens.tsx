/**
 * Non-tracking states of the walk overlay (R16 / TRACK-6, TRACK-22):
 *
 *  - starting: permission prompts / location source spin-up — a spinner and
 *    a neutral "getting your location" line, never the "recording" copy.
 *  - permission denied: native equivalent of web's red errDenied hint — a
 *    MapPin, the iOS-specific explanation, "Open Settings" + Back.
 *  - start failed: AlertTriangle + message, Retry + Back.
 */
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, MapPin } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function TrackingStartingScreen() {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.brandDeep} size="large" />
      <Text style={styles.muted}>{t("Ios.walks.starting")}</Text>
    </View>
  );
}

export function TrackingPermissionScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, styles.iconCircleBrand]}>
        <MapPin size={32} color={colors.brandDeep} strokeWidth={2} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {t("Ios.walks.locationNeededTitle")}
      </Text>
      <Text style={styles.body}>{t("Ios.walks.locationNeededBody")}</Text>
      <View style={styles.actions}>
        <Button
          label={t("Ios.walks.openSettings")}
          size="lg"
          pill
          fullWidth
          onPress={() => void Linking.openSettings()}
        />
        <Button label={t("Common.back")} variant="secondary" size="lg" pill fullWidth onPress={onBack} />
      </View>
    </View>
  );
}

export function TrackingStartFailedScreen({
  onRetry,
  onBack,
}: {
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, styles.iconCircleWarn]}>
        <AlertTriangle size={32} color={colors.brandDeep} strokeWidth={2} />
      </View>
      <Text style={styles.body} accessibilityRole="alert">
        {t("Ios.walks.startFailed")}
      </Text>
      <View style={styles.actions}>
        <Button label={t("Common.retry")} size="lg" pill fullWidth onPress={onRetry} />
        <Button label={t("Common.back")} variant="secondary" size="lg" pill fullWidth onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  muted: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleBrand: { backgroundColor: colors.brandTint },
  iconCircleWarn: { backgroundColor: colors.bellTint },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink, textAlign: "center" },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink2,
    textAlign: "center",
    maxWidth: 320,
  },
  actions: { width: "100%", maxWidth: 320, gap: spacing.sm, marginTop: spacing.sm },
});
