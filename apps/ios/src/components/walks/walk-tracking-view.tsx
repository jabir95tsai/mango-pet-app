/**
 * Full-screen walk overlay — iOS port of
 * apps/web/src/components/walks/walk-tracking-view.tsx.
 *
 * Phases:
 *  • "tracking" — drives WalkTrackingService (timer, distance, path, user
 *    pause/resume, 3h runaway cap, GPS hints; background continuation is an
 *    accepted iOS upgrade). Explicit non-tracking states: starting,
 *    permission denied, start failed (R16).
 *  • "done" — on a CONFIRMED stop the walk input is frozen (end time, path,
 *    score, owner/pet snapshot) and saved IMMEDIATELY (web parity): a local
 *    draft is stored first, then createWalk (idempotent on the pre-minted id),
 *    then later notes / photo uploads are patched onto the same walk via
 *    updateWalkDetails. Failure → inline error + Retry (+ Discard draft with a
 *    confirm while never saved). 回到遛狗 / 查看排行榜 stay disabled until saved
 *    and no photo is uploading.
 *
 * The session context (pet, family, streak, goal, today minutes, weekly avg)
 * is snapshotted when the overlay opens, so a refresh underneath can never
 * double-count today's minutes or swap the pet mid-walk (TRACK-11).
 *
 * A persisted session (app killed / evicted mid-walk, R16) can be re-opened
 * via `recovered` + `recoveredAction` ("continue" re-attaches tracking,
 * "finish" goes straight to the save + recap).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Pet } from "@mango/shared-types";
import { computeWalkScore, getPetWalkGoalMinutes } from "@mango/shared-business";

import { CameraCaptureModal } from "@/components/walks/camera-capture-modal";
import { PhotoShareFlow } from "@/components/walks/photo-share-flow";
import { TrackingActivePanel } from "@/components/walks/tracking-active-panel";
import { TrackingDonePanel } from "@/components/walks/tracking-done-panel";
import {
  TrackingPhotoControls,
  TrackingPhotoGrid,
  WALK_PHOTO_LIMIT,
  type WalkPhotoSlot,
} from "@/components/walks/tracking-photos";
import {
  TrackingPermissionScreen,
  TrackingStartFailedScreen,
  TrackingStartingScreen,
} from "@/components/walks/tracking-status-screens";
import { PhotoLightbox } from "@/components/feed/photo-lightbox";
import { alertError, confirm } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { deleteStorageObject, uploadWalkPhotoWithPath } from "@/lib/photos";
import { savePhotoToAlbum } from "@/lib/save-photo";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  discardWalkDraft,
  onWalkRetryHint,
  removeWalkDraft,
  SAVE_TIMEOUT_MS,
  storeWalkDraft,
  wasWalkDraftDiscarded,
  WalkDraftDiscardedError,
  withTimeout,
} from "@/lib/walk-drafts";
import {
  emptyTrackingState,
  recoveredEndAt,
  scorablePetOf,
  scorableSnapshotOf,
  WalkTrackingService,
  type RecoveredWalkSession,
  type ScorableSnapshot,
  type WalkSessionIdentity,
  type WalkTrackingState,
} from "@/lib/walk-tracking-service";
import { createWalk, updateWalkDetails, type CreateWalkInput } from "@/lib/walks";
import { useAuth } from "@/state/auth-context";
import { colors } from "@/theme/theme";

/** Web: the END photo prompt lands 1s after the save, after the celebration. */
const END_PROMPT_DELAY_MS = 1000;

