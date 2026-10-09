/**
 * Reusable full-screen camera capture (expo-camera, P1c) — the native stand-in
 * for web's `<input type="file" capture="environment">`. Shutter → returns the
 * captured local URI via onCaptured; cancel / permission-denied → onCancel so
 * the caller can proceed WITHOUT a photo (spec: camera refusal must not block
 * completing the walk). Compression happens later in the upload helpers.
 *
 * Presentation:
 *  - "overlay" (default): an absolute-fill layer inside the caller's own
 *    modal (post composer, in-walk photos inside the tracking view).
 *  - "modal": its own full-screen RN Modal, for callers that are a plain
 *    screen (the walk START photo flow) so the tab bar is covered too.
 *    `onDismissed` fires once the modal has fully gone, so the caller can
 *    present the next modal without the iOS "present while dismissing" race.
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Camera, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  onCaptured: (uri: string) => void;
  onCancel: () => void;
  presentation?: "overlay" | "modal";
  /** "modal" only — the modal has fully disappeared. */
  onDismissed?: () => void;
};

export function CameraCaptureModal({
  visible,
  onCaptured,
  onCancel,
  presentation = "overlay",
  onDismissed,
}: Props) {
  const reduceMotion = useReducedMotion();

  if (presentation === "modal") {
    return (
      <Modal
        visible={visible}
        animationType={reduceMotion ? "none" : "slide"}
        presentationStyle="fullScreen"
        onRequestClose={onCancel}
        onDismiss={onDismissed}
      >
        {/* Kept mounted through the dismiss animation (RN renders the
            modal's children until onDismiss). */}
        <CameraBody onCaptured={onCaptured} onCancel={onCancel} />
      </Modal>
    );
  }

  if (!visible) return null;
  return <CameraBody onCaptured={onCaptured} onCancel={onCancel} />;
}

function CameraBody({
  onCaptured,
  onCancel,
}: {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);

  // Permission still loading.
  if (!permission) {
    return (
      <View style={styles.fill}>
        <ActivityIndicator color={colors.card} />
      </View>
    );
  }

  // Not yet granted → ask; if blocked, offer Settings and let the user skip.
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permBox}>
        <View style={styles.permIcon}>
          <Camera size={32} color={colors.brandDeep} strokeWidth={2} />
        </View>
        <Text style={styles.permTitle} accessibilityRole="header">
          {t("Ios.walks.cameraPermissionTitle")}
        </Text>
        <Text style={styles.permBody}>{t("Ios.walks.cameraPermissionBody")}</Text>
        <View style={styles.permActions}>
          {permission.canAskAgain ? (
            <Button
              label={t("Ios.walks.cameraAllow")}
              pill
              size="lg"
              fullWidth
              onPress={() => void requestPermission()}
            />
          ) : (
            <Button
              label={t("Ios.walks.openSettings")}
              pill
              size="lg"
              fullWidth
              onPress={() => void Linking.openSettings()}
            />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>{t("WalksPhotoPrompt.skip")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function handleShutter() {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) onCaptured(photo.uri);
      else onCancel();
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.fill}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <SafeAreaView style={styles.controls} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Common.close")}
            onPress={onCancel}
            hitSlop={2}
            style={styles.closeBtn}
          >
            <X size={20} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.bottomRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("WalksPhotoPrompt.take")}
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={handleShutter}
            style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={colors.ink} /> : <View style={styles.shutterInner} />}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 100,
    alignItems: "stretch",
    justifyContent: "center",
  },
  controls: { flex: 1, justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "flex-end", padding: spacing.lg },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: { alignItems: "center", paddingBottom: spacing.xxl },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
  },
  pressed: { opacity: 0.7 },
  permBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: { fontSize: 20, fontWeight: "700", color: colors.ink, textAlign: "center" },
  permBody: { fontSize: 14, color: colors.ink2, textAlign: "center", lineHeight: 20 },
  permActions: {
    width: "100%",
    maxWidth: 320,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  skipBtn: {
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
});
