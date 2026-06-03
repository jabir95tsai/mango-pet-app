/**
 * Full-screen walk overlay. Two phases:
 *  • "tracking" — drives the P1d WalkTrackingService (live timer + distance +
 *    path; background continuation handled inside the service).
 *  • "done"     — stop() does NOT auto-save; we show a summary (km / 分 / 平均
 *    速度) + goal-hit emerald celebration with hand-rolled confetti + a recap
 *    (vs 7-day avg + pet calories) + optional notes, then 儲存 → createWalk or
 *    捨棄 → discard. Mirrors web walk-tracking-view done phase + walks-v2.
 *
 * Walk doc is written ONLY via createWalk (shared-formula score). P1c adds
 * in-walk photos (≤5 → walk.photoURLs) and the END auto-photo-share flow.
 * zh-TW strings inline (shared-i18n still pending).
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Pet } from "@mango/shared-types";

import { createWalk } from "@/lib/walks";
import { uploadWalkPhoto } from "@/lib/photos";
import {
  WalkTrackingService,
  type WalkTrackingState,
} from "@/lib/walk-tracking-service";
import { estimatePetCalories } from "@/lib/walk-stats";
import { WalkConfetti } from "@/components/walks/walk-confetti";
import { CameraCaptureModal } from "@/components/walks/camera-capture-modal";
import { PhotoShareFlow } from "@/components/walks/photo-share-flow";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";

const MAX_WALK_PHOTOS = 5;

type Phase = "tracking" | "done" | "saving" | "error";

type Props = {
  visible: boolean;
  pet: Pet | null;
  /** All pets in scope — for the END composer's pet tags. */
  pets: Pet[];
  streakDays: number;
  familyId: string | null;
  /** Pre-minted walk id — used as the photo sessionId AND createWalk's id so an
   *  auto-share post cross-links to the same walk. */
  walkId: string;
  /** Whether to run the END auto-photo-share prompt after saving. */
  autoPhotoShare: boolean;
  /** Active pet's daily goal (minutes) — drives the goal-hit celebration. */
  goalMin: number;
  /** Today's walked minutes BEFORE this session (stored). */
  todayMinBefore: number;
  /** Trailing 7-day per-walk average (recap "vs 平均"). */
  weeklyAvgMin: number;
  onClose: () => void;
  onSaved: () => void;
};

const INITIAL: WalkTrackingState = {
  isTracking: false,
  isPaused: false,
  startedAt: null,
  totalDistanceKm: 0,
  durationMin: 0,
  path: [],
  errorKind: null,
};

