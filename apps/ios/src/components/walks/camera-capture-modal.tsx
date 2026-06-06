/**
 * Reusable full-screen camera capture (expo-camera, P1c). Shutter → returns the
 * captured local URI via onCaptured; cancel / permission-denied → onCancel so
 * the caller can proceed WITHOUT a photo (spec: camera refusal must not block
 * completing the walk). Compression happens later in the upload helpers.
 *
 * No new dep — expo-camera was installed by the P1c backend prereq.
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  onCaptured: (uri: string) => void;
  onCancel: () => void;
};

export function CameraCaptureModal({ visible, onCaptured, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  // Permission still loading.
  if (!permission) {
    return (
      <View style={styles.fill}>
        <ActivityIndicator color={colors.card} />
      </View>
    );
  }

  // Not yet granted → ask; if blocked, let the user skip (fallback).
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permBox}>
        <Text style={styles.permEmoji}>📷</Text>
        <Text style={styles.permTitle}>需要相機權限</Text>
        <Text style={styles.permBody}>
          開啟相機才能拍遛狗照片；不拍照也能完成這次遛狗。
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.primaryBtn} onPress={() => void requestPermission()}>
            <Text style={styles.primaryText}>允許相機</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryText}>略過</Text>
        </Pressable>
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
            accessibilityLabel="關閉相機"
            onPress={onCancel}
            style={styles.closeBtn}
          >
            <X size={20} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.bottomRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="拍照"
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
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", zIndex: 100 },
  controls: { flex: 1, justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "flex-end", padding: spacing.lg },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 18, fontWeight: "700" },
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
  fillCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  permBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  permEmoji: { fontSize: 56 },
  permTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  permBody: { fontSize: 14, color: colors.ink2, textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    marginTop: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: colors.card },
  secondaryBtn: { height: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 14, fontWeight: "600", color: colors.ink3 },
});
