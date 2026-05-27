"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  RotateCw,
  Square,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
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
  /** Caller saves the walk + may pre-mint a walkId for cross-link
   *  use cases (auto-photo-share start post). Returns `{ walkId }` on
   *  success so the in-view end-photo flow can include the same id
   *  in its post, or `null` on failure (caller logged it). The
   *  walk-tracking-view tolerates either shape — only the new
   *  end-photo flow reads the walkId. */
  onComplete: (
    input: WalkInput & { score: number },
  ) => Promise<{ walkId: string } | null | void>;
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
 *   - "done" — currently a save form (notes + save). Phase 4 will replace
 *     this with the in-page complete view (auto-save + two secondary CTAs).
 */
export function WalkTrackingView({
  open,
  onClose,
  pet,
  streakDays,
  storedTodayMin,
  goalMin,
  weeklyAvgMin = 0,
  onComplete,
}: Props) {
  const tW = useTranslations("Walks.core");
  const tP = useTranslations("Walks.photo");
  const tCel = useTranslations("Walks.celebration");
  const tPP = useTranslations("WalksPhotoPrompt");
  const { user } = useAuth();
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
  // Captured walkId from onComplete — used by the end-photo flow to
  // cross-link the resulting post via `post.walkId`. Stays null until
  // saveWalkOnce succeeds (or save is skipped entirely).
  const savedWalkIdRef = useRef<string | null>(null);

  // ── Auto-photo-share flow B (walk end) ────────────────────────────
  // Spec docs/features/walks-auto-photo-share.md flow B. State pulled
  // up to the component scope because the prompt's "拍照" handler
  // needs to await saveWalkOnce() before opening the composer.
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
    if (!activePetIdRef.current) return;
    const session = new WalkSession();
    sessionRef.current = session;
    const unsub = session.on(setState);
    setPhase("tracking");
    setNotes("");
    setNotesOpen(false);
    setSaveError(null);
    setSaved(false);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    if (phase !== "done") {
      setEndPromptOpen(false);
      return;
    }
    if (!autoPhotoEnabled) return;
    const t = window.setTimeout(() => setEndPromptOpen(true), 1000);
    return () => window.clearTimeout(t);
  }, [phase, autoPhotoEnabled]);

  async function handleEndPromptTake() {
    setEndPromptOpen(false);
    // Save the walk first — the end photo must never publish without
    // its walk doc, or we recreate the orphan-post data loss path.
    if (!saved) {
      const ok = await saveWalkOnce();
      if (!ok) return;
    }
    endPhotoInputRef.current?.click();
  }

  function handleEndPromptSkip() {
    setEndPromptOpen(false);
  }

  function handleEndPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return; // OS dismissed; no composer
    setEndPhoto(file);
    setEndComposerOpen(true);
  }

  function handleEndComposerClose() {
    setEndComposerOpen(false);
    setEndPhoto(null);
  }

  async function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !user) return;
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
      const ext = fileExt(processed) || "jpg";
      const path = walkPhotoPath(
        user.uid,
        sessionIdRef.current,
        idx,
        ts,
        ext,
      );
      const { url } = await uploadImage(path, processed);
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

  // Body scroll lock while the view is open (mirrors the previous Dialog).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function handleStop() {
    sessionRef.current?.stop();
    setPhase("done");
  }

  /**
   * Save the walk exactly once. Notes are taken from current state so the
   * user can add them after stopping but before tapping a CTA. The spec
   * says "停止 = 儲存成功" — from the user's POV the walk is captured at
   * stop; the actual Firestore write is deferred ~one click later to the
   * CTA so notes can ride along without a separate updateWalk path (UI/UX
   * role doesn't add Firebase functions).
   */
  async function saveWalkOnce(): Promise<boolean> {
    if (saved) return true;
    if (!sessionRef.current || !state || !state.startedAt || !pet) {
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const score = computeWalkScore({
        distanceKm: state.totalDistanceKm,
        durationMin: state.durationMin,
        pet,
        streakDays,
      });
      const result = await onComplete({
        petId: pet.petId,
        petName: pet.name,
        startedAt: state.startedAt,
        endedAt: new Date(),
        distanceKm: state.totalDistanceKm,
        durationMin: state.durationMin,
        path: state.path,
        isManual: false,
        notes: notes.trim() || undefined,
        photoURLs:
          persistedPhotoURLs.length > 0 ? persistedPhotoURLs : undefined,
        score,
      });
      // onComplete can return void (legacy callers), `null` (caller
      // didn't get an id back), or `{ walkId }` (walks page handler).
      // Stash the id for the end-photo flow to cross-link the post.
      if (result && typeof result === "object" && "walkId" in result) {
        savedWalkIdRef.current = result.walkId;
      }
      setSaved(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : tW("saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleBackToWalking() {
    const ok = await saveWalkOnce();
    if (ok) onClose();
  }

  async function handleViewLeaderboard() {
    const ok = await saveWalkOnce();
    if (ok) {
      onClose();
      router.push("/app/leaderboard");
    }
  }

  if (!open || !pet || typeof document === "undefined") return null;

  // Live blend of stored today + current session minutes for the bar.
  const blended = state
    ? WalkSession.blendTodayProgress(storedTodayMin, state.durationMin, goalMin)
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
              · 🐾 {pet.name}
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

          <Button
            variant="danger"
            onClick={handleStop}
            className="h-14 w-full max-w-xs text-base font-semibold"
          >
            <Square className="size-5" />
            {tW("stop")}
          </Button>
        </div>
      )}

      {phase === "done" && state && (
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 sm:max-w-md",
            // Spec D3: always celebration backdrop — emerald wash for
            // goal-hit, calmer zinc wash otherwise. CSS only; uses
            // existing colour ramps for parity in dark mode.
            finalGoalHit
              ? "bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-500/10 dark:to-zinc-950"
              : "bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950",
          )}
        >
          {/* Completion headline. Emerald + Trophy when the goal was hit
              today (stored + this session ≥ goalMin), amber percent line
              otherwise. Both copy variants stay short and warm — no
              "scoring" detail (spec: 分數 not in main visual). */}
          {finalGoalHit ? (
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

          {/* This-session recap. v2 adds two tiles: vs-weekly-avg + pet
              calorie estimate. Both collapse when their inputs are missing
              (weeklyAvgMin <= 0 or pet has no weight). */}
          {(() => {
            const min = state.durationMin;
            const diff = Math.round(min - weeklyAvgMin);
            const showAvg = weeklyAvgMin > 0;
            const kcal = estimatePetCalories(
              state.totalDistanceKm,
              pet?.weightKg ?? null,
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
                    {kcal > 0 && pet && (
                      <li>{tCel("calories", { name: pet.name, kcal })}</li>
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

          {/* Notes — secondary, collapsed by default. Expanding it doesn't
              hold up the save: notes ride along on whichever CTA the user
              taps next (saveWalkOnce reads `notes` state at click time). */}
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
              className="mt-2"
              aria-label={tW("noteOptional")}
            />
          </details>

          {saveError && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}

          {/* Two secondary CTAs. Both trigger save (saveWalkOnce is
              idempotent). 回到遛狗 = stay on Mango, 查看排行榜 = celebrate
              the streak / family compare. */}
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button
              onClick={handleBackToWalking}
              size="lg"
              disabled={saving}
              className="w-full"
            >
              {saving && !saved ? "..." : tW("backToWalking")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleViewLeaderboard}
              size="lg"
              disabled={saving}
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
      {pet && (
        <>
          <PhotoPromptSheet
            open={endPromptOpen}
            onSkip={handleEndPromptSkip}
            onTake={handleEndPromptTake}
            petName={pet.name}
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
                    pet: pet.name,
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
