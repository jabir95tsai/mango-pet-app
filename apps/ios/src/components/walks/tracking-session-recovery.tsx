/**
 * R16 / TRACK-7 — in-progress walk recovery after the app was killed or
 * evicted mid-walk. When the walks screen gains focus with no overlay open it
 * reads the persisted session (`getActiveWalkSession`, which also switches off
 * orphaned background location updates) and:
 *
 *  - another account's session → stop its location updates and drop it;
 *  - already stopped / past the 3h cap → straight to "finish" (save + recap);
 *  - otherwise asks: 繼續散步 (re-attach tracking) or 結束散步 (save it).
 *
 * The caller opens WalkTrackingView with `recovered` + `recoveredAction`.
 */
import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";

import { t } from "@/lib/i18n";
import {
  clearActiveWalkSession,
  getActiveWalkSession,
  RUNAWAY_CAP_MIN,
  sessionDurationMin,
  type RecoveredWalkSession,
} from "@/lib/walk-tracking-service";

export type WalkRecoveryAction = "continue" | "finish";

export function useActiveWalkRecovery({
  uid,
  blocked,
  onRecover,
}: {
  uid: string | null;
  /** True while a walk overlay / start flow is open (or scope not ready). */
  blocked: boolean;
  onRecover: (session: RecoveredWalkSession, action: WalkRecoveryAction) => void;
}) {
  const busyRef = useRef(false);
  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  useFocusEffect(
    useCallback(() => {
      if (!uid || blocked || busyRef.current) return;
      let active = true;
      busyRef.current = true;
      (async () => {
        let session: RecoveredWalkSession | null = null;
        try {
          session = await getActiveWalkSession();
        } catch {
          session = null;
        }
        if (!active || !session) {
          busyRef.current = false;
          return;
        }
        if (session.uid !== uid) {
          // A different account cannot continue (or save) this walk.
          await clearActiveWalkSession(session.walkId).catch(() => {});
          busyRef.current = false;
          return;
        }
        const found = session;
        const capped = sessionDurationMin(found) >= RUNAWAY_CAP_MIN;
        if (found.stoppedAt !== null || capped) {
          busyRef.current = false;
          onRecoverRef.current(found, "finish");
          return;
        }
        Alert.alert(
          t("Ios.walks.resumeActiveTitle"),
          t("Ios.walks.resumeActiveBody"),
          [
            {
              text: t("Ios.walks.resumeActiveContinue"),
              onPress: () => {
                busyRef.current = false;
                onRecoverRef.current(found, "continue");
              },
            },
            {
              text: t("Walks.core.stopConfirmYes"),
              onPress: () => {
                busyRef.current = false;
                onRecoverRef.current(found, "finish");
              },
            },
          ],
          { cancelable: false },
        );
      })();
      return () => {
        active = false;
      };
    }, [uid, blocked]),
  );
}
