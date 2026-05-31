/**
 * Full-screen walk tracking overlay (P1a, FOREGROUND GPS). Drives the P1a
 * backend `WalkTrackingService` (start → live timer + distance → stop) and on
 * stop persists the walk via `createWalk` — which writes walks/{walkId} with
 * the shared-formula score, so the existing leaderboard trigger fires. No live
 * map (parity: web has none either). Done-screen confetti / notes are P1b.
 *
 * Background GPS (Always permission, keep recording while locked) is P1d and
 * intentionally not here — the service pauses the timer when backgrounded.
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
import { SafeAreaView } from "react-native-safe-area-context";
import type { Pet } from "@mango/shared-types";

import { createWalk } from "@/lib/walks";
import {
  WalkTrackingService,
  type WalkTrackingState,
} from "@/lib/walk-tracking-service";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";

type Phase = "tracking" | "saving" | "error";

type Props = {
  visible: boolean;
  pet: Pet | null;
  streakDays: number;
  familyId: string | null;
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

export function WalkTrackingView({
  visible,
  pet,
  streakDays,
  familyId,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const serviceRef = useRef<WalkTrackingService | null>(null);
  if (!serviceRef.current) serviceRef.current = new WalkTrackingService();

  const [state, setState] = useState<WalkTrackingState>(INITIAL);
  const [phase, setPhase] = useState<Phase>("tracking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subscribe once.
  useEffect(() => {
    const unsub = serviceRef.current!.on(setState);
    return unsub;
  }, []);

  // Start when the overlay opens; release the GPS watch when it closes.
  useEffect(() => {
    if (!visible) return;
    setPhase("tracking");
    setErrorMsg(null);
    void serviceRef.current!.start();
    return () => {
      serviceRef.current!.reset();
    };
  }, [visible]);

  async function handleStop() {
    const final = serviceRef.current!.stop();
    if (!user || !pet) {
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
        walkerName:
          user.displayName ?? user.email?.split("@")[0] ?? "Friend",
        walkerPhotoURL: user.photoURL,
        petId: pet.petId,
        petName: pet.name,
        startedAt: final.startedAt ?? new Date(),
        endedAt: new Date(),
        distanceKm: final.totalDistanceKm,
        durationMin: final.durationMin,
        path: final.path,
        isManual: false,
      });
      onSaved();
      onClose();
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "存檔失敗");
    }
  }

  const permissionDenied = state.errorKind === "permission_denied";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
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
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>返回</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.header}>
              <Text style={styles.petName}>{pet?.name ?? "遛狗中"}</Text>
              {state.isPaused ? (
                <Text style={styles.paused}>背景暫停中…</Text>
              ) : (
                <Text style={styles.live}>● 記錄中</Text>
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="停止遛狗"
              disabled={phase === "saving"}
              onPress={handleStop}
              style={({ pressed }) => [
                styles.stopBtn,
                pressed && styles.pressed,
                phase === "saving" && styles.disabled,
              ]}
            >
              {phase === "saving" ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.stopText}>停止</Text>
              )}
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
