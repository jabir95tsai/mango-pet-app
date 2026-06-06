/**
 * Receipt scanner — camera-first (expo-camera, already installed). Capture →
 * compress (IMAGE_PRESETS.receipt) → base64 → Firebase AI Logic (extractReceipt)
 * → hand the parsed fields up to prefill the expense form. Permission denied or
 * AI failure → "手動輸入" fallback (manual expense form). Mirrors web
 * receipt-scanner's camera-first flow (spec §P2d; ⚠️ simulator has no camera →
 * device-verified at the batched P2-end build).
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { ExtractedReceipt } from "@mango/shared-types";

import { extractReceipt } from "@/lib/ai-receipt";
import { compressReceiptToBase64 } from "@/lib/photos";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");
const tC = scoped("Common");

export function ReceiptScanner({
  onClose,
  onExtracted,
  onManual,
}: {
  onClose: () => void;
  onExtracted: (receipt: ExtractedReceipt) => void;
  onManual: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  async function capture() {
    const cam = cameraRef.current;
    if (!cam || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const photo = await cam.takePictureAsync({ quality: 1 });
      if (!photo?.uri) throw new Error("capture failed");
      const { base64 } = await compressReceiptToBase64(photo.uri);
      const data = await extractReceipt(base64);
      onExtracted(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 辨識失敗，請手動輸入。");
      setScanning(false);
    }
  }

  // Permission still loading.
  if (!permission) {
    return (
      <Modal visible animationType="fade" onRequestClose={onClose}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Modal>
    );
  }

  // Denied → manual fallback sheet.
  if (!permission.granted) {
    return (
      <Modal
        visible
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.deniedSheet} edges={["top", "bottom"]}>
          <Text style={styles.deniedEmoji}>📷</Text>
          <Text style={styles.deniedTitle}>{tPP("expenses.empty")}</Text>
          <Text style={styles.deniedBody}>
            需要相機權限才能掃描收據。你也可以直接手動輸入。
          </Text>
          <Pressable onPress={onManual} style={styles.manualBtn} accessibilityRole="button">
            <Text style={styles.manualBtnText}>{tPP("expenses.manualEntry")}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancelLink}>{tC("cancel")}</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    );
  }

  // Granted → live camera.
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.full}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
          <View style={styles.topBar}>
            <Pressable onPress={onClose} hitSlop={10} disabled={scanning}>
              <X size={26} color="#ffffff" strokeWidth={2} />
            </Pressable>
            <Text style={styles.hint}>拍張收據，AI 自動辨識金額/商家/日期</Text>
            <View style={styles.closeSpacer} />
          </View>

          <View style={styles.bottomBar}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.scanText}>AI 辨識中…</Text>
              </View>
            ) : (
              <Pressable
                onPress={capture}
                style={styles.shutterOuter}
                accessibilityRole="button"
                accessibilityLabel={tPP("fab.expenses")}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            )}
            <Pressable onPress={onManual} hitSlop={8} disabled={scanning}>
              <Text style={styles.manualLink}>{tPP("expenses.manualEntry")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  full: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  close: { fontSize: 26, color: "#fff", width: 32 },
  closeSpacer: { width: 32 },
  hint: { flex: 1, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: "600" },
  bottomBar: {
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  error: {
    color: "#fff",
    backgroundColor: "rgba(215,123,63,0.85)",
    fontSize: 13,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  scanningRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 72 },
  scanText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  manualLink: { color: "#fff", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  deniedSheet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  deniedEmoji: { fontSize: 48 },
  deniedTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  deniedBody: { fontSize: 14, color: colors.ink2, textAlign: "center", lineHeight: 20 },
  manualBtn: {
    marginTop: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  manualBtnText: { fontSize: 16, fontWeight: "800", color: colors.card },
  cancelLink: { fontSize: 15, color: colors.ink3, marginTop: spacing.sm },
});