type Props = {
  visible: boolean;
  pet: Pet | null;
  /** All pets in scope — for the END composer's pet tags. */
  pets: Pet[];
  streakDays: number;
  familyId: string | null;
  /** Pre-minted walk id — the photo sessionId AND createWalk's id, so an
   *  auto-share post cross-links to the same walk. */
  walkId: string;
  /** Run the END auto-photo-share prompt after saving (never for guests). */
  autoPhotoShare: boolean;
  /** Active pet's daily goal (minutes). */
  goalMin: number;
  /** Today's walked minutes BEFORE this session (stored). */
  todayMinBefore: number;
  /** Trailing 7-day per-walk average (recap "vs 平均"). */
  weeklyAvgMin: number;
  onClose: () => void;
  /** The core walk doc was acknowledged (once per session). Do NOT refresh
   *  the walks list here — refresh when the overlay closes (TRACK-11). */
  onSaved: () => void;
  /** Re-open a persisted session found on launch. */
  recovered?: RecoveredWalkSession | null;
  recoveredAction?: "continue" | "finish";
};

type SessionContext = {
  token: number;
  uid: string;
  walkId: string;
  petId: string;
  petName: string;
  weightKg: number | null;
  scorable: ScorableSnapshot | null;
  familyId: string | null;
  streakDays: number;
  goalMin: number;
  todayMinBefore: number;
  weeklyAvgMin: number;
};

let tokenSeq = 0;

