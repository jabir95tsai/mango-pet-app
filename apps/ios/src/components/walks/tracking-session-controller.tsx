/**
 * Walk-session wiring for the walks home (apps/ios/app/(tabs)/walks.tsx) —
 * the iOS counterpart of the session / start-prompt / recovery logic in web
 * apps/web/src/app/app/walks/page.tsx:
 *
 *  - start: mint the walk id up front (START post + walk doc + END post all
 *    cross-link), then the START photo prompt — skipped for guests (web
 *    §C: `autoPhotoEnabled && !isGuest`) — or straight into tracking.
 *  - tracked saves do NOT refresh the home while the recap is open (that
 *    double-counted today's minutes, WALKS-9 / TRACK-11); the home reloads
 *    when the overlay closes (reloadAfterWrite after a save).
 *  - pending local drafts (useWalkDraftRecovery) and an in-progress session
 *    left by a killed app (useActiveWalkRecovery, R16).
 *
 * `WalkSessionOverlays` renders the START share flow + the tracking overlay.
 * Mount it at the SAME tree position in every branch of the screen (the
 * second child of a Fragment root, incl. the 0-pet empty state): if a
 * pets-list change flips the branch, an overlay at a different position
 * would remount and abandon the walk in progress.
 */
import { useRef, useState } from "react";

import { PhotoShareFlow } from "@/components/walks/photo-share-flow";
import { WalkTrackingView } from "@/components/walks/walk-tracking-view";
import {
  useWalkDraftRecovery,
  type WalkDraftRecovery,
} from "@/components/walks/walk-draft-recovery";
import {
  useActiveWalkRecovery,
  type WalkRecoveryAction,
} from "@/components/walks/tracking-session-recovery";
import type { WalksData } from "@/lib/use-walks-data";
import type { RecoveredWalkSession } from "@/lib/walk-tracking-service";
import { newWalkId } from "@/lib/walks";
import { useAuth } from "@/state/auth-context";

export type WalkSessionController = {
  uid: string | null;
  /** The tracking overlay is open (hide the sticky CTA). */
  sessionOpen: boolean;
  /** The START photo prompt / camera / composer is running. */
  startShareOpen: boolean;
  pendingWalkId: string;
  recovered: { session: RecoveredWalkSession; action: WalkRecoveryAction } | null;
  /** Auto photo share applies (pref ON and not a guest). */
  canAutoShare: boolean;
  drafts: WalkDraftRecovery;
  startWalking: () => void;
  /** START flow finished (skip / camera cancel / composer closed). */
  onStartShareDone: () => void;
  closeSession: () => void;
  markSaved: () => void;
};

export function useWalkSessionController(data: WalksData): WalkSessionController {
  const { user, isGuest } = useAuth();
  const uid = user?.uid ?? null;
  const [sessionOpen, setSessionOpen] = useState(false);
  const [startShareOpen, setStartShareOpen] = useState(false);
  // Pre-minted id so a START auto-share post + the walk doc + the END post
  // all cross-link to the same walks/{walkId} (web mintWalkId).
  const [pendingWalkId, setPendingWalkId] = useState("");
  const [recovered, setRecovered] = useState<WalkSessionController["recovered"]>(null);
  const savedRef = useRef(false);
  const canAutoShare = data.autoPhotoShare && !isGuest;
  const busy = sessionOpen || startShareOpen;

  const drafts = useWalkDraftRecovery({
    uid,
    paused: busy,
    onRecovered: data.reloadAfterWrite,
  });

  useActiveWalkRecovery({
    uid,
    // Wait for the first load so the screen's branch (0-pet vs home) is
    // settled before an overlay opens.
    blocked: busy || data.loading,
    onRecover: (session, action) => {
      savedRef.current = false;
      setRecovered({ session, action });
      setPendingWalkId(session.walkId);
      setSessionOpen(true);
    },
  });

  function startWalking() {
    // Never start a walk while the family scope is unknown (R08).
    if (data.pets.length === 0 || !data.scopeReady || busy) return;
    savedRef.current = false;
    setRecovered(null);
    setPendingWalkId(newWalkId());
    // Guests can't share to feed — skip the prompt entirely (web §C).
    if (canAutoShare) setStartShareOpen(true);
    else setSessionOpen(true);
  }

  function onStartShareDone() {
    // Every exit of the START flow proceeds into tracking; the walk id is
    // already pinned in pendingWalkId.
    setStartShareOpen(false);
    setSessionOpen(true);
  }

  function closeSession() {
    setSessionOpen(false);
    // Single-use id — the next walk mints a fresh one.
    setPendingWalkId("");
    setRecovered(null);
    if (savedRef.current) data.reloadAfterWrite();
    else void data.reload();
    savedRef.current = false;
  }

  function markSaved() {
    savedRef.current = true;
  }

  return {
    uid,
    sessionOpen,
    startShareOpen,
    pendingWalkId,
    recovered,
    canAutoShare,
    drafts,
    startWalking,
    onStartShareDone,
    closeSession,
    markSaved,
  };
}

export function WalkSessionOverlays({
  session,
  data,
}: {
  session: WalkSessionController;
  data: WalksData;
}) {
  return (
    <>
      {/* START auto-photo-share: prompt → optional photo → then tracking */}
      <PhotoShareFlow
        visible={session.startShareOpen}
        phase="start"
        pet={data.activePet}
        pets={data.pets}
        walkId={session.pendingWalkId}
        onDone={session.onStartShareDone}
      />

      <WalkTrackingView
        visible={session.sessionOpen}
        pet={data.activePet}
        pets={data.pets}
        streakDays={data.streakDays}
        familyId={data.familyId}
        walkId={session.pendingWalkId}
        autoPhotoShare={session.canAutoShare}
        goalMin={data.goalMin}
        todayMinBefore={data.todayProgress.minutes}
        weeklyAvgMin={data.weeklyAvgMin}
        recovered={session.recovered?.session ?? null}
        recoveredAction={session.recovered?.action ?? "continue"}
        onClose={session.closeSession}
        onSaved={session.markSaved}
      />
    </>
  );
}
