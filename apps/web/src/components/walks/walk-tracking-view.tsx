"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Pause,
  Play,
  RotateCw,
  Square,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { Textarea } from "@/components/ui/textarea";
import { SaveToAlbumButton } from "@/components/ui/save-to-album-button";
import { PhotoPromptSheet } from "@/components/walks/photo-prompt-sheet";
import { PostComposer } from "@/components/feed/post-composer";
import { getAppUser } from "@/lib/firebase/users";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import {
  estimatePetCalories,
  WalkSession,
  type WalkErrorKind,
  type WalkSessionState,
} from "@/lib/walk-tracking";
import { computeWalkScore } from "@/lib/scoring";
import { processImage, IMAGE_PRESETS } from "@/lib/image-processing";
import {
  deleteImage,
  fileExt,
  uploadImage,
  walkPhotoPath,
} from "@/lib/firebase/storage";
import { cn } from "@/lib/utils";
import { onWalkReconnect } from "@/lib/walk-drafts";
import type { Pet, WalkInput } from "@/lib/types";

/** Spec D2: hard cap photos per walk. */
const PHOTO_LIMIT = 5;

type PhotoSlot = {
  idx: number;
  ts: number;
  /** Local-only object URL of the picked file — shown as the thumbnail
   *  immediately so the user sees their photo without waiting for the
   *  Storage round-trip. Revoked on delete / unmount. */
  previewUrl: string;
  /** Original (post-processing) File kept in memory so the in-thumbnail
   *  save-to-album button has something to hand to navigator.share.
   *  Not persisted; lifetime matches the previewUrl (cleared on delete
   *  and on session close together with the URL). */
  file?: File;
  status: "uploading" | "done" | "failed";
  /** Download URL from Firebase Storage. Populated once upload succeeds;
   *  this is what gets persisted to `walk.photoURLs`. */
  uploadedUrl?: string;
  /** Storage path so we can delete on X-tap (best-effort). */
  storagePath?: string;
};

type Props = {
  open: boolean;
  walkId: string | null;
  onClose: () => void;
  /** Pet chosen on the Hero. The view does NOT show a pet picker — the
   *  Hero is the only place that decision lives. */
  pet: Pet | null;
  streakDays: number;
  /** Today's already-logged minutes BEFORE this session, so the live bar
   *  can blend "stored + current session". */
  storedTodayMin: number;
  goalMin: number;
  /** Avg per-walk minutes across the past 7 days (excluding the in-flight
   *  session). Used by the completion recap "vs weekly avg" tile; <= 0
   *  collapses that line. */
  weeklyAvgMin?: number;
  /** Must acknowledge a persisted walk. A missing result is a failed save. */
  onComplete: (
    input: WalkInput & { score: number },
    walkId: string,
  ) => Promise<{ walkId: string } | null>;
  onUpdate: (walkId: string, details: { notes: string; photoURLs: string[] }) => Promise<void>;
  onDiscard: (walkId: string) => void;
};

// Map the session's structured error kind to a short, localized hint. The
// raw `lastError` from WalkSession is Chinese-only and longer than what
// fits in the full-screen tracking layout.
function errorKindToKey(kind: WalkErrorKind | null): string | null {
  switch (kind) {
    case "permission_denied":
      return "errDenied";
    case "position_unavailable":
      return "errWeak";
    case "timeout":
      return "errRetrying";
    case "unsupported":
      return "errUnsupported";
    case "backgrounded":
      return "errBackground";
    default:
      return null;
  }
}

function fmtMmSs(durationMin: number): { mm: string; ss: string } {
  const total = Math.max(0, Math.floor(durationMin * 60));
  return {
    mm: String(Math.floor(total / 60)).padStart(2, "0"),
    ss: String(total % 60).padStart(2, "0"),
  };
}

/**
 * Full-screen walking view. Replaces the old WalkSessionDialog modal —
 * spec docs/features/walk-core-redesign.md "B. 追蹤中畫面" calls for
 * `fixed inset-0` so the timer, distance, and stop button are the only
 * things on screen during a walk (no nav, no other CTAs competing).
 *
 * Phases:
 *   - "tracking" — auto-started on open, ticks until user taps stop
 *   - "done" — immediate save, then recap; failed writes remain retryable.
 */