function formatTimer(durationMin: number): string {
  const totalSec = Math.max(0, Math.round(durationMin * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function avgSpeedKmh(distanceKm: number, durationMin: number): number {
  if (durationMin <= 0) return 0;
  return distanceKm / (durationMin / 60);
}

export function WalkTrackingView({
  visible,
  pet,
  pets,
  streakDays,
  familyId,
  walkId,
  autoPhotoShare,
  goalMin,
  todayMinBefore,
  weeklyAvgMin,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const serviceRef = useRef<WalkTrackingService | null>(null);
  if (!serviceRef.current) serviceRef.current = new WalkTrackingService();

  const [state, setState] = useState<WalkTrackingState>(INITIAL);
  const [phase, setPhase] = useState<Phase>("tracking");
  const [final, setFinal] = useState<WalkTrackingState | null>(null);
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // In-walk photos (≤5) — uploaded live to walk.photoURLs at save.
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // END auto-photo-share runs after a successful save.
  const [endShareOpen, setEndShareOpen] = useState(false);

  // Subscribe once.
  useEffect(() => {
    const unsub = serviceRef.current!.on(setState);
    return unsub;
  }, []);

  // Start when the overlay opens; release GPS when it closes.
  useEffect(() => {
    if (!visible) return;
    setPhase("tracking");
    setFinal(null);
    setNotes("");
    setErrorMsg(null);
    setPhotoURLs([]);
    setCameraOpen(false);
    setEndShareOpen(false);
    void serviceRef.current!.start();
    return () => {
      serviceRef.current!.reset();
    };
  }, [visible]);

  function handleStop() {
    const f = serviceRef.current!.stop();
    setFinal(f);
    setPhase("done");
  }

  async function handleWalkPhoto(uri: string) {
    setCameraOpen(false);
    if (!user || photoURLs.length >= MAX_WALK_PHOTOS) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadWalkPhoto(uri, user.uid, walkId, photoURLs.length);
      setPhotoURLs((prev) => [...prev, url].slice(0, MAX_WALK_PHOTOS));
    } catch {
      // Best-effort — a failed photo never blocks completing the walk.
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!final || !user || !pet) {
      onClose();
      return;
    }
    setPhase("saving");
    try {
      await createWalk({
        scorePet: pet,
        streakDays,
        familyId,
        walkerUid: user.uid,
        walkerName: user.displayName ?? user.email?.split("@")[0] ?? "Friend",
        walkerPhotoURL: user.photoURL,
        petId: pet.petId,
        petName: pet.name,
        startedAt: final.startedAt ?? new Date(),
        endedAt: new Date(),
        distanceKm: final.totalDistanceKm,
        durationMin: final.durationMin,
        path: final.path,
        isManual: false,
        notes: notes.trim() || undefined,
        walkId,
        photoURLs,
      });
      onSaved();
      // END auto-photo-share: same walkId cross-link. Otherwise just close.
      if (autoPhotoShare) {
        setPhase("done");
        setEndShareOpen(true);
      } else {
        onClose();
      }
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "存檔失敗");
    }
  }

  const permissionDenied = state.errorKind === "permission_denied";

  // Done-phase derived values.
  const doneMin = final?.durationMin ?? 0;
  const doneKm = final?.totalDistanceKm ?? 0;
  const blendedMin = todayMinBefore + doneMin;
  const goalHit = blendedMin >= goalMin;
  const blendedPercent = Math.min(100, Math.round((blendedMin / goalMin) * 100));
  const remainingMin = Math.max(0, goalMin - Math.round(blendedMin));
  const avgDiff = Math.round(doneMin - weeklyAvgMin);
  const showAvg = weeklyAvgMin > 0;
  const kcal = estimatePetCalories(doneKm, pet?.weightKg ?? null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.safe, phase === "done" && goalHit && styles.safeCelebrate]}
      >
        {permissionDenied ? (
          <View style={styles.centerBox}>
            <Text style={styles.bigEmoji}>📍</Text>
            <Text style={styles.errTitle}>需要定位權限</Text>
            <Text style={styles.errBody}>
              請到「設定」開啟 Mango Pet 的定位權限，才能記錄遛狗路線。
            </Text>
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>返回</Text>
            </Pressable>
          </View>
        ) : phase === "error" ? (
          <View style={styles.centerBox}>
            <Text style={styles.bigEmoji}>⚠️</Text>
            <Text style={styles.errTitle}>存檔失敗</Text>
            <Text style={styles.errBody}>{errorMsg}</Text>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setPhase("done")}
            >
              <Text style={styles.secondaryText}>返回</Text>
            </Pressable>
          </View>
        ) : phase === "tracking" ? (
          <View style={styles.body}>
            <View style={styles.header}>
              <Text style={styles.petName}>{pet?.name ?? "遛狗中"}</Text>
              {state.isPaused ? (
                <Text style={styles.paused}>背景暫停中…</Text>
              ) : (
                <Text style={styles.live}>
                  {state.backgroundEnabled ? "● 記錄中（背景持續）" : "● 記錄中"}
                </Text>
              )}
            </View>

            <View style={styles.metrics}>
              <Text style={styles.timer}>{formatTimer(state.durationMin)}</Text>
              <View style={styles.distRow}>
                <Text style={styles.distValue}>
                  {state.totalDistanceKm.toFixed(2)}
                </Text>
                <Text style={styles.distUnit}> km</Text>
              </View>
              <Text style={styles.points}>{`${state.path.length} 個路徑點`}</Text>
            </View>

            {/* In-walk photos (≤5) */}
            <View style={styles.photoStrip}>
              {photoURLs.map((url, i) => (
                <Image key={`${url}-${i}`} source={{ uri: url }} style={styles.photoThumb} />
              ))}
              {photoURLs.length < MAX_WALK_PHOTOS ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="拍遛狗照片"
                  disabled={uploadingPhoto}
                  onPress={() => setCameraOpen(true)}
                  style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.brandDeep} />
                  ) : (
                    <Text style={styles.photoAddText}>📷</Text>
                  )}
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="停止遛狗"
              onPress={handleStop}
              style={({ pressed }) => [styles.stopBtn, pressed && styles.pressed]}
            >
              <Text style={styles.stopText}>停止</Text>
            </Pressable>
          </View>
        ) : (
          // ── Done phase ──
          <View style={styles.doneFlex}>
            {goalHit ? <WalkConfetti /> : null}
            <ScrollView
              contentContainerStyle={styles.doneScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {goalHit ? (
                <View style={styles.celebrate}>
                  <View style={styles.trophy}>
                    <Text style={styles.trophyEmoji}>🏆</Text>
                  </View>
                  <Text style={styles.goalHitTitle}>達標了！今天遛狗目標完成 🎉</Text>
                  {streakDays >= 1 ? (
                    <Text style={styles.streakBadge}>{`🔥 連續 ${streakDays} 天`}</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.missed}>
                  <Text style={styles.missedTitle}>{`今天完成 ${blendedPercent}%`}</Text>
                  <Text style={styles.missedHint}>{`再走 ${remainingMin} 分鐘就達標`}</Text>
                </View>
              )}

              {/* Recap tiles: km / 分 / 平均速度 */}
              <View style={styles.tiles}>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>km</Text>
                  <Text style={styles.tileValue}>{doneKm.toFixed(2)}</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>分鐘</Text>
                  <Text style={styles.tileValue}>{doneMin.toFixed(1)}</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>km/h</Text>
                  <Text style={styles.tileValue}>
                    {avgSpeedKmh(doneKm, doneMin).toFixed(1)}
                  </Text>
                </View>
              </View>

              {(showAvg || kcal > 0) && (
                <View style={styles.recap}>
                  {showAvg ? (
                    <Text style={styles.recapLine}>
                      {avgDiff > 0
                        ? `比近 7 天平均長 ${avgDiff} 分`
                        : avgDiff < 0
                          ? `比近 7 天平均短 ${Math.abs(avgDiff)} 分`
                          : "跟近 7 天平均一樣"}
                    </Text>
                  ) : null}
                  {kcal > 0 && pet ? (
                    <Text style={styles.recapLine}>
                      {`${pet.name} 大約消耗了 ${kcal} 大卡`}
                    </Text>
                  ) : null}
                </View>
              )}

              {doneKm === 0 && (final?.path.length ?? 0) === 0 ? (
                <View style={styles.warn}>
                  <Text style={styles.warnText}>
                    ⚠️ 沒有記錄到路徑（可能在室內或 GPS 訊號弱），仍可存為一次遛狗。
                  </Text>
                </View>
              ) : null}

              {/* Notes */}
              <TextInput
                style={styles.notes}
                placeholder="留個備註（選填）"
                placeholderTextColor={colors.ink3}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={300}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="儲存遛狗紀錄"
                disabled={phase === "saving"}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && styles.pressed,
                  phase === "saving" && styles.disabled,
                ]}
              >
                {phase === "saving" ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.saveText}>儲存</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="捨棄這次遛狗"
                disabled={phase === "saving"}
                onPress={onClose}
                style={styles.discardBtn}
              >
                <Text style={styles.discardText}>捨棄</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* In-walk camera (tracking phase) */}
        <CameraCaptureModal
          visible={cameraOpen}
          onCaptured={handleWalkPhoto}
          onCancel={() => setCameraOpen(false)}
        />

        {/* END auto-photo-share — same walkId cross-link, after save */}
        <PhotoShareFlow
          visible={endShareOpen}
          phase="end"
          pet={pet}
          pets={pets}
          walkId={walkId}
          walkMinutes={Math.round(doneMin)}
          onDone={onClose}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  safeCelebrate: { backgroundColor: colors.successTint },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  header: { alignItems: "center", gap: spacing.xs, marginTop: spacing.xl },
  petName: { fontSize: 20, fontWeight: "800", color: colors.ink },
  live: { fontSize: 13, fontWeight: "700", color: colors.brandDeep },
  paused: { fontSize: 13, fontWeight: "700", color: colors.ink3 },
  metrics: { alignItems: "center", gap: spacing.sm },
  timer: {
    fontSize: 72,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  distRow: { flexDirection: "row", alignItems: "baseline" },
  distValue: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.brandDeep,
    fontVariant: ["tabular-nums"],
  },
  distUnit: { fontSize: 18, fontWeight: "700", color: colors.ink2 },
  points: { fontSize: 13, color: colors.ink3 },
  photoStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  photoThumb: { width: 56, height: 56, borderRadius: radius.md },
  photoAdd: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: "dashed",
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddText: { fontSize: 22 },
  stopBtn: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.peach,
    borderWidth: 6,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.paw,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  stopText: { fontSize: 22, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },

  // Done phase
  doneFlex: { flex: 1 },
  doneScroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    alignItems: "center",
    gap: spacing.lg,
  },
  celebrate: { alignItems: "center", gap: spacing.sm },
  trophy: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.successTint,
    alignItems: "center",
    justifyContent: "center",
  },
  trophyEmoji: { fontSize: 32 },
  goalHitTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.leaf,
    textAlign: "center",
  },
  streakBadge: { fontSize: 13, fontWeight: "700", color: colors.brandDeep },
  missed: { alignItems: "center", gap: 4 },
  missedTitle: { fontSize: 22, fontWeight: "800", color: colors.ink },
  missedHint: { fontSize: 12, color: colors.ink3 },
  tiles: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
    maxWidth: 360,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  tileLabel: { fontSize: 10, color: colors.ink3, textTransform: "uppercase" },
  tileValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  recap: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  recapLine: { fontSize: 12, color: colors.ink2 },
  warn: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.bellTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warnText: { fontSize: 12, color: colors.ink2, lineHeight: 18 },
  notes: {
    width: "100%",
    maxWidth: 360,
    minHeight: 72,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: "top",
  },
  saveBtn: {
    width: "100%",
    maxWidth: 360,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontWeight: "800", color: colors.card },
  discardBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: { fontSize: 14, fontWeight: "600", color: colors.ink3 },

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  bigEmoji: { fontSize: 56 },
  errTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  errBody: {
    fontSize: 14,
    color: colors.ink2,
    textAlign: "center",
    lineHeight: 20,
  },
  secondaryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xxl,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 16, fontWeight: "600", color: colors.ink },
});
