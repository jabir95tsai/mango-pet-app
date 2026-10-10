/**
 * Receipt scanner — iOS counterpart of apps/web/src/components/expenses/
 * receipt-scanner.tsx + the pets page's camera-first FAB flow (spec
 * expenses-into-pets-page D2).
 *
 * Steps (one full-screen modal; slide is dropped under Reduce Motion):
 *  1. capture — live camera (expo-camera) with the hint, a shutter, a
 *     "choose from library" button (expo-image-picker) and the manual-entry
 *     link. Web: the FAB opens the OS camera; dismissing it lands on the
 *     拍照 / 從相簿選 / 手動輸入 intro.
 *  2. preview — the compressed photo (contain) with an X to retake and a
 *     save-to-album button (PhotosKit, web SaveToAlbumButton), then the
 *     primary "開始辨識" (Sparkles; spinner + "AI 辨識中…" while scanning) and
 *     the manual-entry link. Nothing is sent to AI until the user taps it.
 *  3. camera denied / unavailable — explanation + Open Settings (when iOS
 *     won't ask again) or ask again, plus library pick and manual entry, so a
 *     receipt already in Photos can always be scanned.
 *
 * Capture/pick → compressReceiptToBase64 (receipt preset) → extractReceipt
 * (Firebase AI Logic) → onExtracted (the pets screen opens the prefilled
 * expense form). Closing mid-scan drops the late result.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import {
  Camera,
  Check,
  Download,
  Image as ImageIcon,
  Settings,
  Sparkles,
  X,
} from "lucide-react-native";
import type { ExtractedReceipt } from "@mango/shared-types";

import { Button, IconButton } from "@/components/ui";
import { extractReceipt } from "@/lib/ai-receipt";
import { t } from "@/lib/i18n";
import { compressReceiptToBase64 } from "@/lib/photos";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

type Shot = { uri: string; base64: string };
type SaveState = "idle" | "saving" | "saved" | "failed";

const SAVE_FEEDBACK_MS = 2000;
const WHITE = "#ffffff";
// web bg-black/60 overlay buttons
const SCRIM = "rgba(0,0,0,0.6)";

export function ReceiptScanner({
  onClose,
  onExtracted,
  onManual,
}: {
  onClose: () => void;
  onExtracted: (receipt: ExtractedReceipt) => void;
  onManual: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [requesting, setRequesting] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Every async step takes a generation; closing / retaking bumps it so a
  // late capture, compress or AI result is dropped instead of acting.
  const genRef = useRef(0);
  const mountedRef = useRef(true);
  const askedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      genRef.current += 1;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // First open: ask for the camera once (iOS shows its own prompt).
  useEffect(() => {
    if (!permission || permission.granted || askedRef.current) return;
    if (permission.status !== "undetermined" || !permission.canAskAgain) return;
    askedRef.current = true;
    setRequesting(true);
    requestPermission()
      .catch(() => undefined)
      .finally(() => {
        if (mountedRef.current) setRequesting(false);
      });
  }, [permission, requestPermission]);

  // Back from iOS Settings → re-read the permission.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void getPermission().catch(() => undefined);
    });
    return () => sub.remove();
  }, [getPermission]);

  const isCurrent = (gen: number) => mountedRef.current && gen === genRef.current;

  function close() {
    genRef.current += 1;
    onClose();
  }

  function manual() {
    genRef.current += 1;
    onManual();
  }

  function retake() {
    if (scanning) return;
    genRef.current += 1;
    setShot(null);
    setError(null);
    setSaveState("idle");
    setProcessing(false);
  }

  async function prepare(uri: string, gen: number) {
    const out = await compressReceiptToBase64(uri);
    if (!isCurrent(gen)) return;
    if (!out.base64) throw new Error("empty image");
    setShot(out);
    setSaveState("idle");
  }

  async function capture() {
    const cam = cameraRef.current;
    if (!cam || processing) return;
    const gen = ++genRef.current;
    setProcessing(true);
    setError(null);
    try {
      const photo = await cam.takePictureAsync({ quality: 1 });
      if (!photo?.uri) throw new Error("capture failed");
      await prepare(photo.uri, gen);
    } catch {
      if (isCurrent(gen)) setError(t("PetsPage.scanner.imageFailed"));
    } finally {
      if (isCurrent(gen)) setProcessing(false);
    }
  }

  async function pickFromLibrary() {
    if (processing) return;
    const gen = ++genRef.current;
    setError(null);
    try {
      // PHPicker on iOS 14+: no photo-library permission needed.
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (!isCurrent(gen) || res.canceled || !res.assets[0]) return;
      setProcessing(true);
      await prepare(res.assets[0].uri, gen);
    } catch {
      if (isCurrent(gen)) setError(t("PetsPage.scanner.imageFailed"));
    } finally {
      if (isCurrent(gen)) setProcessing(false);
    }
  }

  async function scan() {
    if (!shot || scanning) return;
    const gen = ++genRef.current;
    setScanning(true);
    setError(null);
    try {
      const data = await extractReceipt(shot.base64);
      if (!isCurrent(gen)) return;
      onExtracted(data);
    } catch {
      if (isCurrent(gen)) setError(t("PetsPage.scanner.failed"));
    } finally {
      if (isCurrent(gen)) setScanning(false);
    }
  }

  async function askAgain() {
    setRequesting(true);
    try {
      await requestPermission();
    } catch {
      // stays on the denied view
    } finally {
      if (mountedRef.current) setRequesting(false);
    }
  }

  async function saveToAlbum() {
    if (!shot || saveState === "saving") return;
    setSaveState("saving");
    let next: SaveState = "failed";
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (perm.granted) {
        await MediaLibrary.saveToLibraryAsync(shot.uri);
        next = "saved";
      }
    } catch {
      next = "failed";
    }
    if (!mountedRef.current) return;
    setSaveState(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (mountedRef.current) setSaveState("idle");
    }, SAVE_FEEDBACK_MS);
  }

  let content: ReactNode;
  if (shot) {
    content = (
      <LightShell onClose={close}>
        <View style={styles.previewBox}>
          <Image
            source={{ uri: shot.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Pressable
            onPress={retake}
            disabled={scanning}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("Common.cancel")}
            accessibilityState={{ disabled: scanning }}
            style={[styles.overlayBtn, styles.overlayTopRight, scanning && styles.dim]}
          >
            <X size={16} color={WHITE} strokeWidth={2} />
          </Pressable>
          <SaveToAlbumButton state={saveState} onPress={() => void saveToAlbum()} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label={scanning ? t("PetsPage.scanner.scanning") : t("PetsPage.scanner.startScan")}
          icon={scanning ? <ActivityIndicator color={WHITE} size="small" /> : Sparkles}
          size="lg"
          fullWidth
          disabled={scanning}
          onPress={() => void scan()}
        />
        <ManualLink onPress={manual} />
      </LightShell>
    );
  } else if (!permission || requesting) {
    content = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  } else if (permission.granted && !cameraFailed) {
    content = (
      <View style={styles.full}>
        <StatusBar style="light" />
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onMountError={() => setCameraFailed(true)}
        />
        <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
          <View style={styles.topBar}>
            <Pressable
              onPress={close}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t("Common.close")}
              style={styles.topBtn}
            >
              <X size={26} color={WHITE} strokeWidth={2} />
            </Pressable>
            <Text style={styles.hint}>{t("PetsPage.scanner.hint")}</Text>
            <View style={styles.topBtn} />
          </View>

          <View style={styles.bottomBar}>
            {error ? <Text style={styles.cameraError}>{error}</Text> : null}
            <View style={styles.shutterRow}>
              <Pressable
                onPress={() => void pickFromLibrary()}
                disabled={processing}
                accessibilityRole="button"
                accessibilityLabel={t("PetsPage.scanner.pickFromLibrary")}
                accessibilityState={{ disabled: processing }}
                style={({ pressed }) => [
                  styles.sideBtn,
                  (pressed || processing) && styles.dim,
                ]}
              >
                <ImageIcon size={24} color={WHITE} strokeWidth={2} />
              </Pressable>
              {processing ? (
                <View style={styles.shutterOuter}>
                  <ActivityIndicator color={WHITE} />
                </View>
              ) : (
                <Pressable
                  onPress={() => void capture()}
                  style={({ pressed }) => [styles.shutterOuter, pressed && styles.dim]}
                  accessibilityRole="button"
                  accessibilityLabel={t("PetsPage.scanner.takePhoto")}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
              )}
              <View style={styles.sideSpacer} />
            </View>
            <Pressable
              onPress={manual}
              hitSlop={10}
              disabled={processing}
              accessibilityRole="button"
            >
              <Text style={styles.manualLinkDark}>{t("PetsPage.expenses.manualEntry")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  } else {
    // Denied, or the camera could not start (e.g. Simulator).
    const denied = !permission.granted;
    content = (
      <LightShell onClose={close}>
        <View style={styles.hero}>
          <View style={styles.heroDisc}>
            <Camera size={24} color={colors.brandDeep} strokeWidth={1.8} />
          </View>
          {denied ? (
            <Text style={styles.heroTitle} accessibilityRole="header">
              {t("PetsPage.scanner.cameraDeniedTitle")}
            </Text>
          ) : null}
          <Text style={styles.heroBody}>
            {denied ? t("PetsPage.scanner.cameraDeniedBody") : t("PetsPage.scanner.hint")}
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {denied ? (
          permission.canAskAgain ? (
            <Button
              label={t("PetsPage.scanner.takePhoto")}
              icon={Camera}
              size="lg"
              fullWidth
              onPress={() => void askAgain()}
            />
          ) : (
            <Button
              label={t("PetsPage.scanner.openSettings")}
              icon={Settings}
              size="lg"
              fullWidth
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          )
        ) : null}
        <Button
          label={t("PetsPage.scanner.pickFromLibrary")}
          icon={ImageIcon}
          variant="secondary"
          size={denied ? "md" : "lg"}
          fullWidth
          loading={processing}
          onPress={() => void pickFromLibrary()}
        />
        <ManualLink onPress={manual} />
      </LightShell>
    );
  }

  return (
    <Modal
      visible
      animationType={reduceMotion ? "none" : "slide"}
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      {content}
    </Modal>
  );
}

/** Light dialog-like layout (web Dialog title "拍收據" + X). */
function LightShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
          {t("Expense.scanReceipt")}
        </Text>
        <IconButton
          icon={X}
          size={44}
          iconSize={20}
          color={colors.ink}
          accessibilityLabel={t("Common.close")}
          onPress={onClose}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Web manual-entry link: text-sm font-medium brand-deep, centred. */
function ManualLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      accessibilityRole="button"
      style={styles.manualLink}
    >
      <Text style={styles.manualLinkText}>{t("PetsPage.expenses.manualEntry")}</Text>
    </Pressable>
  );
}

/** Web SaveToAlbumButton: Download → Check (saved, leaf) / danger (failed). */
function SaveToAlbumButton({ state, onPress }: { state: SaveState; onPress: () => void }) {
  const label =
    state === "saved"
      ? t("Common.saveToAlbum.saved")
      : state === "failed"
        ? t("Common.saveToAlbum.failed")
        : t("Common.saveToAlbum.label");
  const tone =
    state === "saved"
      ? { bg: colors.leafTint, border: colors.leaf, fg: colors.leaf }
      : state === "failed"
        ? { bg: colors.peachTint, border: colors.danger, fg: colors.danger }
        : { bg: colors.card, border: colors.hairline, fg: colors.ink2 };
  return (
    <Pressable
      onPress={onPress}
      disabled={state === "saving"}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: state === "saving", busy: state === "saving" }}
      style={[
        styles.overlayBtn,
        styles.overlayBottomRight,
        { backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border },
        state === "saving" && styles.dim,
      ]}
    >
      {state === "saving" ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : state === "saved" ? (
        <Check size={16} color={tone.fg} strokeWidth={2.6} />
      ) : (
        <Download size={16} color={tone.fg} strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  dim: { opacity: 0.5 },

  // ── light (preview / denied) ──
  sheet: { flex: 1, backgroundColor: colors.card },
  // web Dialog header: p-5, title 16/600, hairline bottom border
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  body: {
    padding: 20,
    gap: 12,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  // web relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-zinc-100
  previewBox: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.bgAlt,
  },
  // web size-8 rounded-full
  overlayBtn: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTopRight: { top: 8, right: 8, backgroundColor: SCRIM },
  overlayBottomRight: { bottom: 8, right: 8 },
  errorText: { fontSize: 14, color: colors.danger },
  manualLink: { alignSelf: "center", paddingVertical: 4 },
  manualLinkText: { fontSize: 14, fontWeight: "500", color: colors.brandDeep, textAlign: "center" },
  hero: { alignItems: "center", gap: 10, paddingVertical: spacing.lg },
  heroDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center" },
  heroBody: { fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: "center" },

  // ── camera ──
  full: { flex: 1, backgroundColor: "#000000" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  topBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  hint: {
    flex: 1,
    textAlign: "center",
    color: WHITE,
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 4,
  },
  bottomBar: { alignItems: "center", gap: spacing.md, paddingBottom: spacing.xl },
  cameraError: {
    color: WHITE,
    backgroundColor: SCRIM,
    fontSize: 13,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    overflow: "hidden",
    marginHorizontal: spacing.lg,
    textAlign: "center",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideSpacer: { width: 52, height: 52 },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: WHITE },
  manualLinkDark: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