export function WalkTrackingView({
  open,
  walkId,
  onClose,
  pet,
  streakDays,
  storedTodayMin,
  goalMin,
  weeklyAvgMin = 0,
  onComplete,
  onUpdate,
  onDiscard,
}: Props) {
  const tW = useTranslations("Walks.core");
  const tP = useTranslations("Walks.photo");
  const tCel = useTranslations("Walks.celebration");
  const tPP = useTranslations("WalksPhotoPrompt");
  const tCommon = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user, isGuest } = useAuth();
  const { family } = useFamily();
  const router = useRouter();
  const sessionRef = useRef<WalkSession | null>(null);
  const [state, setState] = useState<WalkSessionState | null>(null);
  const [phase, setPhase] = useState<"tracking" | "done">("tracking");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const discardConfirmationRef = useRef(false);
  const discardedRef = useRef(false);
  const currentUidRef = useRef(user?.uid ?? null);
  const viewOpenRef = useRef(open);
  currentUidRef.current = user?.uid ?? null;
  viewOpenRef.current = open;
  // Captured walkId from onComplete — used by the end-photo flow to
  // cross-link the resulting post via `post.walkId`. Stays null until
  // saveWalkOnce succeeds (or save is skipped entirely).
  const savedWalkIdRef = useRef<string | null>(null);
  const saveWalkPromiseRef = useRef<Promise<boolean> | null>(null);
  const stoppedInputRef = useRef<(WalkInput & { score: number }) | null>(null);
  const savedDetailsRef = useRef<string | null>(null);
  const stopConfirmRef = useRef(false);
  const sessionContextRef = useRef<{
    uid: string; pet: Pet; walkId: string; streakDays: number; storedTodayMin: number;
    goalMin: number; onComplete: Props["onComplete"]; onUpdate: Props["onUpdate"];
    onDiscard: Props["onDiscard"];
  } | null>(null);

  // ── Auto-photo-share flow B (walk end) ────────────────────────────
  // Spec docs/features/walks-auto-photo-share.md flow B. State pulled
  // up to the component scope because the native camera must be opened
  // synchronously from the prompt's "拍照" click, then the picked file
  // waits for saveWalkOnce() before opening the composer.
  const [autoPhotoEnabled, setAutoPhotoEnabled] = useState(true);
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [endComposerOpen, setEndComposerOpen] = useState(false);
  const [endPhoto, setEndPhoto] = useState<File | null>(null);
  const endPhotoInputRef = useRef<HTMLInputElement | null>(null);
  // Active-pet list for the composer's pet picker — auto-photo posts
  // benefit from being tagged with the pet for feed grouping.
  const [composerPets, setComposerPets] = useState<Pet[]>([]);
  const activePetId = pet?.petId ?? null;
  const activePetIdRef = useRef<string | null>(null);

  useEffect(() => {
    activePetIdRef.current = activePetId;
  }, [activePetId]);

  // ── Photo capture (spec Phase 1) ────────────────────────────────
  // Generated once per opened session so all photos within a walk share
  // the same storage prefix. The walk doc gets its own Firestore id
  // (different from this) — photos still load by URL, so the prefix
  // mismatch is invisible to readers. Abandoned-walk photos (user
  // closes view without completing) are GC'd by an out-of-scope script
  // (see spec).
  const sessionIdRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Open → spin up session once, auto-start. Close → tear down + release wake
  // lock. This effect intentionally depends only on `open`: save/refresh and
  // family/pet reloads replace prop identities while the done screen is still
  // open, and re-running this effect would turn the finished walk into a new
  // active session.
  useEffect(() => {
    if (!open) return;
    if (!activePetIdRef.current || !pet || !walkId || !user) return;
    const context = { uid: user.uid, pet, walkId, streakDays, storedTodayMin, goalMin, onComplete, onUpdate, onDiscard };
    sessionContextRef.current = context;
    const session = new WalkSession();
    sessionRef.current = session;
    const unsub = session.on(setState);
    setPhase("tracking");
    setNotes("");
    setNotesOpen(false);
    setSaveError(null);
    setSaved(false);
    setSaving(false);
    setDiscarding(false);
    discardConfirmationRef.current = false;
    discardedRef.current = false;
    savedWalkIdRef.current = null;
    saveWalkPromiseRef.current = null;
    stoppedInputRef.current = null;
    savedDetailsRef.current = null;
    stopConfirmRef.current = false;
    setEndPromptOpen(false);
    setEndComposerOpen(false);
    setEndPhoto(null);
    // Reset photos + mint a fresh session id so a re-opened tracking
    // view doesn't leak the previous walk's photos into the new walk.
    setPhotos([]);
    setLightboxIdx(null);
    sessionIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `walk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    session.start();
    return () => {
      unsub();
      session.stop();
      sessionRef.current = null;
      if (sessionContextRef.current === context) sessionContextRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && sessionContextRef.current && sessionContextRef.current.uid !== user?.uid) {
      sessionRef.current?.stop();
      onClose();
    }
    // A different account cannot continue the old account's walk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.uid]);

  // Free object URLs the moment a thumbnail goes away. Without this we'd
  // hold the original (potentially many-MB) bitmaps in memory for the
  // page lifetime even after the user closed the view.
  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read user.walkPrefs.autoPhotoShare once per open so the end-photo
  // prompt only fires for users who haven't opted out. Absent walkPrefs
  // → ON by default per spec. Best-effort: on read failure default to
  // ON so a network hiccup doesn't suppress the prompt.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await getAppUser(user.uid);
        if (!cancelled) {
          setAutoPhotoEnabled(u?.walkPrefs?.autoPhotoShare !== false);
        }
      } catch {
        // Default ON
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  // Pre-fetch the user's pet list once per session so the end-composer's
  // pet picker is populated. Same query the walks page does — we
  // duplicate it here rather than threading via props so the
  // tracking-view stays self-contained for the end-photo flow.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const list = family
          ? await listPets(family.familyId)
          : await listPersonalPets(user.uid);
        if (!cancelled) setComposerPets(list);
      } catch {
        if (!cancelled) setComposerPets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, family]);

  // Mount → done-screen → 1s delay → end-photo prompt. The delay lets
  // the existing confetti / emerald celebration land first so the
  // sheet doesn't visually interrupt the goal-hit moment.
  useEffect(() => {
    if (!open || phase !== "done" || !saved) {
      setEndPromptOpen(false);
      return;
    }
    // Guests can't share to feed — never schedule the end-of-walk share
    // prompt for them. Spec §C.
    if (!autoPhotoEnabled || isGuest) return;
    const t = window.setTimeout(() => setEndPromptOpen(true), 1000);
    return () => window.clearTimeout(t);
  }, [open, phase, saved, autoPhotoEnabled, isGuest]);

  function handleEndPromptTake() {
    setEndPromptOpen(false);
    // Must stay synchronous with the user click. Mobile browsers can block
    // camera/file pickers after an awaited Firestore write.
    endPhotoInputRef.current?.click();
    // Start saving in parallel with the native picker. If the user captures a
    // photo, handleEndPhotoPicked awaits this same in-flight write before
    // opening the composer.
    void ensureWalkSavedOnce();
  }

  function handleEndPromptSkip() {
    setEndPromptOpen(false);
  }

  async function handleEndPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const context = sessionContextRef.current;
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return; // OS dismissed; no composer
    // Save after the native picker returns. The end photo must never publish
    // without its walk doc, or we recreate the orphan-post data loss path.
    const ok = await ensureWalkSavedOnce();
    if (!ok || !isCurrentSession(context)) return;
    setEndPhoto(file);
    setEndComposerOpen(true);
  }

  function handleEndComposerClose() {
    setEndComposerOpen(false);
    setEndPhoto(null);
  }

  async function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const context = sessionContextRef.current;
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !user || !isCurrentSession(context)) return;
    if (photos.length >= PHOTO_LIMIT) return;

    const idx = photos.length;
    const ts = Date.now();
    const previewUrl = URL.createObjectURL(file);
    const slot: PhotoSlot = {
      idx,
      ts,
      previewUrl,
      status: "uploading",
    };
    setPhotos((prev) => [...prev, slot]);

    try {
      const processed = await processImage(file, IMAGE_PRESETS.post);
      if (!isCurrentSession(context)) return;
      const ext = fileExt(processed) || "jpg";
      const path = walkPhotoPath(
        user.uid,
        sessionIdRef.current,
        idx,
        ts,
        ext,
      );
      const { url } = await uploadImage(path, processed);
      if (!isCurrentSession(context)) return;
      setPhotos((prev) =>
        prev.map((p) =>
          p.idx === idx && p.ts === ts
            ? {
                ...p,
                status: "done",
                uploadedUrl: url,
                storagePath: path,
                // Retain the processed File so SaveToAlbumButton has a
                // handle. Processed version (not the raw camera file)
                // because that's the canonical sharable artifact.
                file: processed,
              }
            : p,
        ),
      );
    } catch (err) {
      if (!isCurrentSession(context)) return;
      console.error("[walk-photo] upload failed", err);
      setPhotos((prev) =>
        prev.map((p) =>
          p.idx === idx && p.ts === ts ? { ...p, status: "failed" } : p,
        ),
      );
    }
  }

  async function handlePhotoDelete(idx: number) {
    const target = photos.find((p) => p.idx === idx);
    if (!target) return;
    URL.revokeObjectURL(target.previewUrl);
    setPhotos((prev) =>
      prev
        .filter((p) => p.idx !== idx)
        // Re-pack so subsequent uploads always land at the next sequential
        // slot — keeps `idx` matching length for the "next free" picker.
        .map((p, i) => ({ ...p, idx: i })),
    );
    if (target.status === "done" && target.storagePath) {
      // Fire-and-forget — orphan storage objects are cheap and not user-
      // visible, so a failure here shouldn't block the UI.
      void deleteImage(target.storagePath).catch(() => undefined);
    }
  }

  // Only the successfully-uploaded URLs ride along when saving the walk.
  const persistedPhotoURLs = useMemo(
    () =>
      photos
        .filter((p) => p.status === "done" && p.uploadedUrl)
        .map((p) => p.uploadedUrl as string),
    [photos],
  );
  const detailsRef = useRef({ notes: "", photoURLs: [] as string[] });
  detailsRef.current = { notes: notes.trim(), photoURLs: persistedPhotoURLs };
  const uploadingPhotos = photos.some((photo) => photo.status === "uploading");

  // Photos may finish uploading after the core walk was saved. Patch only
  // recap details on the same id; never write the core walk a second time.
  useEffect(() => {
    if (open && saved) void ensureWalkSavedOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saved, persistedPhotoURLs]);

  useEffect(() => {
    if (!open || phase !== "done") return;
    const context = sessionContextRef.current;
    let queued = false;
    return onWalkReconnect(() => {
      if (!isCurrentSession(context) || discardConfirmationRef.current || queued) return;
      const running = saveWalkPromiseRef.current;
      if (running) {
        queued = true;
        void running.then((ok) => {
          queued = false;
          if (!ok && isCurrentSession(context) && !discardConfirmationRef.current) void ensureWalkSavedOnce();
        });
      } else {
        void ensureWalkSavedOnce();
      }
    });
    // Never retry just because an error state changed; wait for reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, user?.uid]);

  useEffect(() => {
    if (!open || phase !== "done" || (saved && !saving && !uploadingPhotos
      && savedDetailsRef.current === JSON.stringify(detailsRef.current))) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, phase, saved, saving, uploadingPhotos, notes, persistedPhotoURLs]);

  // Body scroll lock while the view is open (mirrors the previous Dialog).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // §A1: the stop button sits on a full-screen `fixed inset-0` layout and is
  // easy to mis-tap, so confirm before ending. Confirm → stop + done screen.
  async function handleStop() {
    const context = sessionContextRef.current;
    if (!isCurrentSession(context) || stopConfirmRef.current || stoppedInputRef.current) return;
    stopConfirmRef.current = true;
    const ok = await askConfirm({
      title: tW("stopConfirmTitle"),
      message: tW("stopConfirmBody"),
      confirmText: tW("stopConfirmYes"),
      cancelText: tCommon("cancel"),
      danger: true,
    });
    if (sessionContextRef.current === context) stopConfirmRef.current = false;
    if (!ok || !isCurrentSession(context)) return;
    const stopped = sessionRef.current?.stop();
    if (stopped) finishWalk(stopped);
  }

  // §A2: manual pause / resume — freezes both time + distance.
  function handlePauseResume() {
    const session = sessionRef.current;
    if (!session) return;
    if (state?.isPaused) session.resume();
    else session.pause();
  }

  // §B: runaway safeguard — when the session auto-stops at the 3h cap, move to
  // the done screen (the notice there explains why it ended).
  useEffect(() => {
    if (state?.autoStopped && phase === "tracking") finishWalk(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.autoStopped, phase]);

  function finishWalk(stopped: WalkSessionState) {
    const context = sessionContextRef.current;
    if (stoppedInputRef.current || !isCurrentSession(context)) return;
    setPhase("done");
    if (!stopped.startedAt) {
      setSaveError(tW("saveFailed"));
      return;
    }
    // Freeze the final sample, owner/pet context and end time before any
    // asynchronous work. A retry must not extend or reassign the walk.
    stoppedInputRef.current = {
      petId: context.pet.petId,
      petName: context.pet.name,
      startedAt: stopped.startedAt,
      endedAt: new Date(),
      distanceKm: stopped.totalDistanceKm,
      durationMin: stopped.durationMin,
      path: stopped.path,
      isManual: false,
      ...detailsRef.current,
      score: computeWalkScore({ distanceKm: stopped.totalDistanceKm,
        durationMin: stopped.durationMin, pet: context.pet, streakDays: context.streakDays }),
    };
    void ensureWalkSavedOnce();
  }

  function isCurrentSession(context: typeof sessionContextRef.current): context is NonNullable<typeof context> {
    return context !== null && sessionContextRef.current === context && viewOpenRef.current
      && currentUidRef.current === context.uid && !discardedRef.current;
  }

  async function handleDiscard() {
    const context = sessionContextRef.current;
    if (!isCurrentSession(context) || saveWalkPromiseRef.current || savedWalkIdRef.current
      || discardConfirmationRef.current) return;
    discardConfirmationRef.current = true;
    setDiscarding(true);
    try {
      const confirmed = await askConfirm({ title: tW("discardDraftTitle"), message: tW("discardDraftBody"),
        confirmText: tW("discardDraft"), cancelText: tCommon("cancel"), danger: true });
      if (!confirmed || !isCurrentSession(context)) return;
      context.onDiscard(context.walkId);
      discardedRef.current = true;
      stoppedInputRef.current = null;
      onClose();
    } catch {
      if (isCurrentSession(context)) setSaveError(tW("discardDraftFailed"));
    } finally {
      if (sessionContextRef.current === context) {
        discardConfirmationRef.current = false;
        setDiscarding(false);
      }
    }
  }

  /** Core save and recap patches share one in-flight operation. */
  async function saveWalkOnce(): Promise<boolean> {
    const input = stoppedInputRef.current;
    const context = sessionContextRef.current;
    if (!input || !isCurrentSession(context) || discardConfirmationRef.current) return false;
    setSaving(true);
    setSaveError(null);
    try {
      if (!savedWalkIdRef.current) {
        const result = await context.onComplete(input, context.walkId);
        if (!isCurrentSession(context)) return false;
        if (!result?.walkId || result.walkId !== context.walkId) throw new Error(tW("saveFailed"));
        savedWalkIdRef.current = result.walkId;
        savedDetailsRef.current = JSON.stringify({ notes: input.notes ?? "", photoURLs: input.photoURLs ?? [] });
        setSaved(true);
      }
      // An upload/keystroke can settle during a write. Drain the newest
      // snapshot before allowing navigation; overlapping CTAs join this task.
      while (savedDetailsRef.current !== JSON.stringify(detailsRef.current)) {
        const details = detailsRef.current;
        const signature = JSON.stringify(details);
        await context.onUpdate(savedWalkIdRef.current, details);
        if (!isCurrentSession(context)) return false;
        savedDetailsRef.current = signature;
      }
      return true;
    } catch (err) {
      if (isCurrentSession(context)) setSaveError(err instanceof Error ? err.message : tW("saveFailed"));
      return false;
    } finally {
      if (isCurrentSession(context)) setSaving(false);
    }
  }

  function ensureWalkSavedOnce(): Promise<boolean> {
    if (!isCurrentSession(sessionContextRef.current) || discardConfirmationRef.current) return Promise.resolve(false);
    if (!saveWalkPromiseRef.current) {
      const promise = saveWalkOnce().finally(() => {
        if (saveWalkPromiseRef.current === promise) saveWalkPromiseRef.current = null;
      });
      saveWalkPromiseRef.current = promise;
    }
    return saveWalkPromiseRef.current;
  }

  async function handleBackToWalking() {
    const context = sessionContextRef.current;
    const ok = await ensureWalkSavedOnce();
    if (ok && isCurrentSession(context)) onClose();
  }

  async function handleViewLeaderboard() {
    const context = sessionContextRef.current;
    const ok = await ensureWalkSavedOnce();
    if (ok && isCurrentSession(context)) {
      onClose();
      router.push("/app/leaderboard");
    }
  }

  const sessionPet = sessionContextRef.current?.pet ?? pet;
  const sessionStoredMin = sessionContextRef.current?.storedTodayMin ?? storedTodayMin;
  const sessionGoalMin = sessionContextRef.current?.goalMin ?? goalMin;
  if (!open || !sessionPet || (sessionContextRef.current && sessionContextRef.current.uid !== user?.uid)
    || typeof document === "undefined") return null;

  // Live blend of stored today + current session minutes for the bar.
  const blended = state
    ? WalkSession.blendTodayProgress(sessionStoredMin, state.durationMin, sessionGoalMin)
    : {
        minutes: storedTodayMin,
        goalMin,
        percent: Math.min(100, Math.round((storedTodayMin / goalMin) * 100)),
      };

  // At stop time `state.durationMin` freezes, so the same `blended` value
  // also drives the done-view headline ("Goal hit!" vs "Today's X%").
  const finalBlended = blended;
  const finalGoalHit = finalBlended.percent >= 100;

  const { mm, ss } = fmtMmSs(state?.durationMin ?? 0);
  const errKey = errorKindToKey(state?.errorKind ?? null);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950"
      role="dialog"
      aria-modal="true"
      aria-label={tW("tracking")}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {phase === "tracking" && state && (
        /* Phase 1 (visual-redesign-mango v2): palette swap scoped to this
           subtree only. The phase === "done" celebration screen below is
           locked (walks-v2 SHIPPED — confetti, emerald wash, Trophy, recap
           tiles all untouched). Confetti palette and animation untouched
           per spec. */
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
          {/* Status pill — animated dot doubles as "still recording" signal */}
          <div className="flex items-center gap-2 rounded-full bg-mango-brand-tint px-3 py-1.5 text-xs font-medium text-mango-brand-deep dark:bg-amber-500/10 dark:text-amber-200">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full bg-mango-brand",
                !state.isPaused && "animate-pulse",
              )}
            />
            {state.isPaused ? tW("paused") : tW("tracking")}
            <span className="text-mango-ink-2 dark:text-zinc-400">
              · 🐾 {sessionPet.name}
            </span>
          </div>

          <p className="font-bold tabular-nums text-7xl text-mango-ink dark:text-zinc-100 sm:text-8xl">
            {mm}:{ss}
          </p>

          <p className="text-3xl font-semibold tabular-nums text-mango-ink dark:text-zinc-300 sm:text-4xl">
            {state.totalDistanceKm.toFixed(2)}
            <span className="ml-1 text-base font-normal text-mango-ink-2">km</span>
          </p>

          <div className="w-full max-w-xs">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-xs text-mango-ink-2">
                {tW("todayPercent", { percent: blended.percent })}
              </p>
              <p className="text-xs font-semibold tabular-nums text-mango-ink dark:text-zinc-300">
                {Math.round(blended.minutes)} / {goalMin} min
              </p>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-mango-hairline dark:bg-zinc-800"
              role="progressbar"
              aria-valuenow={blended.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  blended.percent >= 100 ? "bg-mango-leaf" : "bg-mango-amber",
                )}
                style={{ width: `${blended.percent}%` }}
              />
            </div>
          </div>

          {errKey && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                state.errorKind === "permission_denied"
                  ? "text-red-600 dark:text-red-400"
                  : "text-mango-brand-deep dark:text-amber-300",
              )}
            >
              <AlertTriangle className="size-3.5" />
              {tW(errKey)}
            </p>
          )}

          {/* Photo capture (spec Phase 1). Hidden file input + visible
              button. `capture="environment"` nudges mobile to the back
              camera; desktop browsers fall back to a normal file picker. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoPicked}
            className="hidden"
            aria-hidden="true"
          />
          <div className="flex w-full max-w-xs flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= PHOTO_LIMIT}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
                photos.length >= PHOTO_LIMIT
                  ? "cursor-not-allowed border-mango-hairline text-mango-ink-3 dark:border-zinc-800 dark:text-zinc-600"
                  : "border-mango-brand bg-mango-brand-tint text-mango-ink hover:bg-mango-brand-tint/70 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20",
              )}
            >
              <Camera className="size-4" />
              {photos.length >= PHOTO_LIMIT
                ? tP("limitReached")
                : tP("button", { n: photos.length, max: PHOTO_LIMIT })}
            </button>
            {photos.length > 0 && (
              <ul className="-mx-2 flex w-[calc(100%+1rem)] gap-2 overflow-x-auto px-2 pb-1">
                {photos.map((p) => (
                  <li
                    key={`${p.idx}-${p.ts}`}
                    className="relative shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt=""
                      className={cn(
                        "size-16 rounded-lg object-cover ring-1 ring-mango-hairline dark:ring-zinc-700",
                        p.status === "uploading" && "opacity-50",
                        p.status === "failed" && "ring-red-400",
                      )}
                    />
                    {p.status === "uploading" && (
                      <div
                        className="absolute inset-0 grid place-items-center rounded-lg bg-black/30 text-white"
                        aria-label={tP("uploading")}
                      >
                        <RotateCw className="size-4 animate-spin" />
                      </div>
                    )}
                    {p.status === "failed" && (
                      <div
                        className="absolute inset-0 grid place-items-center rounded-lg bg-red-500/40 text-white"
                        aria-label={tP("failed")}
                      >
                        <AlertTriangle className="size-4" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePhotoDelete(p.idx)}
                      aria-label={tP("delete")}
                      className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-zinc-900 text-white shadow ring-1 ring-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900"
                    >
                      <X className="size-3" />
                    </button>
                    {/* Save-to-album — bottom-right corner, only after
                        upload finishes so we have a stable File handle
                        (file is set together with status: done). */}
                    {p.status === "done" && p.file && (
                      <SaveToAlbumButton
                        file={p.file}
                        className="absolute -bottom-1 -right-1 size-5"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* §A2: pause/resume + stop. Stop is the dominant, centered action
              (full-width, like the pre-pause design) — the pause/resume
              control is deliberately smaller and secondary, sitting above it.
              Pause freezes time + distance; the status pill above flips to
              "已暫停" and drops its pulse. */}
          <div className="flex w-full max-w-xs flex-col items-center gap-3">
            <Button
              variant="secondary"
              onClick={handlePauseResume}
              className="h-10 rounded-full px-5 text-sm font-medium"
            >
              {state.isPaused ? (
                <Play className="size-4" />
              ) : (
                <Pause className="size-4" />
              )}
              {state.isPaused ? tW("resume") : tW("pause")}
            </Button>
            <Button
              variant="danger"
              onClick={handleStop}
              className="h-14 w-full text-base font-semibold"
            >
              <Square className="size-5" />
              {tW("stop")}
            </Button>
          </div>
        </div>
      )}

      {phase === "done" && state && (
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 sm:max-w-md",
            // Spec D3: always celebration backdrop — emerald wash for
            // goal-hit, calmer zinc wash otherwise. CSS only; uses
            // existing colour ramps for parity in dark mode.
            saved && finalGoalHit
              ? "bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-500/10 dark:to-zinc-950"
              : "bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950",
          )}
        >
          {/* Completion headline. Emerald + Trophy when the goal was hit
              today (stored + this session ≥ goalMin), amber percent line
              otherwise. Both copy variants stay short and warm — no
              "scoring" detail (spec: 分數 not in main visual). */}
          {!saved ? (
            <p role="status" className="text-center text-lg font-semibold text-mango-ink">
              {saving ? tW("savingWalk") : tW("walkNotSaved")}
            </p>
          ) : finalGoalHit ? (
            <div className="relative flex flex-col items-center gap-2">
              {/* Pure-CSS confetti — only fires on the goal-hit branch.
                  20 slivers; each gets a random left + delay + colour.
                  Accessibility: globals.css hides .walk-confetti under
                  prefers-reduced-motion. */}
              <div className="walk-confetti" aria-hidden="true">
                {Array.from({ length: 20 }).map((_, i) => {
                  const palette = [
                    "#f59e0b",
                    "#10b981",
                    "#fbbf24",
                    "#34d399",
                    "#fde68a",
                  ];
                  const color = palette[i % palette.length];
                  return (
                    <span
                      key={i}
                      className="walk-confetti-piece"
                      style={{
                        left: `${(i * 53) % 100}%`,
                        backgroundColor: color,
                        animationDelay: `${(i % 5) * 0.12}s`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Trophy className="size-8" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 sm:text-3xl">
                {tW("goalHitTitle")}
              </p>
              {/* Streak badge with pop animation when ≥ 1 day. */}
              {streakDays >= 1 && (
                <p className="walk-streak-pop text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  🔥 {tW("streakDaysCount", { days: streakDays })}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                {tCel("goalMissedTitle", { percent: finalBlended.percent })}
              </p>
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                {tCel("goalMissedHint", {
                  min: Math.max(
                    0,
                    goalMin - Math.round(finalBlended.minutes),
                  ),
                })}
              </p>
            </div>
          )}

          {/* §B runaway safeguard: walk auto-ended at the 3h cap. Explain why
              so the (frozen-at-3h) duration doesn't look like a glitch. */}
          {state.autoStopped && (
            <div className="flex w-full max-w-xs items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{tW("autoStoppedNotice")}</span>
            </div>
          )}

          {/* This-session recap. v2 adds two tiles: vs-weekly-avg + pet
              calorie estimate. Both collapse when their inputs are missing
              (weeklyAvgMin <= 0 or pet has no weight). */}
          {(() => {
            const min = state.durationMin;
            const diff = Math.round(min - weeklyAvgMin);
            const showAvg = weeklyAvgMin > 0;
            const kcal = estimatePetCalories(
              state.totalDistanceKm,
              sessionPet.weightKg ?? null,
            );
            return (
              <div className="flex w-full max-w-xs flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      km
                    </span>
                    <span className="text-2xl font-bold tabular-nums">
                      {state.totalDistanceKm.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      min
                    </span>
                    <span className="text-2xl font-bold tabular-nums">
                      {min.toFixed(1)}
                    </span>
                  </div>
                </div>
                {(showAvg || kcal > 0) && (
                  <ul className="flex flex-col gap-1.5 rounded-lg border border-zinc-200/60 bg-white p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    {showAvg && (
                      <li>
                        {diff > 0
                          ? tCel("vsAvgLonger", { min: diff })
                          : diff < 0
                            ? tCel("vsAvgShorter", { min: Math.abs(diff) })
                            : tCel("vsAvgSame")}
                      </li>
                    )}
                    {kcal > 0 && (
                      <li>{tCel("calories", { name: sessionPet.name, kcal })}</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })()}

          {state.path.length === 0 && (
            <div className="flex w-full max-w-xs items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{tW("noPathWarning")}</span>
            </div>
          )}

          {/* "本次紀錄" photo grid — only renders if any photos exist.
              Squares + responsive cols (2 mobile, 3 desktop). Tap →
              lightbox via local modal. */}
          {photos.length > 0 && (
            <div className="w-full max-w-xs">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {tP("recapGridLabel", { n: photos.length })}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <button
                    key={`done-${p.idx}-${p.ts}`}
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    aria-label={tP("viewLightbox")}
                    className="aspect-square overflow-hidden rounded-lg ring-1 ring-zinc-200 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:ring-zinc-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.uploadedUrl ?? p.previewUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes update the saved walk on blur or before leaving recap. */}
          <details
            open={notesOpen}
            onToggle={(e) =>
              setNotesOpen((e.currentTarget as HTMLDetailsElement).open)
            }
            className="w-full max-w-xs"
          >
            <summary className="flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-zinc-400 dark:hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  notesOpen && "rotate-180",
                )}
              />
              {tW("addNote")}
            </summary>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { void ensureWalkSavedOnce(); }}
              className="mt-2"
              aria-label={tW("noteOptional")}
            />
          </details>

          {saveError && (
            <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}

          <div className="flex w-full max-w-xs flex-col gap-2">
            {saveError && (
              <Button onClick={() => { void ensureWalkSavedOnce(); }} disabled={saving || discarding} className="rounded-[var(--radius-pill)]">
                {tCommon("retry")}
              </Button>
            )}
            {saveError && !saved && (
              <Button variant="secondary" onClick={handleDiscard} disabled={saving || discarding} className="rounded-[var(--radius-pill)]">
                {tW("discardDraft")}
              </Button>
            )}
            <p role="status" className="text-center text-xs text-mango-ink-2">
              {uploadingPhotos ? tP("uploading") : saving ? tW("savingWalk") : saved && !saveError ? tW("walkSaved") : ""}
            </p>
            <Button
              onClick={handleBackToWalking}
              size="lg"
              disabled={saving || uploadingPhotos || !saved}
              className="w-full"
            >
              {tW("backToWalking")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleViewLeaderboard}
              size="lg"
              disabled={saving || uploadingPhotos || !saved}
              className="w-full"
            >
              {tW("viewLeaderboard")}
            </Button>
          </div>
        </div>
      )}

      {/* Photo lightbox — swapped from the inline overlay to the shared
          PhotoLightbox component (spec docs/features/photo-lightbox.md).
          `lightboxIdx` now stores an ARRAY POSITION (was the photo's
          `idx` field), so the grid onClick passes `i` from .map(). */}
      <PhotoLightbox
        photos={photos.map((p) => p.uploadedUrl ?? p.previewUrl)}
        initialIdx={lightboxIdx ?? 0}
        open={lightboxIdx !== null}
        onClose={() => setLightboxIdx(null)}
      />

      {/* ── Auto-photo-share flow B: walk-end prompt ──
          Mounts inside the WalkTrackingView portal so the sheet sits
          above the done-screen confetti (z-60 vs the screen's z-40).
          The prompt useEffect above fires it 1s after phase === "done"
          to land after the celebration moment. */}
      <input
        ref={endPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleEndPhotoPicked}
        aria-hidden="true"
      />
      {sessionPet && (
        <>
          <PhotoPromptSheet
            open={endPromptOpen}
            onSkip={handleEndPromptSkip}
            onTake={handleEndPromptTake}
            petName={sessionPet.name}
            phase="end"
            walkMinutes={Math.round(state?.durationMin ?? 0)}
          />
          <PostComposer
            open={endComposerOpen}
            onClose={handleEndComposerClose}
            pets={composerPets}
            initialPhoto={endPhoto ?? undefined}
            initialCaption={
              endPhoto
                ? tPP("captionEndDefault", {
                    pet: sessionPet.name,
                    min: Math.round(state?.durationMin ?? 0),
                  })
                : undefined
            }
            walkId={savedWalkIdRef.current ?? undefined}
          />
        </>
      )}
    </div>,
    document.body,
  );
}