function identityOf(ctx: SessionContext): WalkSessionIdentity {
  return {
    uid: ctx.uid,
    walkId: ctx.walkId,
    petId: ctx.petId,
    petName: ctx.petName,
    familyId: ctx.familyId,
    streakDays: ctx.streakDays,
    scorable: ctx.scorable,
  };
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
  recovered = null,
  recoveredAction = "continue",
}: Props) {
  const { user, isGuest } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const serviceRef = useRef<WalkTrackingService | null>(null);
  if (!serviceRef.current) serviceRef.current = new WalkTrackingService();
  const svc = serviceRef.current;

  const [state, setState] = useState<WalkTrackingState>(emptyTrackingState);
  const [phase, setPhase] = useState<"tracking" | "done">("tracking");
  const [final, setFinal] = useState<WalkTrackingState | null>(null);
  const [ctx, setCtx] = useState<SessionContext | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  /** The stopped walk is safely in a local draft — leaving is lossless. */
  const [drafted, setDrafted] = useState(false);
  const [slots, setSlots] = useState<WalkPhotoSlot[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [endShareOpen, setEndShareOpen] = useState(false);

  const ctxRef = useRef<SessionContext | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const uidRef = useRef<string | null>(user?.uid ?? null);
  uidRef.current = user?.uid ?? null;
  const userRef = useRef(user);
  userRef.current = user;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const slotsRef = useRef<WalkPhotoSlot[]>(slots);
  slotsRef.current = slots;
  const saveErrorRef = useRef<string | null>(saveError);
  saveErrorRef.current = saveError;

  const savedRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const stoppedInputRef = useRef<CreateWalkInput | null>(null);
  const savedDetailsRef = useRef<string | null>(null);
  const stopConfirmRef = useRef(false);
  const discardConfirmRef = useRef(false);
  const discardedRef = useRef(false);
  const endShareShownRef = useRef(false);
  const seqRef = useRef(0);

  // Recap details that ride along / are patched after the core save.
  const doneUrls = slots
    .filter((s) => s.status === "done" && s.url)
    .map((s) => s.url as string);
  const doneUrlsKey = doneUrls.join("|");
  const uploading = slots.some((s) => s.status === "uploading");
  const detailsRef = useRef({ notes: "", photoURLs: [] as string[] });
  detailsRef.current = { notes: notes.trim(), photoURLs: doneUrls };

  function isCurrent(context: SessionContext | null): context is SessionContext {
    return (
      context !== null &&
      ctxRef.current === context &&
      visibleRef.current &&
      uidRef.current === context.uid &&
      !discardedRef.current
    );
  }

  // Subscribe once.
  useEffect(() => {
    const unsub = svc.on(setState);
    return () => {
      unsub();
    };
  }, [svc]);

  // Open → snapshot the session and start (or re-attach / finish a recovered
  // one). Close → release GPS. Depends only on `visible`: refreshed props
  // while the recap is open must never restart the walk.
  useEffect(() => {
    if (!visible) return;
    const uid = userRef.current?.uid ?? null;
    const token = ++tokenSeq;
    let context: SessionContext | null = null;
    const rec = recovered && uid && recovered.uid === uid ? recovered : null;
    if (rec && uid) {
      const recPet = pets.find((p) => p.petId === rec.petId) ?? null;
      context = {
        token,
        uid,
        walkId: rec.walkId,
        petId: rec.petId,
        petName: rec.petName,
        weightKg: rec.scorable?.weightKg ?? recPet?.weightKg ?? null,
        scorable: rec.scorable,
        familyId: rec.familyId,
        streakDays: rec.streakDays,
        goalMin: recPet ? getPetWalkGoalMinutes(recPet) : goalMin,
        todayMinBefore,
        weeklyAvgMin,
      };
    } else if (uid && pet && walkId) {
      context = {
        token,
        uid,
        walkId,
        petId: pet.petId,
        petName: pet.name,
        weightKg: pet.weightKg ?? null,
        scorable: scorableSnapshotOf(pet),
        familyId,
        streakDays,
        goalMin,
        todayMinBefore,
        weeklyAvgMin,
      };
    }

    ctxRef.current = context;
    setCtx(context);
    setPhase("tracking");
    setFinal(null);
    setNotes("");
    setSaving(false);
    setSaveError(null);
    setSaved(false);
    setDiscarding(false);
    setDrafted(false);
    setSlots([]);
    setCameraOpen(false);
    setLightboxIdx(null);
    setEndShareOpen(false);
    savedRef.current = false;
    savePromiseRef.current = null;
    stoppedInputRef.current = null;
    savedDetailsRef.current = null;
    stopConfirmRef.current = false;
    discardConfirmRef.current = false;
    discardedRef.current = false;
    endShareShownRef.current = false;
    seqRef.current = 0;

    if (!context) {
      // Nothing to track (no pet / signed out) — never show a dead overlay.
      onCloseRef.current();
      return;
    }

    if (rec) {
      if (recoveredAction === "continue" && rec.stoppedAt === null) {
        const c = context;
        void svc.resumeSession(rec).then((ok) => {
          // Could not re-attach (permission / source) → save what we have.
          if (!ok && isCurrent(c)) finishRecovered(c, rec);
        });
      } else {
        finishRecovered(context, rec);
      }
    } else {
      void svc.start(identityOf(context));
    }

    const opened = context;
    return () => {
      svc.reset();
      if (ctxRef.current === opened) ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A different account cannot continue the old account's walk.
  useEffect(() => {
    const context = ctxRef.current;
    if (visible && context && context.uid !== user?.uid) {
      svc.reset();
      onCloseRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.uid]);

  // §B: the 3h cap auto-stopped the session → done screen (notice explains).
  useEffect(() => {
    if (visible && state.autoStopped && phase === "tracking") {
      finishWalk(svc.getState(), ctxRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, state.autoStopped, phase]);

  // Photos may finish uploading after the core walk was saved: patch only the
  // recap details on the same id; never write the core walk a second time.
  useEffect(() => {
    if (visible && saved) void ensureSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, saved, doneUrlsKey]);

  // Location denied → the user may fix it in Settings; retry on return.
  useEffect(() => {
    if (
      !visible ||
      phase !== "tracking" ||
      state.status !== "failed" ||
      state.errorKind !== "permission_denied"
    ) {
      return;
    }
    const context = ctxRef.current;
    return onWalkRetryHint(() => {
      if (isCurrent(context) && svc.getState().status === "failed") {
        void svc.start(identityOf(context));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, phase, state.status, state.errorKind]);

  // Back in the foreground after a failed save → one retry (web reconnect).
  useEffect(() => {
    if (!visible || phase !== "done") return;
    const context = ctxRef.current;
    return onWalkRetryHint(() => {
      if (!isCurrent(context) || discardConfirmRef.current) return;
      if (!saveErrorRef.current) return;
      void ensureSaved();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, phase]);

  // END auto-photo-share: 1s after the save, once per session, never for
  // guests (web §C). Closing it returns to the saved recap.
  useEffect(() => {
    if (!visible || phase !== "done" || !saved) {
      setEndShareOpen(false);
      return;
    }
    if (!autoPhotoShare || isGuest || endShareShownRef.current) return;
    const id = setTimeout(() => {
      endShareShownRef.current = true;
      setEndShareOpen(true);
    }, END_PROMPT_DELAY_MS);
    return () => clearTimeout(id);
  }, [visible, phase, saved, autoPhotoShare, isGuest]);

  function finishRecovered(context: SessionContext, rec: RecoveredWalkSession) {
    if (!isCurrent(context)) return;
    svc.adopt(rec, recoveredEndAt(rec));
    finishWalk(svc.stop(), context);
  }

  /** Freeze the walk input at stop and save immediately (web finishWalk). */
  function finishWalk(stopped: WalkTrackingState, context: SessionContext | null) {
    const u = userRef.current;
    if (stoppedInputRef.current || !isCurrent(context) || !u) return;
    setFinal(stopped);
    setPhase("done");
    if (!stopped.startedAt) {
      setSaveError(t("Walks.core.saveFailed"));
      return;
    }
    const startedAt = stopped.startedAt;
    // End = start + pauses + active duration (== the stop instant; for a
    // recovered walk, the last moment it was known to be recording).
    const endedAt = new Date(
      startedAt.getTime() + stopped.pausedMs + Math.round(stopped.durationMin * 60_000),
    );
    const score = computeWalkScore({
      distanceKm: stopped.totalDistanceKm,
      durationMin: stopped.durationMin,
      pet: scorablePetOf(context.scorable),
      streakDays: context.streakDays,
    });
    const details = detailsRef.current;
    stoppedInputRef.current = {
      scorePet: null,
      score,
      streakDays: context.streakDays,
      familyId: context.familyId,
      walkerUid: context.uid,
      walkerName: u.displayName ?? u.email?.split("@")[0] ?? "Friend",
      walkerPhotoURL: u.photoURL,
      petId: context.petId,
      petName: context.petName,
      startedAt,
      endedAt,
      distanceKm: stopped.totalDistanceKm,
      durationMin: stopped.durationMin,
      path: stopped.path,
      isManual: false,
      notes: details.notes || null,
      photoURLs: details.photoURLs,
      walkId: context.walkId,
    };
    void ensureSaved();
  }

  /** Core save + recap patches share one in-flight operation. */
  async function saveWalkOnce(): Promise<boolean> {
    const input = stoppedInputRef.current;
    const context = ctxRef.current;
    if (!input || !isCurrent(context) || discardConfirmRef.current) return false;
    setSaving(true);
    setSaveError(null);
    try {
      if (!savedRef.current) {
        if (await wasWalkDraftDiscarded(context.uid, context.walkId).catch(() => false)) {
          throw new WalkDraftDiscardedError();
        }
        let drafted = false;
        try {
          await storeWalkDraft({
            ...input,
            scorePet: null,
            walkId: context.walkId,
            score: input.score ?? 0,
          });
          drafted = true;
        } catch (err) {
          if (err instanceof WalkDraftDiscardedError) throw err;
          // Storage unavailable — the server save still works; the session
          // record stays as the recovery path instead.
        }
        // The walk now lives in a draft — the in-progress record can go.
        if (drafted) {
          svc.clearPersistedSession();
          if (isCurrent(context)) setDrafted(true);
        }
        await withTimeout(createWalk(input), SAVE_TIMEOUT_MS);
        void removeWalkDraft(context.uid, context.walkId).catch(() => {});
        if (!isCurrent(context)) return false;
        svc.clearPersistedSession();
        savedRef.current = true;
        savedDetailsRef.current = JSON.stringify({
          notes: input.notes ?? "",
          photoURLs: input.photoURLs ?? [],
        });
        setSaved(true);
        onSavedRef.current();
      }
      // An upload / keystroke can settle during a write — drain the newest
      // snapshot before allowing navigation; overlapping CTAs join this task.
      while (savedDetailsRef.current !== JSON.stringify(detailsRef.current)) {
        const next = detailsRef.current;
        const signature = JSON.stringify(next);
        await withTimeout(updateWalkDetails(context.walkId, next), SAVE_TIMEOUT_MS);
        if (!isCurrent(context)) return false;
        savedDetailsRef.current = signature;
      }
      return true;
    } catch (err) {
      if (__DEV__) console.warn("[walk] save failed", err);
      if (isCurrent(context)) {
        setSaveError(
          err instanceof WalkDraftDiscardedError
            ? t("Walks.core.draftDiscarded")
            : t("Walks.core.saveFailed"),
        );
      }
      return false;
    } finally {
      if (isCurrent(context)) setSaving(false);
    }
  }

  function ensureSaved(): Promise<boolean> {
    if (!isCurrent(ctxRef.current) || discardConfirmRef.current) return Promise.resolve(false);
    if (!savePromiseRef.current) {
      const promise = saveWalkOnce().finally(() => {
        if (savePromiseRef.current === promise) savePromiseRef.current = null;
      });
      savePromiseRef.current = promise;
    }
    return savePromiseRef.current;
  }

  // §A1: the full-screen stop is easy to mis-tap — confirm first.
  async function handleStop() {
    const context = ctxRef.current;
    if (
      !isCurrent(context) ||
      stopConfirmRef.current ||
      stoppedInputRef.current ||
      svc.getState().status !== "tracking"
    ) {
      return;
    }
    stopConfirmRef.current = true;
    const ok = await confirm({
      title: t("Walks.core.stopConfirmTitle"),
      message: t("Walks.core.stopConfirmBody"),
      confirmLabel: t("Walks.core.stopConfirmYes"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (ctxRef.current === context) stopConfirmRef.current = false;
    if (!ok || !isCurrent(context) || stoppedInputRef.current) return;
    finishWalk(svc.stop(), context);
  }

  // §A2: manual pause / resume — freezes time + distance.
  function handlePauseResume() {
    if (svc.getState().isPaused) svc.resume();
    else svc.pause();
  }

  async function handleDiscard() {
    const context = ctxRef.current;
    if (
      !isCurrent(context) ||
      savePromiseRef.current ||
      savedRef.current ||
      discardConfirmRef.current
    ) {
      return;
    }
    discardConfirmRef.current = true;
    setDiscarding(true);
    try {
      const ok = await confirm({
        title: t("Walks.core.discardDraftTitle"),
        message: t("Walks.core.discardDraftBody"),
        confirmLabel: t("Walks.core.discardDraft"),
        cancelLabel: t("Common.cancel"),
        destructive: true,
      });
      if (!ok || !isCurrent(context)) return;
      await discardWalkDraft(context.uid, context.walkId);
      discardedRef.current = true;
      stoppedInputRef.current = null;
      // Its photos will never be referenced — best-effort cleanup.
      for (const slot of slotsRef.current) {
        if (slot.storagePath) void deleteStorageObject(slot.storagePath).catch(() => {});
      }
      onCloseRef.current();
    } catch {
      if (isCurrent(context)) setSaveError(t("Walks.core.discardDraftFailed"));
    } finally {
      if (ctxRef.current === context) {
        discardConfirmRef.current = false;
        setDiscarding(false);
      }
    }
  }

  async function handleBackToWalking() {
    const context = ctxRef.current;
    const ok = await ensureSaved();
    if (ok && isCurrent(context)) onCloseRef.current();
  }

  async function handleViewLeaderboard() {
    const context = ctxRef.current;
    const ok = await ensureSaved();
    if (ok && isCurrent(context)) {
      onCloseRef.current();
      router.push("/(tabs)/leaderboard");
    }
  }

  // iOS-only exit (the full-screen modal has no browser back): once the walk
  // is in a local draft, an unreachable server must not trap the user — the
  // walks home lists the draft and retries it (web recoveryNotice). The draft
  // was written at stop, so first fold in what changed since (notes typed,
  // photos that finished uploading) — otherwise the recovered walk would lose
  // them and the uploaded photos would be orphaned in Storage.
  async function handleSaveLater() {
    const context = ctxRef.current;
    const input = stoppedInputRef.current;
    if (
      !drafted ||
      !input ||
      !isCurrent(context) ||
      savedRef.current ||
      savePromiseRef.current ||
      slotsRef.current.some((s) => s.status === "uploading")
    ) {
      return;
    }
    const details = detailsRef.current;
    const latest: CreateWalkInput = {
      ...input,
      notes: details.notes || null,
      photoURLs: details.photoURLs,
    };
    try {
      await storeWalkDraft({ ...latest, scorePet: null, walkId: context.walkId, score: latest.score ?? 0 });
      stoppedInputRef.current = latest;
    } catch {
      // Could not update the draft — stay so nothing is silently dropped.
      if (isCurrent(context)) setSaveError(t("Walks.core.saveFailed"));
      return;
    }
    if (isCurrent(context)) onCloseRef.current();
  }

  function handleRequestClose() {
    if (phase === "done") {
      if (savedRef.current) void handleBackToWalking();
      else if (saveErrorRef.current) void handleSaveLater();
      return;
    }
    if (state.status === "tracking") void handleStop();
    else onCloseRef.current();
  }

  // ── In-walk photos ──────────────────────────────────────────────────
  async function uploadSlot(slot: WalkPhotoSlot, context: SessionContext) {
    try {
      const { url, path } = await uploadWalkPhotoWithPath(
        slot.localUri,
        context.uid,
        context.walkId,
        slot.seq,
        slot.ts,
      );
      const stillThere = slotsRef.current.some((s) => s.id === slot.id);
      if (!isCurrent(context) || !stillThere) {
        // Closed session / deleted while uploading — never referenced.
        void deleteStorageObject(path).catch(() => {});
        return;
      }
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, status: "done", url, storagePath: path } : s,
        ),
      );
    } catch (err) {
      if (__DEV__) console.warn("[walk-photo] upload failed", err);
      if (!isCurrent(context)) return;
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, status: "failed" } : s)));
    }
  }

  function handleCaptured(uri: string) {
    setCameraOpen(false);
    const context = ctxRef.current;
    if (!isCurrent(context) || slotsRef.current.length >= WALK_PHOTO_LIMIT) return;
    const seq = seqRef.current++;
    const slot: WalkPhotoSlot = {
      id: `${context.token}-${seq}`,
      seq,
      ts: Date.now(),
      localUri: uri,
      status: "uploading",
    };
    setSlots((prev) => [...prev, slot]);
    void uploadSlot(slot, context);
  }

  function handleRetryPhoto(id: string) {
    const context = ctxRef.current;
    const slot = slotsRef.current.find((s) => s.id === id);
    if (!isCurrent(context) || !slot || slot.status !== "failed") return;
    const next: WalkPhotoSlot = { ...slot, status: "uploading", ts: Date.now() };
    setSlots((prev) => prev.map((s) => (s.id === id ? next : s)));
    void uploadSlot(next, context);
  }

  function handleDeletePhoto(id: string) {
    const target = slotsRef.current.find((s) => s.id === id);
    if (!target) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
    if (target.status === "done" && target.storagePath) {
      // Fire-and-forget — an orphan object is cheap and invisible.
      void deleteStorageObject(target.storagePath).catch(() => {});
    }
  }

  async function handleSaveLightboxPhoto(url: string) {
    try {
      await savePhotoToAlbum(url);
      Alert.alert(t("Common.saveToAlbum.saved"));
    } catch {
      alertError(t("Common.saveToAlbum.failed"));
    }
  }

  // ── Render ──────────────────────────────────────────────────────────
  const sessionPet = ctx ? (pets.find((p) => p.petId === ctx.petId) ?? pet) : pet;
  const lightboxPhotos = slots.map((s) => s.url ?? s.localUri);

  let body: ReactNode = null;
  if (ctx && phase === "done" && final) {
    body = (
      <TrackingDonePanel
        final={final}
        petName={ctx.petName}
        petWeightKg={ctx.weightKg}
        streakDays={ctx.streakDays}
        storedTodayMin={ctx.todayMinBefore}
        goalMin={ctx.goalMin}
        weeklyAvgMin={ctx.weeklyAvgMin}
        saved={saved}
        saving={saving}
        discarding={discarding}
        uploading={uploading}
        saveError={saveError}
        photoGrid={<TrackingPhotoGrid slots={slots} onOpen={setLightboxIdx} />}
        notes={notes}
        onNotesChange={setNotes}
        onNotesBlur={() => {
          void ensureSaved();
        }}
        onRetry={() => {
          void ensureSaved();
        }}
        onDiscard={() => {
          void handleDiscard();
        }}
        onSaveLater={
          drafted
            ? () => {
                void handleSaveLater();
              }
            : undefined
        }
        onBack={() => {
          void handleBackToWalking();
        }}
        onLeaderboard={() => {
          void handleViewLeaderboard();
        }}
      />
    );
  } else if (ctx) {
    let content: ReactNode;
    if (state.errorKind === "permission_denied" && state.status === "failed") {
      content = <TrackingPermissionScreen onBack={() => onCloseRef.current()} />;
    } else if (state.status === "failed") {
      content = (
        <TrackingStartFailedScreen
          onRetry={() => {
            const context = ctxRef.current;
            if (isCurrent(context)) void svc.start(identityOf(context));
          }}
          onBack={() => onCloseRef.current()}
        />
      );
    } else if (state.status === "tracking") {
      content = (
        <TrackingActivePanel
          state={state}
          petName={ctx.petName}
          storedTodayMin={ctx.todayMinBefore}
          goalMin={ctx.goalMin}
          onPauseResume={handlePauseResume}
          onStop={() => {
            void handleStop();
          }}
          photos={
            <TrackingPhotoControls
              slots={slots}
              onOpenCamera={() => setCameraOpen(true)}
              onDelete={handleDeletePhoto}
              onRetry={handleRetryPhoto}
            />
          }
        />
      );
    } else {
      content = <TrackingStartingScreen />;
    }
    body = <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
  }

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      presentationStyle="fullScreen"
      onRequestClose={handleRequestClose}
    >
      <View style={styles.root} accessibilityViewIsModal>
        {body}

        {/* In-walk camera (tracking phase) — overlay inside this modal */}
        <CameraCaptureModal
          visible={cameraOpen && phase === "tracking"}
          onCaptured={handleCaptured}
          onCancel={() => setCameraOpen(false)}
        />

        {lightboxIdx !== null && lightboxPhotos.length > 0 ? (
          <PhotoLightbox
            photos={lightboxPhotos}
            initialIndex={Math.min(lightboxIdx, lightboxPhotos.length - 1)}
            open
            onClose={() => setLightboxIdx(null)}
            onSave={(url) => handleSaveLightboxPhoto(url)}
          />
        ) : null}

        {/* END auto-photo-share — same walkId cross-link, after the save */}
        {ctx && final ? (
          <PhotoShareFlow
            visible={endShareOpen}
            phase="end"
            pet={sessionPet}
            petName={ctx.petName}
            pets={pets}
            walkId={ctx.walkId}
            walkMinutes={Math.round(final.durationMin)}
            onDone={() => setEndShareOpen(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // web: fixed inset-0 bg-white
  root: { flex: 1, backgroundColor: colors.card },
  safe: { flex: 1, backgroundColor: colors.card },
});
